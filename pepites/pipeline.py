#!/usr/bin/env python3
"""L'enchaînement des étages. Un entonnoir, et l'ordre est l'optimisation.

**Le calcul gratuit filtre avant les appels payés en quota.** GoPlus répond
trente fois par minute ; on ne peut pas lui soumettre neuf cents jetons, et on
n'a pas à le faire. Le radar rend quelques centaines de candidats, la
convergence les note sans toucher au réseau, et seuls les mieux notés
mériteront, à l'étage suivant, qu'on dépense un appel de sécurité sur eux.

La lecture de la mémoire précède l'écriture, et c'est un détail qui compte : le
relevé qu'on s'apprête à écrire ne doit pas servir à confirmer le candidat qui
le produit. Un signal se confirmerait alors tout seul, contre lui-même, à chaque
scan — et la persistance, qui est le meilleur filtre anti-faux-signal de
l'outil, ne filtrerait plus rien.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone

from core.modeles import Observation
from core.reglages import Reglages
from core.reseau import ClientHttp
from core.stockage import Memoire
from skills import convergence, radar
from sources import dexscreener

JOURNAL = logging.getLogger("pepites.pipeline")


@dataclass
class Resultat:
    observations: list[Observation]        # triées, la meilleure note en tête
    bilan: radar.Bilan
    debut: datetime
    secondes: float
    appels: int


def scanner(reglages: Reglages, memoire: Memoire, client: ClientHttp | None = None,
            moment: datetime | None = None) -> Resultat:
    debut = moment or datetime.now(timezone.utc)
    depart = time.monotonic()
    client = client or ClientHttp(dexscreener.DEBITS)

    candidats, bilan = radar.scanner(client, reglages, memoire, debut)

    seuil_signal = reglages.bouclier.note_minimale_pour_analyser
    observations: list[Observation] = []
    for candidat in candidats:
        precedent = memoire.dernier_releve(candidat.jeton.identite, avant=debut)
        observation = convergence.observer(
            candidat, reglages.convergence, precedent, seuil_signal
        )
        observations.append(observation)
        memoire.enregistrer(candidat, observation.metriques, observation.note.total, debut)

    observations.sort(key=lambda o: o.note.total, reverse=True)
    secondes = time.monotonic() - depart
    JOURNAL.info(
        "scan terminé en %.0f s : %d candidats notés, %d confirmés",
        secondes, len(observations), sum(1 for o in observations if o.confirme),
    )
    return Resultat(
        observations=observations, bilan=bilan, debut=debut,
        secondes=secondes, appels=client.appels,
    )
