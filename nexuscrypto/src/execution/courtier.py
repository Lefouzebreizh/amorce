#!/usr/bin/env python3
"""Courtiers : la simulation d'abord, le réel ensuite.

**La simulation est réaliste ou elle ne sert à rien.** Un simulateur qui exécute
au prix affiché, sans frais ni glissement, produit une courbe de performance qui
n'a aucun rapport avec ce qui arriverait, et cette courbe est ensuite utilisée
pour régler des seuils. Trois choses sont donc modélisées :

1. **Les frais**, au taux d'un compte sans remise — pas au taux VIP qu'on
   n'aura jamais.
2. **Le glissement**, calculé en *parcourant le carnet* quand il est
   disponible : un ordre qui dépasse la première ligne paie la deuxième. Sans
   carnet, un taux de base sert de repli, et l'exécution le dit.
3. **L'exécution partielle**, quand l'ordre dépasse la part du carnet
   configurée. C'est le cas le plus instructif : sur une pépite, un ordre de
   500 $ peut ne se remplir qu'à moitié, et une simulation qui l'ignore promet
   des positions qu'on ne pourra pas prendre.

Le courtier réel (`CourtierCCXT`) importe `ccxt` à la construction, jamais au
chargement du module : la simulation doit pouvoir tourner sur une machine où
rien n'est installé.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from ..core.config import ConfigExecution
from ..core.journal import obtenir
from ..core.modeles import CarnetOrdres, Execution, Ordre, Sens, TypeOrdre, maintenant

_journal = obtenir("execution.courtier")


class OrdreRefuse(Exception):
    """L'ordre n'a pas été passé, et le portefeuille n'a pas bougé."""


class Courtier(Protocol):
    """Ce que le gestionnaire d'ordres attend. Deux implémentations : papier et
    réel. Aucune autre partie du système ne sait laquelle est branchée."""

    simule: bool

    async def passer(
        self, ordre: Ordre, *, prix_reference: float, carnet: CarnetOrdres | None = None
    ) -> Execution: ...


def _parcourir_carnet(
    lignes: tuple[tuple[float, float], ...], quantite: float
) -> tuple[float, float]:
    """Consomme le carnet et rend (prix moyen pondéré, quantité obtenue).

    Rend une quantité inférieure à celle demandée quand le carnet s'épuise —
    c'est l'exécution partielle, et c'est exactement l'information qu'une
    simulation naïve efface.
    """

    restante = quantite
    cout = 0.0
    obtenue = 0.0
    for prix, disponible in lignes:
        if restante <= 0:
            break
        prise = min(restante, disponible)
        cout += prise * prix
        obtenue += prise
        restante -= prise
    if obtenue <= 0:
        return 0.0, 0.0
    return cout / obtenue, obtenue


@dataclass
class CourtierPapier:
    """Simulation. C'est le courtier par défaut du système."""

    config: ConfigExecution
    simule: bool = True
    horloge: object = None  # callable rendant un datetime ; injectable pour les tests

    def _instant(self) -> datetime:
        return self.horloge() if callable(self.horloge) else maintenant()

    async def passer(
        self, ordre: Ordre, *, prix_reference: float, carnet: CarnetOrdres | None = None
    ) -> Execution:
        if prix_reference <= 0:
            raise OrdreRefuse(f"{ordre.actif} : prix de référence invalide ({prix_reference}).")

        simulation = self.config.simulation
        quantite = ordre.quantite
        lignes = None
        if carnet is not None:
            lignes = carnet.ventes if ordre.sens is Sens.ACHAT else carnet.achats

        # `None` (aucun carnet) et `()` (carnet présent mais côté vide) sont
        # deux situations opposées : la première appelle le repli sur un taux de
        # base, la seconde dit qu'il n'y a **aucune** liquidité en face. Les
        # confondre faisait passer un ordre au taux de base sur une paire où
        # personne ne vend, ce qui est le pire mensonge qu'une simulation puisse
        # produire.
        if lignes is not None:
            if not lignes:
                raise OrdreRefuse(f"{ordre.actif} : carnet vide du côté demandé.")
            profondeur = sum(q for _, q in lignes)
            plafond = profondeur * simulation.part_carnet_max
            if quantite > plafond:
                _journal.info(
                    "%s : ordre de %.6g réduit à %.6g — au-delà de %.0f %% du carnet visible.",
                    ordre.actif, quantite, plafond, simulation.part_carnet_max * 100,
                )
                quantite = plafond
            prix_moyen, obtenue = _parcourir_carnet(lignes, quantite)
            if obtenue <= 0:
                raise OrdreRefuse(f"{ordre.actif} : carnet sans profondeur exploitable.")
        else:
            # Repli sans carnet : glissement de base, augmenté d'un impact
            # proportionnel à la racine du montant. La racine plutôt que le
            # linéaire parce que c'est ce que montrent les mesures d'impact de
            # marché — un ordre dix fois plus gros glisse trois fois plus, pas
            # dix fois.
            impact = simulation.glissement_base * (max(quantite * prix_reference, 1.0) / 1000.0) ** 0.5
            sens = 1.0 if ordre.sens is Sens.ACHAT else -1.0
            prix_moyen = prix_reference * (1.0 + sens * (simulation.glissement_base + impact))
            obtenue = quantite

        if ordre.type_ordre is TypeOrdre.LIMITE and ordre.prix_limite is not None:
            depasse = (
                ordre.sens is Sens.ACHAT and prix_moyen > ordre.prix_limite
            ) or (ordre.sens is Sens.VENTE and prix_moyen < ordre.prix_limite)
            if depasse:
                raise OrdreRefuse(
                    f"{ordre.actif} : prix simulé {prix_moyen:.6g} au-delà de la limite "
                    f"{ordre.prix_limite:.6g}."
                )

        glissement = (prix_moyen - prix_reference) / prix_reference
        if ordre.sens is Sens.VENTE:
            glissement = -glissement
        if glissement > self.config.glissement_max_tolere:
            raise OrdreRefuse(
                f"{ordre.actif} : glissement de {glissement:.2%} au-delà du toléré "
                f"({self.config.glissement_max_tolere:.2%}) — ordre annulé plutôt "
                "qu'exécuté à n'importe quel prix."
            )

        taux = (
            simulation.frais_maker
            if ordre.type_ordre is TypeOrdre.LIMITE
            else simulation.frais_taker
        )
        return Execution(
            ordre=ordre,
            prix_execute=prix_moyen,
            quantite_executee=obtenue,
            frais_usd=prix_moyen * obtenue * taux,
            horodatage=self._instant(),
            glissement=glissement,
            simule=True,
        )


