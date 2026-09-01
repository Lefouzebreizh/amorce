#!/usr/bin/env python3
"""L'assemblage : interroger les lecteurs, en tirer un bilan.

C'est le seul endroit du module qui parle à toutes les sources. Deux décisions
y sont prises, et elles méritent d'être lues avant d'y toucher.

**Seule la saisie apporte des montants.** NexusCrypto annonce une allocation
cible, le radar des signalements ; ni l'un ni l'autre ne dit ce qui est détenu.
Ils remplissent des *notes*, jamais des lignes. Un jour où l'on branchera un
vrai instantané de portefeuille, c'est ici — et seulement ici — que la règle
changera.

**« Partiel » se décide sur ce qui fausse le total, pas sur ce qui manque.**
Un radar muet n'enlève pas un euro au patrimoine : ses trouvailles n'y étaient
jamais entrées. Un cours absent, si. Confondre les deux ferait taire le conseil
chaque fois qu'une source annexe est éteinte, et un conseiller qui se tait tout
le temps ne se lit plus — ce qui reviendrait à ne plus lire non plus les fois
où il se tait pour une bonne raison.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from analyse import ecarts as ecarts_module
from analyse import valorisation
from core.modeles import Bilan, EtatSource
from core.reglages import Reglages
from lecteurs import banque, nexuscrypto, pepites, saisie


def assembler(
    reglages: Reglages,
    aujourdhui: date | None = None,
    maintenant: datetime | None = None,
) -> tuple[Bilan, dict[str, tuple[str, ...]]]:
    """Interroge les quatre lecteurs et rend le bilan, plus leurs notes.

    Les deux dates sont injectables pour la même raison que les cours le sont :
    un rapport qui dépend de l'horloge ne se teste pas deux fois de suite avec
    le même verdict.
    """
    maintenant = maintenant or datetime.now(timezone.utc)
    aujourdhui = aujourdhui or maintenant.date()

    lectures = (
        saisie.lire(reglages, aujourdhui),
        nexuscrypto.lire(reglages.sources.nexuscrypto),
        pepites.lire(reglages.sources.pepites, maintenant),
        banque.lire(),
    )

    lignes = tuple(ligne for lecture in lectures for ligne in lecture.lignes)
    etats: tuple[EtatSource, ...] = tuple(lecture.etat for lecture in lectures)
    notes = {lecture.etat.nom: lecture.notes for lecture in lectures}

    totaux = valorisation.totaux_par_classe(lignes)
    ecarts = ecarts_module.analyser(totaux, reglages.profil)

    # Ce qui rend le total faux, et rien d'autre — voir l'en-tête du module.
    lecture_saisie = lectures[0]
    avertissements = list(lecture_saisie.notes)
    if lecture_saisie.etat.muette:
        avertissements.append(lecture_saisie.etat.motif)
    partiel = bool(avertissements)

    bilan = Bilan(
        lignes=lignes,
        ecarts=ecarts,
        sources=etats,
        total_eur=sum(totaux.values()),
        partiel=partiel,
        avertissements=tuple(avertissements),
    )
    return bilan, notes
