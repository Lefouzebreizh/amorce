#!/usr/bin/env python3
"""Lecture des séries passées, et fabrication de scénarios connus.

Deux sources, et elles ne servent pas à la même chose.

**Un CSV de bougies** sert à mesurer la stratégie sur un marché réel. Le format
attendu est celui que rendent la plupart des plateformes et `ccxt` :
`horodatage,ouverture,haut,bas,cloture,volume`, une ligne par bougie, la plus
ancienne en premier. L'horodatage est accepté en millisecondes, en secondes ou
en ISO 8601 — les trois circulent, et refuser deux d'entre elles ferait
convertir à la main un fichier sur deux.

**Un scénario fabriqué** sert à mesurer l'effet d'un *réglage*. Un marché réel
mélange tout ; un scénario ne contient qu'une chose — une chute, un sommet, un
marché plat — et c'est ce qui permet de dire « ce seuil-ci a fait tomber la
note du profil accumulation de 100 à 48 ». C'est la leçon du radar `pepites/`
du même dépôt, dont `profils.py` fait exactement cela.

Les scénarios sont **déterministes** : même graine, même série, à la bougie
près. Un profil qui bouge d'une exécution à l'autre ne mesure rien.
"""

from __future__ import annotations

import csv
import math
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

from ..core.modeles import Bougie, SerieOHLCV

COLONNES = ("horodatage", "ouverture", "haut", "bas", "cloture", "volume")


class DonneesIllisibles(Exception):
    """Le fichier existe mais ne dit pas ce qu'on croit."""


def _instant(brut: str) -> datetime:
    """Accepte les millisecondes, les secondes et l'ISO 8601.

    Le seuil de discrimination est 10^11 : une date en secondes ne le dépasse
    pas avant l'an 5138, une date en millisecondes le dépasse depuis 1973.
    Deviner sur la longueur de la chaîne échouerait sur les horodatages
    anciens, qui ont un chiffre de moins.
    """

    brut = brut.strip()
    try:
        nombre = float(brut)
    except ValueError:
        try:
            date = datetime.fromisoformat(brut.replace("Z", "+00:00"))
        except ValueError as erreur:
            raise DonneesIllisibles(f"Horodatage illisible : {brut!r}.") from erreur
        return date if date.tzinfo else date.replace(tzinfo=timezone.utc)
    if nombre > 1e11:
        nombre /= 1000.0
    return datetime.fromtimestamp(nombre, tz=timezone.utc)


def lire_csv(chemin: Path | str, *, symbole: str, intervalle: str = "4h") -> SerieOHLCV:
    """Charge une série depuis un CSV. Lève plutôt que de deviner.

    Une ligne mal formée **arrête la lecture** au lieu d'être sautée : sur des
    données de marché, une ligne avalée en silence décale tout ce qui suit et
    produit un rejeu qui a l'air juste. Mieux vaut refuser le fichier.
    """

    chemin = Path(chemin)
    if not chemin.exists():
        raise DonneesIllisibles(f"Fichier introuvable : {chemin}")

    bougies: list[Bougie] = []
    with chemin.open(encoding="utf-8", newline="") as f:
        lecteur = csv.reader(f)
        entete = next(lecteur, None)
        if entete is None:
            raise DonneesIllisibles(f"{chemin} est vide.")
        # En-tête toléré mais pas exigé : `ccxt` n'en met pas, les exports
        # manuels en mettent un.
        premiere = None
        if not entete[0].strip().replace(".", "").replace("-", "").isdigit():
            if len(entete) < 6:
                raise DonneesIllisibles(
                    f"{chemin} : six colonnes attendues ({', '.join(COLONNES)}), "
                    f"{len(entete)} trouvée(s)."
                )
        else:
            premiere = entete

        lignes = ([premiere] if premiere else []) + list(lecteur)
        for numero, ligne in enumerate(lignes, start=1):
            if not ligne or not "".join(ligne).strip():
                continue
            if len(ligne) < 6:
                raise DonneesIllisibles(
                    f"{chemin} ligne {numero} : six colonnes attendues, {len(ligne)} trouvée(s)."
                )
            try:
                bougies.append(
                    Bougie(
                        horodatage=_instant(ligne[0]),
                        ouverture=float(ligne[1]),
                        haut=float(ligne[2]),
                        bas=float(ligne[3]),
                        cloture=float(ligne[4]),
                        volume=float(ligne[5]),
                    )
                )
            except (ValueError, TypeError) as erreur:
                raise DonneesIllisibles(f"{chemin} ligne {numero} : {erreur}") from erreur

    if not bougies:
        raise DonneesIllisibles(f"{chemin} ne contient aucune bougie.")
    return SerieOHLCV(symbole=symbole, intervalle=intervalle, bougies=tuple(bougies))


def lire_fear_greed(chemin: Path | str) -> dict[str, int]:
    """Historique de l'indice, indexé par date ISO (`AAAA-MM-JJ`).

    Indexé par **jour** et non par bougie : l'indice est publié une fois par
    jour, et le rapporter à une bougie de 4 h obligerait à choisir laquelle des
    six porte la valeur. Le rejeu prend la valeur du jour de la bougie.
    """

    chemin = Path(chemin)
    if not chemin.exists():
        raise DonneesIllisibles(f"Fichier introuvable : {chemin}")
    valeurs: dict[str, int] = {}
    with chemin.open(encoding="utf-8", newline="") as f:
        for ligne in csv.reader(f):
            if len(ligne) < 2:
                continue
            try:
                jour = _instant(ligne[0]).date().isoformat()
                valeurs[jour] = int(float(ligne[1]))
            except (ValueError, DonneesIllisibles):
                continue  # en-tête ou ligne de commentaire
    if not valeurs:
        raise DonneesIllisibles(f"{chemin} ne contient aucun indice lisible.")
    return valeurs