class CourtierCCXT:
    """Courtier réel, via CCXT. Construit uniquement en mode production.

    Deux précautions qui ne sont pas négociables :

    - `ccxt` est importé **ici**, dans le constructeur. Le module doit pouvoir
      être lu et testé sur une machine où la bibliothèque n'existe pas.
    - Les clés sont lues depuis les secrets et **jamais** journalisées. Le
      filtre de `core/journal.py` en attrape une partie ; ne pas les écrire du
      tout en attrape le reste.
    """

    simule = False

    def __init__(self, plateforme: str, cle: str, secret: str, config: ConfigExecution) -> None:
        try:
            import ccxt.async_support as ccxt
        except ImportError as erreur:  # pragma: no cover - dépend de l'installation
            raise OrdreRefuse(
                "ccxt n'est pas installé : le mode production est indisponible. "
                "`pip install -r requirements.txt`."
            ) from erreur
        if not hasattr(ccxt, plateforme):
            raise OrdreRefuse(f"Plateforme inconnue de CCXT : {plateforme!r}.")
        self.config = config
        self.plateforme = plateforme
        self._client = getattr(ccxt, plateforme)(
            {"apiKey": cle, "secret": secret, "enableRateLimit": True}
        )

    async def fermer(self) -> None:
        await self._client.close()

    async def passer(
        self, ordre: Ordre, *, prix_reference: float, carnet: CarnetOrdres | None = None
    ) -> Execution:
        cote = "buy" if ordre.sens is Sens.ACHAT else "sell"
        try:
            if ordre.type_ordre is TypeOrdre.LIMITE:
                brut = await self._client.create_limit_order(
                    ordre.actif, cote, ordre.quantite, ordre.prix_limite
                )
            else:
                brut = await self._client.create_market_order(ordre.actif, cote, ordre.quantite)
        except Exception as erreur:  # ccxt lève une hiérarchie qui lui est propre
            raise OrdreRefuse(f"{ordre.actif} : refus de la plateforme — {erreur}") from erreur

        # `average` est absent chez certaines plateformes tant que l'ordre n'est
        # pas complètement rempli : on retombe sur `price`, puis sur le prix de
        # référence. Sans ce repli, un ordre pourtant passé lève sur un `None`.
        prix = brut.get("average") or brut.get("price") or prix_reference
        rempli = brut.get("filled") or ordre.quantite
        frais = (brut.get("fee") or {}).get("cost") or prix * rempli * self.config.simulation.frais_taker
        return Execution(
            ordre=ordre,
            prix_execute=float(prix),
            quantite_executee=float(rempli),
            frais_usd=float(frais),
            horodatage=maintenant(),
            glissement=(float(prix) - prix_reference) / prix_reference if prix_reference else 0.0,
            simule=False,
        )
