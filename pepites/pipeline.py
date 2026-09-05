#!/usr/bin/env python3
"""L'enchaînement des cinq skills. Un entonnoir, et l'ordre est l'optimisation.

**Le calcul gratuit filtre avant les appels payés en quota.** GoPlus répond
trente fois par minute ; on ne peut pas lui soumettre neuf cents jetons, et on
n'a pas à le faire. Le radar rend quelques centaines de candidats, la
convergence les note sans toucher au réseau, et seuls les mieux notés — ceux
que la persistance a confirmés — coûtent un appel de sécurité. Le traqueur, le
plus cher des cinq, ne s'exécute que sur ce que le bouclier a laissé passer :
inutile de chercher qui a acheté tôt un jeton dont on ne peut pas sortir.

Deux lectures précèdent leur écriture, pour la même raison à deux étages
différents : le relevé qu'on s'apprête à écrire ne doit pas confirmer le
candidat qui le produit, et le jeton qu'on examine ne doit pas compter dans les
apparitions de ses propres portefeuilles. Dans les deux cas, l'ordre inverse
donnerait un filtre qui ne filtre plus rien tout en ayant l'air de fonctionner.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

from core.modeles import Observation, Pepite, Securite, SmartMoney, Verdict
from core.reglages import Reglages
from core.reseau import ClientHttp
from core.stockage import Memoire
from skills import bouclier, convergence, radar, smart_money, telegram
from sources import dexscreener

JOURNAL = logging.getLogger("pepites.pipeline")

# Un compteur de cadence par point d'entrée : les plafonds n'ont rien de commun
# d'un service à l'autre.
DEBITS = {
    **dexscreener.DEBITS, **bouclier.DEBITS,
    **smart_money.DEBITS, **telegram.DEBITS,
}

NOTE_MAXIMALE = 100.0


@dataclass
class Resultat:
    observations: list[Observation]        # tous les candidats notés, meilleure note en tête
    pepites: list[Pepite]                  # ceux passés au bouclier, note finale en tête
    bilan: radar.Bilan
    debut: datetime
    secondes: float
    appels: int
    alertes: list[Pepite] = field(default_factory=list)

    @property
    def retenues(self) -> list[Pepite]:
        """Les pépites que le bouclier n'a pas rejetées."""
        return [p for p in self.pepites if p.securite.verdict is not Verdict.REJETE]


def _a_verifier(observations: list[Observation], reglages: Reglages) -> list[Observation]:
    """Ce qui mérite qu'on dépense des appels de sécurité dessus."""
    seuil = reglages.bouclier.note_minimale_pour_analyser
    dignes = [o for o in observations
              if o.confirme and not o.note.drapeaux and o.note.total >= seuil]
    return dignes[: reglages.bouclier.candidats_max_par_scan]


def scanner(reglages: Reglages, memoire: Memoire, client: ClientHttp | None = None,
            moment: datetime | None = None, messager: telegram.Messager | None = None) -> Resultat:
    debut = moment or datetime.now(timezone.utc)
    depart = time.monotonic()
    client = client or ClientHttp(DEBITS)

    # --- skill 1 : le radar --------------------------------------------------
    candidats, bilan = radar.scanner(client, reglages, memoire, debut)

    # --- skill 3 : la convergence, sans un seul appel réseau -----------------
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

    # --- le témoin : ce que le radar a écarté, relevé pour comparaison -------
    #
    # Sans lui, le bulletin dit ce que les pépites retenues sont devenues et
    # jamais ce qu'a fait le tout-venant sur la même fenêtre. Or c'est le second
    # chiffre qui décide : dans un marché qui monte, « 60 % de hausses » sur les
    # retenues peut être une contre-performance.
    #
    # La note leur est calculée quand même, bien qu'ils n'aient pas passé les
    # filtres — c'est du calcul pur, sans un appel réseau, et ça rend une
    # question mesurable qui ne l'était pas : la note sépare-t-elle aussi *à
    # l'intérieur* de ce que les filtres jettent ?
    #
    # Ils n'entrent nulle part ailleurs. `jetons_suivis` les exclut par une
    # condition explicite, sans quoi chacun coûterait un appel DexScreener au
    # tour suivant ; le bouclier ne les voit pas ; l'alerte non plus.
    for candidat in bilan.temoins:
        metriques = convergence.mesurer(candidat)
        note = convergence.noter(candidat, metriques, reglages.convergence)
        memoire.enregistrer(candidat, metriques, note.total, debut, temoin=True)

    # --- skills 2 et 4 : sécurité, puis portefeuilles ------------------------
    pepites: list[Pepite] = []
    for observation in _a_verifier(observations, reglages):
        securite = bouclier.analyser(client, observation.candidat, reglages.bouclier)
        if securite.verdict is Verdict.REJETE:
            # Inutile de chercher qui a acheté tôt un jeton dont on ne peut pas
            # sortir. On le garde tout de même dans le rapport : savoir ce que
            # le bouclier a arrêté vaut autant que savoir ce qu'il a laissé.
            pepites.append(_composer(observation, securite, SmartMoney()))
            continue
        portefeuilles = smart_money.traquer(
            client, observation.candidat, memoire, reglages.smart_money
        )
        pepites.append(_composer(observation, securite, portefeuilles))
    pepites.sort(key=lambda p: p.note_finale, reverse=True)

    # --- skill 5 : l'alerte --------------------------------------------------
    messager = messager if messager is not None else telegram.Messager(client=client)
    alertes = telegram.alerter(
        [p for p in pepites if p.securite.verdict is not Verdict.REJETE],
        memoire, reglages.alertes, messager, debut,
    )

    secondes = time.monotonic() - depart
    JOURNAL.info(
        "scan terminé en %.0f s : %d notés, %d vérifiés, %d alertés",
        secondes, len(observations), len(pepites), len(alertes),
    )
    return Resultat(
        observations=observations, pepites=pepites, bilan=bilan, debut=debut,
        secondes=secondes, appels=client.appels, alertes=alertes,
    )


def _composer(observation: Observation, securite: Securite,
              portefeuilles: SmartMoney) -> Pepite:
    """note_finale = convergence × facteur de sécurité + bonus de portefeuilles.

    Le bonus s'ajoute au lieu de multiplier, et il est plafonné : un indice ne
    doit jamais pouvoir rattraper une mauvaise note de fond. Le total est borné
    à 100 pour que le seuil d'alerte garde son sens.
    """
    note = min(
        NOTE_MAXIMALE,
        observation.note.total * securite.facteur + portefeuilles.bonus,
    )
    return Pepite(
        observation=observation, securite=securite,
        smart_money=portefeuilles, note_finale=note,
    )