# --------------------------------------------------------------------------
# Scénarios fabriqués
# --------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Scenario:
    """Un marché connu, fabriqué pour isoler un comportement."""

    nom: str
    description: str
    serie: SerieOHLCV
    fear_greed: dict[str, int]

    @property
    def rendement_marche(self) -> float:
        clotures = self.serie.clotures
        return clotures[-1] / clotures[0] - 1.0

    @property
    def prix_moyen_marche(self) -> float:
        """Le prix moyen de la période. C'est l'étalon d'un DCA : acheter en
        dessous, c'est faire mieux que le hasard ; acheter au-dessus, c'est
        faire pire qu'un ordre permanent."""

        clotures = self.serie.clotures
        return sum(clotures) / len(clotures)


def _fabriquer(
    nom: str,
    description: str,
    forme,
    peur,
    *,
    nombre: int = 600,
    depart: float = 100.0,
    graine: int = 20260828,
    intervalle_heures: int = 4,
    debut: datetime | None = None,
) -> Scenario:
    """Fabrique une série depuis une fonction de forme et une fonction de peur.

    Le bruit est tiré d'un générateur **à graine fixe** : deux exécutions
    rendent la même série à la bougie près. Sans cela, un profil bougerait d'un
    lancement à l'autre et on attribuerait à un réglage ce qui vient du hasard.
    """

    alea = random.Random(graine)
    debut = debut or datetime(2024, 1, 1, tzinfo=timezone.utc)
    bougies: list[Bougie] = []
    indices: dict[str, int] = {}

    for i in range(nombre):
        base = depart * forme(i / max(nombre - 1, 1))
        bruit = 1.0 + alea.uniform(-0.012, 0.012)
        cloture = max(base * bruit, 0.01)
        amplitude = cloture * alea.uniform(0.004, 0.02)
        horodatage = debut + timedelta(hours=intervalle_heures * i)
        ouverture = bougies[-1].cloture if bougies else cloture
        bougies.append(
            Bougie(
                horodatage=horodatage,
                ouverture=ouverture,
                haut=max(ouverture, cloture) + amplitude,
                bas=max(min(ouverture, cloture) - amplitude, 0.001),
                cloture=cloture,
                volume=1000.0 * (1.0 + alea.uniform(-0.3, 0.6)),
            )
        )
        indices[horodatage.date().isoformat()] = int(peur(i / max(nombre - 1, 1)))

    return Scenario(
        nom=nom,
        description=description,
        serie=SerieOHLCV(symbole="TEST/USDT", intervalle=f"{intervalle_heures}h",
                         bougies=tuple(bougies)),
        fear_greed=indices,
    )


def scenarios() -> list[Scenario]:
    """Les six marchés de référence.

    Ils ne prétendent pas ressembler à un marché réel : ils isolent chacun un
    comportement, et c'est ce qui rend leur lecture utile. Un rejeu sur données
    réelles mélange les six et ne dit plus lequel a bougé.
    """

    return [
        _fabriquer(
            "chute puis reprise",
            "−70 % en marché baissier, puis retour au départ. Le cas pour lequel "
            "un DCA dynamique existe : il doit acheter beaucoup dans le creux.",
            lambda t: 1.0 - 0.7 * math.sin(math.pi * t) ** 2 * (1 if t < 0.5 else 1),
            lambda t: 50 - 40 * math.sin(math.pi * t) ** 2,
        ),
        _fabriquer(
            "hausse continue",
            "×3 sans creux. Le cas défavorable : temporiser coûte cher, et la "
            "mesure doit le montrer plutôt que de le cacher.",
            lambda t: 1.0 + 2.0 * t,
            lambda t: 45 + 45 * t,
        ),
        _fabriquer(
            "sommet puis effondrement",
            "×2,5 puis −80 %. Le cas où la temporisation en avidité extrême et "
            "les stops doivent payer.",
            lambda t: 1.0 + 1.5 * math.sin(math.pi * min(t * 1.4, 1.0)) if t < 0.45
            else (2.5 - 2.0 * ((t - 0.45) / 0.55)),
            lambda t: 20 + 75 * math.sin(math.pi * min(t * 1.1, 1.0)),
        ),
        _fabriquer(
            "marché plat",
            "±3 % pendant toute la période. Rien ne devrait se déclencher, et "
            "surtout pas les stops : le bruit ne doit pas coûter de frais.",
            lambda t: 1.0 + 0.03 * math.sin(t * 18),
            lambda t: 50,
        ),
        _fabriquer(
            "effondrement sans reprise",
            "−85 % en ligne droite. Le cas où le coupe-circuit et les stops "
            "décident seuls du résultat.",
            lambda t: 1.0 - 0.85 * t,
            lambda t: 45 - 35 * t,
        ),
        _fabriquer(
            "creux profond isolé",
            "Plat, un −60 % d'un mois, puis plat à nouveau. Le cas qui mesure "
            "si le DCA sait concentrer ses achats sur une fenêtre courte.",
            lambda t: 1.0 - 0.6 * math.exp(-(((t - 0.5) / 0.06) ** 2)),
            lambda t: 50 - 35 * math.exp(-(((t - 0.5) / 0.06) ** 2)),
        ),
    ]
