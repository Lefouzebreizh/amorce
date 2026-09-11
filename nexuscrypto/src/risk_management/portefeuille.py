#!/usr/bin/env python3
"""État du capital et application des exécutions.

Le portefeuille est **immuable** : appliquer une exécution rend un nouveau
portefeuille. C'est ce qui permet de rejouer une journée entière de décisions
sur une copie, de comparer, puis de garder ou de jeter — et c'est ce qui rend
la simulation exacte plutôt qu'approchée.

Retiré le 10/09/2026, avec le DCA calendaire qui seul en avait besoin : la
dérive par rapport à une allocation cible (`Derive`, `derives`,
`doit_reequilibrer`). Sans poids cible, un écart à une cible n'a plus de sens
à mesurer — le moteur d'opportunité pure ordonne ses actifs autrement, voir
`Orchestrateur._ordre_de_service`.
"""

from __future__ import annotations

from dataclasses import replace

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


def ordre_par_engagement(
    portefeuille: Portefeuille, prix: dict[str, float], symboles
) -> list[str]:
    """Ordonne des actifs par valeur engagée croissante — absents ou plus
    petites lignes en tête.

    Remplace, depuis le retrait du DCA calendaire (10/09/2026), l'ancien tri
    par dérive vers un poids cible (`derives`, retiré le même jour) : sans
    cible, rien ne peut plus dériver. Ce qui reste utile est plus modeste —
    quand la trésorerie ne suffit pas pour servir tout le monde, mieux vaut
    répartir l'occasion que la concentrer sur la ligne déjà la plus grosse.
    """

    def valeur(actif: str) -> float:
        position = portefeuille.positions.get(actif)
        if position is None:
            return 0.0
        return position.valeur(prix.get(actif, position.prix_moyen))

    return sorted(symboles, key=valeur)
