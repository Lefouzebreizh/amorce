#!/usr/bin/env python3
"""Dimensionnement des positions.

**Le montant d'un achat ne se décide pas sur la conviction, il se décide sur la
distance au stop.** C'est la seule règle de ce fichier, et c'est celle qui
sépare un portefeuille qui survit à une série de pertes d'un portefeuille qui
n'y survit pas.

La formule : on accepte de perdre `risque_par_position` du capital si le stop
est touché. La quantité est donc `capital × risque / (prix − stop)`. Un actif
volatil a un stop plus loin, donc une position plus petite, **automatiquement**
— sans qu'aucune table par actif n'ait à être tenue à jour.

Quatre plafonds s'appliquent ensuite, et le plus contraignant gagne :
l'enveloppe DCA du jour, la trésorerie disponible, l'exposition maximale par
actif, et le plafond spécifique des jetons découverts par le scanner.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..core.config import ConfigPortefeuille, ConfigRisque
from ..core.modeles import Portefeuille


@dataclass(frozen=True, slots=True)
class Dimension:
    """Le montant retenu, et lequel des plafonds a mordu.

    Savoir *quel* plafond a réduit l'ordre est ce qui permet de régler le
    système : un montant divisé par quatre sans explication est un montant
    qu'on finit par forcer à la main.
    """

    montant_usd: float
    quantite: float
    plafond_actif: str
    detail: tuple[str, ...]


def dimensionner(
    *,
    montant_souhaite_usd: float,
    prix: float,
    stop: float | None,
    portefeuille: Portefeuille,
    valeur_totale_usd: float,
    actif: str,
    config_risque: ConfigRisque,
    config_portefeuille: ConfigPortefeuille,
    plafond_specifique_usd: float | None = None,
) -> Dimension:
    """Rend le montant réellement passable, et pourquoi."""

    if prix <= 0:
        raise ValueError(f"{actif} : prix nul ou négatif, rien à dimensionner.")

    detail: list[str] = []
    montant = montant_souhaite_usd
    plafond_actif = "enveloppe DCA"

    # 1. Le risque par position, quand un stop est calculable.
    if stop is not None and stop < prix:
        risque_unitaire = prix - stop
        quantite_max = (valeur_totale_usd * config_risque.risque_par_position) / risque_unitaire
        plafond_risque = quantite_max * prix
        detail.append(
            f"risque {config_risque.risque_par_position:.1%} du capital, "
            f"stop à {stop:.4g} → {plafond_risque:.2f} $"
        )
        if plafond_risque < montant:
            montant = plafond_risque
            plafond_actif = "risque par position"
    else:
        detail.append("pas de stop calculable : le plafond de risque ne s'applique pas")

    # 2. L'exposition maximale par actif, tous renforcements compris.
    position = portefeuille.positions.get(actif)
    deja = position.valeur(prix) if position else 0.0
    plafond_exposition = valeur_totale_usd * config_risque.exposition_max_par_actif - deja
    detail.append(
        f"exposition max {config_risque.exposition_max_par_actif:.0%} "
        f"→ encore {max(plafond_exposition, 0.0):.2f} $"
    )
    if plafond_exposition < montant:
        montant = max(plafond_exposition, 0.0)
        plafond_actif = "exposition par actif"

    # 3. Le plafond des jetons découverts, quand il s'agit d'un.
    if plafond_specifique_usd is not None:
        restant = plafond_specifique_usd - deja
        detail.append(f"plafond du jeton découvert → encore {max(restant, 0.0):.2f} $")
        if restant < montant:
            montant = max(restant, 0.0)
            plafond_actif = "plafond du jeton découvert"

    # 4. La trésorerie, en dernier — c'est le plafond dur, celui qu'aucun
    # réglage ne desserre.
    if portefeuille.liquidites_usd < montant:
        montant = max(portefeuille.liquidites_usd, 0.0)
        plafond_actif = "trésorerie disponible"
        detail.append(f"trésorerie {portefeuille.liquidites_usd:.2f} $")

    return Dimension(
        montant_usd=montant,
        quantite=montant / prix,
        plafond_actif=plafond_actif,
        detail=tuple(detail),
    )
