#!/usr/bin/env python3
"""Un client HTTP qui ne fait pas tomber un scan.

Trois décisions, toutes tirées du même constat : les API gratuites répondent
mal, et un scan qui s'arrête à la première erreur ne tourne jamais deux fois de
suite.

1. **Un appel raté rend `None`, il ne lève pas.** Si RugCheck est en panne, on
   perd un second avis sur Solana — on ne perd pas les quatre-vingt-dix autres
   candidats du tour. Seule une erreur de configuration mérite d'arrêter le
   programme, et elle est levée au chargement, avant le premier appel.

2. **Le débit se règle avant de partir, pas après le 429.** Un refus pour excès
   de requêtes coûte une seconde d'attente imposée et une réponse perdue ; se
   tenir à 80 % du débit annoncé coûte quelques millisecondes par appel. Le
   calcul est vite fait, et il évite en prime de se faire remarquer.

3. **La cadence est par point d'entrée, pas par hôte.** DexScreener annonce
   300 requêtes par minute sur la recherche et 60 sur les profils : un compteur
   unique pour `api.dexscreener.com` nous ferait soit gaspiller les quatre
   cinquièmes du premier, soit dépasser le second.
"""

from __future__ import annotations

import logging
import time

import requests

JOURNAL = logging.getLogger("pepites.reseau")

# On vise 80 % du débit annoncé. La marge absorbe le fait que le service compte
# ses fenêtres autrement que nous, ce qu'aucune documentation ne précise jamais.
MARGE_DEBIT = 0.8

DELAI_PAR_DEFAUT = 12.0          # secondes ; au-delà, la réponse n'a plus d'intérêt pour ce tour
ESSAIS_PAR_DEFAUT = 3
ATTENTE_MAX = 30.0               # plafond du délai d'attente, refus pour excès compris

# Au-delà de ce nombre d'échecs d'affilée, ce n'est plus un service qui hoquette,
# c'est la connexion qui manque. Sans cette borne, un scan hors ligne enchaîne
# trente points d'entrée en épuisant chaque fois ses trois essais et leurs
# délais d'attente : plusieurs minutes à ne rien faire, puis un rapport vide qui
# ressemble à un marché calme.
ECHECS_D_AFFILEE_MAX = 5


class ReseauIndisponible(RuntimeError):
    """Plus rien ne répond. Inutile de poursuivre le tour."""


class Debit:
    """Espace les appels d'un même point d'entrée."""

    def __init__(self, par_minute: float) -> None:
        if par_minute <= 0:
            raise ValueError("un débit se compte en requêtes par minute, strictement positif")
        self.intervalle = 60.0 / (par_minute * MARGE_DEBIT)
        self._dernier = 0.0

    def attendre(self) -> None:
        reste = self._dernier + self.intervalle - time.monotonic()
        if reste > 0:
            time.sleep(reste)
        self._dernier = time.monotonic()


class ClientHttp:
    """Session partagée, cadencée, qui encaisse les pannes sans les propager."""

    def __init__(
        self,
        debits: dict[str, float],
        delai: float = DELAI_PAR_DEFAUT,
        essais: int = ESSAIS_PAR_DEFAUT,
    ) -> None:
        self.debits = {cle: Debit(par_minute) for cle, par_minute in debits.items()}
        self.delai = delai
        self.essais = essais
        self.appels = 0
        self.echecs = 0
        self._echecs_d_affilee = 0
        # Une session garde la connexion TCP et la négociation TLS ouvertes.
        # Sur trois cents appels au même hôte, c'est l'essentiel du temps de scan.
        self.session = requests.Session()
        self.session.headers["User-Agent"] = "pepites/0.1 (radar personnel)"

    def json(self, cle: str, url: str, params: dict | None = None, entetes: dict | None = None):
        """Rend le JSON du point d'entrée `cle`, ou `None` si l'appel a échoué."""
        debit = self.debits.get(cle)
        for essai in range(1, self.essais + 1):
            if debit:
                debit.attendre()
            self.appels += 1
            try:
                reponse = self.session.get(
                    url, params=params, headers=entetes, timeout=self.delai
                )
            except requests.RequestException as erreur:
                JOURNAL.warning("%s : %s (essai %d/%d)", cle, erreur, essai, self.essais)
                self._patienter(essai)
                continue

            if reponse.status_code == 429:
                attente = self._retry_after(reponse) or self._recul(essai)
                JOURNAL.warning("%s : débit dépassé, pause de %.1f s", cle, attente)
                time.sleep(attente)
                continue

            if reponse.status_code >= 500:
                JOURNAL.warning("%s : erreur %d côté service", cle, reponse.status_code)
                self._patienter(essai)
                continue

            if reponse.status_code >= 400:
                # 404 sur un jeton inconnu, 400 sur une adresse mal formée : ce
                # sont des réponses, pas des pannes. Réessayer ne changerait rien.
                JOURNAL.debug("%s : refus %d, on passe", cle, reponse.status_code)
                self.echecs += 1
                self._echecs_d_affilee = 0
                return None

            try:
                lu = reponse.json()
            except ValueError:
                JOURNAL.warning("%s : réponse illisible", cle)
                self._patienter(essai)
                continue
            self._echecs_d_affilee = 0
            return lu

        self.echecs += 1
        self._echecs_d_affilee += 1
        JOURNAL.error("%s : abandon après %d essais", cle, self.essais)
        if self._echecs_d_affilee >= ECHECS_D_AFFILEE_MAX:
            raise ReseauIndisponible(
                f"{self._echecs_d_affilee} points d'entrée d'affilée sans réponse"
            )
        return None

    def poster(self, cle: str, url: str, charge: dict) -> dict | None:
        """Envoie un corps JSON. Un seul usage aujourd'hui — Telegram —, mais
        faire passer un message d'alerte par les paramètres d'une URL le
        limiterait en longueur et le ferait apparaître dans les journaux."""
        debit = self.debits.get(cle)
        for essai in range(1, self.essais + 1):
            if debit:
                debit.attendre()
            self.appels += 1
            try:
                reponse = self.session.post(url, json=charge, timeout=self.delai)
            except requests.RequestException as erreur:
                JOURNAL.warning("%s : %s (essai %d/%d)", cle, erreur, essai, self.essais)
                self._patienter(essai)
                continue
            if reponse.status_code < 400:
                self._echecs_d_affilee = 0
                try:
                    return reponse.json()
                except ValueError:
                    return {}
            # Un jeton de bot invalide rend 401 : réessayer n'y changera rien,
            # et le message doit dire *quoi* corriger.
            if reponse.status_code < 500:
                JOURNAL.error("%s : refus %d — %s", cle, reponse.status_code,
                              reponse.text[:200])
                self.echecs += 1
                return None
            self._patienter(essai)
        self.echecs += 1
        return None

    def _recul(self, essai: int) -> float:
        return min(ATTENTE_MAX, 2.0 ** essai)

    def _patienter(self, essai: int) -> None:
        if essai < self.essais:
            time.sleep(self._recul(essai))

    @staticmethod
    def _retry_after(reponse) -> float | None:
        valeur = reponse.headers.get("Retry-After")
        if not valeur:
            return None
        try:
            return min(ATTENTE_MAX, float(valeur))
        except ValueError:
            return None
