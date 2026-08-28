#!/usr/bin/env python3
"""Stops dynamiques et prise de bénéfice suiveuse.

**Le stop est calculé sur la volatilité de l'actif, pas sur un pourcentage
fixe.** Un stop à 5 % sur Bitcoin est un stop serré ; le même sur une pépite est
touché par le bruit d'une nuit calme. La distance est donc un multiple de l'ATR,
ce qui la fait respirer avec le marché sans qu'aucune table par actif n'existe.

**La prise de bénéfice suiveuse ne recule jamais.** Elle s'arme au-delà d'un
gain donné, puis suit le plus haut atteint à distance fixe. C'est pour cela que
`Position.plus_haut_atteint` est stocké : recalculer le plus haut depuis les
bougies rendrait le niveau dépendant de la profondeur d'historique disponible,
et un redémarrage du bot desserrerait silencieusement tous les stops.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from ..core.config import ConfigRisque
from ..core.modeles import Position


class Declencheur(str, Enum):
    AUCUN = "aucun"
    STOP = "stop"
    TRAILING = "trailing"


@dataclass(frozen=True, slots=True)
class NiveauxSortie:
    stop: float | None
    trailing: float | None
    declencheur: Declencheur
    raison: str = ""

    @property
    def doit_sortir(self) -> bool:
        return self.declencheur is not Declencheur.AUCUN


def stop_initial(prix_entree: float, atr: float | None, config: ConfigRisque) -> float | None:
    """Le stop posé à l'ouverture. Sans ATR, pas de stop : on préfère ne pas en
    poser qu'en poser un arbitraire, parce que le dimensionnement de position
    lit ce nombre et qu'un stop inventé donnerait une taille inventée."""

    if atr is None or atr <= 0:
        return None
    return max(prix_entree - atr * config.atr_multiple_stop, 0.0)


def evaluer(
    position: Position, prix: float, atr: float | None, config: ConfigRisque
) -> NiveauxSortie:
    """Décide si la position doit sortir, et par quel mécanisme."""

    stop = stop_initial(position.prix_moyen, atr, config)
    gain = position.pnl_relatif(prix)
    plus_haut = max(position.plus_haut_atteint, prix)

    trailing: float | None = None
    if plus_haut > 0 and (plus_haut - position.prix_moyen) / position.prix_moyen >= config.trailing_activation:
        trailing = plus_haut * (1.0 - config.trailing_distance)

    # Le trailing est examiné en premier : quand les deux sont franchis, on
    # sort en bénéfice et c'est ce qu'il faut raconter. Annoncer un stop-loss
    # sur une position gagnante est une erreur de journal qui fausse toute
    # lecture ultérieure des performances.
    if trailing is not None and prix <= trailing:
        return NiveauxSortie(
            stop=stop, trailing=trailing, declencheur=Declencheur.TRAILING,
            raison=(
                f"prise de bénéfice suiveuse : {prix:.4g} sous {trailing:.4g} "
                f"(plus haut {plus_haut:.4g}, gain conservé {gain:+.1%})"
            ),
        )

    if stop is not None and prix <= stop:
        return NiveauxSortie(
            stop=stop, trailing=trailing, declencheur=Declencheur.STOP,
            raison=(
                f"stop touché : {prix:.4g} sous {stop:.4g} "
                f"({config.atr_multiple_stop:g} ATR sous l'entrée, perte {gain:+.1%})"
            ),
        )

    return NiveauxSortie(stop=stop, trailing=trailing, declencheur=Declencheur.AUCUN)
