#!/usr/bin/env python3
"""DCA dynamique : combien acheter, et quand ne pas acheter.

Le DCA classique achète le même montant à date fixe. Sa force est de retirer la
décision à l'humain ; sa faiblesse est d'acheter autant à 69 000 qu'à 16 000.
Le DCA dynamique garde le calendrier — donc la discipline — et ne fait varier
que le **montant**, selon la zone de valorisation.

Deux gardes-fous que l'expérience impose :

**Le multiplicateur est borné**, en haut comme en bas. Sans borne haute, un
enchaînement peur extrême + sous l'EMA 200 + score à 95 produit un achat de six
fois l'enveloppe, c'est-à-dire six semaines de budget d'un coup, juste avant le
mois où la peur devient extrême pour de bon. Le plafond est ce qui garantit
qu'il restera de la trésorerie au creux suivant.

**Zéro est une décision, pas une panne.** En avidité extrême, le multiplicateur
vaut 0 et le système *temporise* : le montant non dépensé reste en trésorerie
et gonfle mécaniquement les achats futurs. C'est pour ça que `Action.TEMPORISER`
existe séparément d'`Action.ATTENDRE` — l'un se raconte dans le récapitulatif,
l'autre non.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from ..core.config import ConfigDCA
from ..core.modeles import Action, Score, Zone, borner
from .indicateurs import Lecture


@dataclass(frozen=True, slots=True)
class Enveloppe:
    """Ce que le DCA décide pour un actif à un instant donné."""

    action: Action
    montant_usd: float
    multiplicateur: float
    zone: Zone
    raisons: tuple[str, ...]


def echeance_atteinte(cadence: str, derniere: datetime | None, maintenant: datetime) -> bool:
    """Le calendrier, séparé du montant.

    Volontairement calendaire et non « toutes les N heures » : un DCA
    hebdomadaire doit tomber le même jour de semaine même si une passe a été
    manquée pour cause de coupure. Une comptabilité en heures dérive d'un jour
    par mois, et la dérive rend les comparaisons de performance fausses.
    """

    # La cadence est validée avant le cas « jamais passé », sinon une cadence
    # inconnue passe inaperçue au premier lancement et ne lève qu'à la
    # deuxième passe — c'est-à-dire une semaine plus tard, en production.
    if cadence not in ("quotidienne", "hebdomadaire", "mensuelle"):
        raise ValueError(f"Cadence DCA inconnue : {cadence!r}.")
    if derniere is None:
        return True
    if cadence == "quotidienne":
        return maintenant.date() > derniere.date()
    if cadence == "hebdomadaire":
        return _lundi(maintenant.date()) > _lundi(derniere.date())
    return (maintenant.year, maintenant.month) > (derniere.year, derniere.month)


def _lundi(jour: date) -> date:
    return jour - timedelta(days=jour.weekday())


def multiplicateur(
    zone: Zone, lecture: Lecture, score: Score, config: ConfigDCA
) -> tuple[float, list[str]]:
    """Le cœur du réglage : zone × moyennes mobiles × score, puis bornes."""

    raisons: list[str] = []
    facteur = config.multiplicateurs_zone.get(zone.value, 1.0)
    raisons.append(f"zone {zone.value.replace('_', ' ')} → ×{facteur:g}")

    # Une seule prime de moyenne mobile, la plus favorable : cumuler « sous
    # l'EMA 50 » et « sous l'EMA 200 » double la prime alors que le second
    # implique presque toujours le premier — ce serait compter deux fois le
    # même fait.
    if lecture.sous_ema_longue:
        facteur *= config.bonus_sous_ema_longue
        raisons.append(f"sous l'EMA longue → ×{config.bonus_sous_ema_longue:g}")
    elif lecture.sous_ema_moyenne:
        facteur *= config.bonus_sous_ema_moyenne
        raisons.append(f"sous l'EMA moyenne → ×{config.bonus_sous_ema_moyenne:g}")
    elif lecture.ema_longue is not None and lecture.prix > lecture.ema_longue * 1.25:
        facteur *= config.malus_au_dessus_ema_longue
        raisons.append(f"25 % au-dessus de l'EMA longue → ×{config.malus_au_dessus_ema_longue:g}")

    # Le score module autour de 1.0, avec une influence bornée par la config :
    # à influence 0.3, un score de 100 donne ×1.3 et un score de 0 donne ×0.7.
    #
    # Le plafond de 1/3 n'est pas arbitraire. Pour que la zone reste dominante,
    # il faut que la peur extrême au pire score achète encore plus que le neutre
    # au meilleur : 2(1−i) > 1(1+i), donc i < 1/3. Au-delà, le score prend la
    # main sur la valorisation, et c'est exactement ce qu'un DCA doit refuser —
    # le score est le plus bruyant des deux signaux.
    ecart = (score.total - 50.0) / 50.0
    facteur *= 1.0 + ecart * config.influence_score
    raisons.append(f"indice de confiance {score.total:.0f}/100")

    return borner(facteur, config.multiplicateur_min, config.multiplicateur_max), raisons


def planifier(
    *,
    enveloppe_usd: float,
    poids_actif: float,
    zone: Zone,
    lecture: Lecture,
    score: Score,
    config: ConfigDCA,
    echeance: bool,
) -> Enveloppe:
    """Rend l'enveloppe d'achat pour un actif, calendrier compris."""

    facteur, raisons = multiplicateur(zone, lecture, score, config)
    montant = enveloppe_usd * poids_actif * facteur

    if not echeance:
        return Enveloppe(
            action=Action.ATTENDRE, montant_usd=0.0, multiplicateur=facteur,
            zone=zone, raisons=("hors échéance du calendrier DCA",),
        )

    if score.total < config.score_minimum_achat:
        return Enveloppe(
            action=Action.TEMPORISER, montant_usd=0.0, multiplicateur=facteur, zone=zone,
            raisons=tuple(
                raisons + [
                    f"indice {score.total:.0f} sous le plancher d'achat "
                    f"{config.score_minimum_achat:.0f} : montant reporté"
                ]
            ),
        )

    if facteur <= 0.0:
        return Enveloppe(
            action=Action.TEMPORISER, montant_usd=0.0, multiplicateur=0.0, zone=zone,
            raisons=tuple(raisons + ["multiplicateur nul : achat reporté, trésorerie conservée"]),
        )

    if montant < config.montant_minimum_usd:
        return Enveloppe(
            action=Action.TEMPORISER, montant_usd=0.0, multiplicateur=facteur, zone=zone,
            raisons=tuple(
                raisons + [
                    f"{montant:.2f} $ sous le minimum de {config.montant_minimum_usd:g} $ : "
                    "les frais mangeraient l'achat"
                ]
            ),
        )

    return Enveloppe(
        action=Action.ACHETER, montant_usd=montant, multiplicateur=facteur,
        zone=zone, raisons=tuple(raisons),
    )
