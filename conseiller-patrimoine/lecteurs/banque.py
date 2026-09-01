#!/usr/bin/env python3
"""Les comptes bancaires classiques — la place est tenue, rien n'est branché.

Ce fichier existe vide à dessein. Il fixe **maintenant**, pendant qu'on y pense,
les conditions d'un raccordement futur ; les écrire le jour où on branchera,
sous la pression d'un dimanche soir, c'est ne pas les écrire.

**La règle, en un mot : AISP, jamais PISP.** Un agrégateur bancaire européen
(DSP2) se connecte sous l'une de deux portées, et le mot qui les sépare est
écrit dans le contrat du prestataire :

- **AISP** — *Account Information Service Provider* : consultation des comptes
  et des opérations. C'est la seule que ce module peut recevoir.
- **PISP** — *Payment Initiation Service Provider* : initiation de virement.
  Un accès qui déplace de l'argent. Il n'entre pas ici, sous aucune condition,
  même « pour tester », même en bac à sable.

Deux conséquences pratiques, à relire avant d'écrire la première ligne :

1. Le jeton d'accès se lit par `core.lecture_seule.variable`, qui impose le
   suffixe `_LECTURE_SEULE` et refuse les noms qui parlent de négoce ou de
   retrait. Il n'y a pas d'autre porte, et il ne faut pas en ouvrir une.
2. Le client HTTP ne peut pas vivre dans ce fichier : `MODULES_INTERDITS`
   interdit `requests` et consorts dans tout le paquet, et un test le vérifie.
   Un raccordement réel demandera donc une décision explicite du propriétaire
   sur *où* le réseau a le droit d'exister — probablement un module séparé qui
   dépose un export local que ce lecteur-ci se contentera de lire. C'est plus
   sûr, et ce n'est pas une contrainte : c'est exactement ce que fait déjà la
   saisie manuelle.
"""

from __future__ import annotations

from core.modeles import Disponibilite, EtatSource
from lecteurs import Lecture

MOTIF = (
    "aucun agrégateur bancaire n'est raccordé. Le jour venu, en portée AISP "
    "(consultation) uniquement — jamais PISP (initiation de paiement)."
)


def lire() -> Lecture:
    """Rend toujours « non branchée ». Ce n'est pas un échec, et le rapport doit
    le distinguer d'une source muette : rien n'est cassé, rien n'est à réparer."""
    return Lecture(
        etat=EtatSource(
            nom="banque",
            disponibilite=Disponibilite.NON_BRANCHEE,
            motif=MOTIF,
        )
    )
