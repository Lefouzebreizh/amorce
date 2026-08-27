#!/usr/bin/env python3
"""Skill 4 — le traqueur : les portefeuilles qu'on a déjà vus au bon endroit.

**Ce skill ne vaut rien le premier jour, et c'est normal.** Il ne consulte
aucune base d'adresses réputées : il fabrique la sienne, scan après scan, en
notant qui était présent tôt sur les jetons qu'il examine. Un portefeuille ne
devient intéressant qu'après être apparu sur plusieurs jetons distincts —
avant, c'est une coïncidence, et suivre les coïncidences revient à suivre les
robots d'arbitrage et les routeurs d'échange, précoces sur absolument tout.
Comptez deux à trois semaines de relevés avant qu'il ne dise quoi que ce soit.

Deux précautions structurelles :

1. **On lit la mémoire avant de l'écrire.** Sinon le jeton qu'on examine
   compterait dans ses propres apparitions, et chaque portefeuille paraîtrait
   récurrent dès sa première rencontre. C'est le même piège que la persistance
   du skill 3, à un étage différent.

2. **Le résultat est un bonus plafonné, jamais un facteur.** Deux adresses
   réputées peuvent se tromper ensemble — c'est même la mécanique de la plupart
   des sorties organisées. Trois portefeuilles reconnus suffisent à atteindre le
   plafond : au-delà, ce n'est plus un indice, c'est une foule.
"""

from __future__ import annotations

import logging

from core.modeles import Candidat, SmartMoney
from core.reglages import ReglagesSmartMoney
from core.reseau import ClientHttp
from core.stockage import Memoire
from sources import etherscan, solana_rpc

JOURNAL = logging.getLogger("pepites.smart_money")

DEBITS = {**etherscan.DEBITS, **solana_rpc.DEBITS}

# Chaque portefeuille reconnu vaut ce nombre de points, jusqu'au plafond.
POINTS_PAR_PORTEFEUILLE = 5.0


def calculer_bonus(apparitions: dict[str, int], reglages: ReglagesSmartMoney) -> float:
    """Pur : combien de points valent ces portefeuilles déjà vus ailleurs."""
    return min(reglages.bonus_max, POINTS_PAR_PORTEFEUILLE * len(apparitions))


def _relever_portefeuilles(client: ClientHttp, candidat: Candidat,
                          reglages: ReglagesSmartMoney) -> list[str]:
    chaine = candidat.jeton.chaine
    if chaine.est_evm:
        return etherscan.premiers_acheteurs(
            client, chaine, candidat.jeton.adresse,
            exclusions={candidat.paire_principale.adresse},
            limite=reglages.premiers_acheteurs,
        )
    return solana_rpc.principaux_detenteurs(
        client, candidat.jeton.adresse, reglages.premiers_acheteurs
    )


def traquer(client: ClientHttp, candidat: Candidat, memoire: Memoire,
            reglages: ReglagesSmartMoney) -> SmartMoney:
    """Relève les portefeuilles du jeton, les croise avec le passé, puis les range."""
    portefeuilles = _relever_portefeuilles(client, candidat, reglages)
    if not portefeuilles:
        return SmartMoney()

    # Lecture avant écriture : sans cela, le jeton qu'on examine compterait dans
    # ses propres apparitions.
    apparitions = memoire.apparitions(portefeuilles, reglages.apparitions_min)

    chaine, adresse = candidat.jeton.identite
    memoire.enregistrer_acheteurs(chaine, adresse, portefeuilles)

    if apparitions:
        JOURNAL.info("%s : %d portefeuille(s) déjà vu(s) ailleurs",
                     candidat.jeton.symbole, len(apparitions))
    return SmartMoney(
        portefeuilles=tuple(sorted(apparitions)),
        apparitions=apparitions,
        bonus=calculer_bonus(apparitions, reglages),
    )
