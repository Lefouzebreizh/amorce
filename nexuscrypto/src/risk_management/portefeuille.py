#!/usr/bin/env python3
"""État du capital, dérive par rapport à l'allocation cible, application des
exécutions.

Le portefeuille est **immuable** : appliquer une exécution rend un nouveau
portefeuille. C'est ce qui permet de rejouer une journée entière de décisions
sur une copie, de comparer, puis de garder ou de jeter — et c'est ce qui rend
la simulation exacte plutôt qu'approchée.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

from ..core.config import ConfigPortefeuille
from ..core.modeles import Execution, Portefeuille, Position, Sens


class FondsInsuffisants(Exception):
    """Levée avant l'exécution, jamais après. Un ordre qui passe et découvre
    ensuite qu'il n'y a pas la trésorerie laisse un portefeuille incohérent."""


class PositionIntrouvable(Exception):
    """Vendre ce qu'on ne détient pas."""


def appliquer(portefeuille: Portefeuille, execution: Execution) -> Portefeuille:
    """Rend le portefeuille après exécution — frais compris.

    Les frais sont retirés de la trésorerie et **non** intégrés au prix moyen.
    Les intégrer donnerait un prix moyen qui ne correspond à aucun prix réel du
    marché, et tous les calculs de stop, qui partent du prix moyen, seraient
    décalés.
    """

    ordre = execution.ordre
    positions = dict(portefeuille.positions)
    montant = execution.montant_usd

    if ordre.sens is Sens.ACHAT:
        cout = montant + execution.frais_usd
        if cout > portefeuille.liquidites_usd + 1e-9:
            raise FondsInsuffisants(
                f"{ordre.actif} : {cout:.2f} $ nécessaires, "
                f"{portefeuille.liquidites_usd:.2f} $ disponibles."
            )
        existante = positions.get(ordre.actif)
        if existante is None:
            positions[ordre.actif] = Position(
                actif=ordre.actif,
                quantite=execution.quantite_executee,
                prix_moyen=execution.prix_execute,
                ouverte_le=execution.horodatage,
                plus_haut_atteint=execution.prix_execute,
            )
        else:
            positions[ordre.actif] = existante.avec_achat(
                execution.quantite_executee, execution.prix_execute
            )
        return replace(portefeuille, liquidites_usd=portefeuille.liquidites_usd - cout,
                       positions=positions)

    existante = positions.get(ordre.actif)
    if existante is None:
        raise PositionIntrouvable(f"Aucune position sur {ordre.actif} à vendre.")
    if execution.quantite_executee > existante.quantite + 1e-9:
        raise PositionIntrouvable(
            f"{ordre.actif} : vente de {execution.quantite_executee}, "
            f"détenu {existante.quantite}."
        )
    restante = existante.avec_vente(execution.quantite_executee)
    if restante is None:
        positions.pop(ordre.actif)
    else:
        positions[ordre.actif] = restante
    return replace(
        portefeuille,
        liquidites_usd=portefeuille.liquidites_usd + montant - execution.frais_usd,
        positions=positions,
    )


@dataclass(frozen=True, slots=True)
class Derive:
    """Écart entre le poids réel d'une ligne et son poids cible."""

    actif: str
    poids_reel: float
    poids_cible: float

    @property
    def ecart(self) -> float:
        return self.poids_reel - self.poids_cible

    @property
    def sur_pondere(self) -> bool:
        return self.ecart > 0


def derives(
    portefeuille: Portefeuille, prix: dict[str, float], config: ConfigPortefeuille
) -> list[Derive]:
    """Dérive de chaque ligne cible, la plus sous-pondérée en tête.

    L'ordre a un effet direct : quand la trésorerie ne suffit pas pour tout, le
    moteur sert dans cet ordre, donc il comble d'abord le plus grand trou. Un
    ordre alphabétique servirait Bitcoin en premier tous les mois et laisserait
    la ligne la plus en retard toujours en retard.
    """

    reelles = portefeuille.allocation(prix)
    resultat = [
        Derive(actif=symbole, poids_reel=reelles.get(symbole, 0.0), poids_cible=ligne.fraction)
        for symbole, ligne in config.allocation.items()
    ]
    resultat.sort(key=lambda d: d.ecart)
    return resultat


def doit_reequilibrer(derive: Derive, tolerance: float) -> bool:
    """Sous la tolérance, on ne bouge pas : les frais d'un rééquilibrage à 2 %
    coûtent plus que l'imprécision qu'ils corrigent."""

    return abs(derive.ecart) > tolerance
