#!/usr/bin/env python3
"""Etherscan V2 : les premiers acheteurs d'un jeton EVM.

Le principe tient en un paramètre : `sort=asc` rend les transferts du jeton dans
l'ordre où ils ont eu lieu. Les destinataires des premiers sont, à peu de chose
près, les premiers acheteurs — « à peu de chose près » parce qu'il faut écarter
ce qui n'est pas un acheteur : le pool d'échange, le contrat du jeton lui-même,
l'adresse nulle des frappes initiales, et le déployeur qui s'attribue l'offre.
Sans ces exclusions, le traqueur apprendrait que le pool Uniswap est précoce sur
absolument tout, ce qui est vrai et parfaitement inutile.

Une seule clé gratuite couvre les soixante et quelques chaînes EVM depuis la
version 2 de l'API : c'est ce qui rend ce skill possible sans multiplier les
inscriptions.
"""

from __future__ import annotations

import logging
import os

from core.modeles import Chaine
from core.reseau import ClientHttp

JOURNAL = logging.getLogger("pepites.etherscan")

URL = "https://api.etherscan.io/v2/api"
# Offre gratuite : cinq appels par seconde. On reste largement dessous, le
# traqueur n'ayant qu'une poignée de jetons à examiner par scan.
DEBITS = {"etherscan": 200.0}

NULLE = "0x0000000000000000000000000000000000000000"


def cle() -> str:
    return os.environ.get("ETHERSCAN_API_KEY", "")


def premiers_acheteurs(client: ClientHttp, chaine: Chaine, jeton: str,
                       exclusions: set[str], limite: int) -> list[str]:
    """Les `limite` premières adresses ayant reçu le jeton, hors infrastructure."""
    if not cle():
        return []
    reponse = client.json("etherscan", URL, params={
        "chainid": chaine.goplus, "module": "account", "action": "tokentx",
        "contractaddress": jeton, "page": 1, "offset": max(limite * 3, 100),
        "sort": "asc", "apikey": cle(),
    })
    if not isinstance(reponse, dict) or reponse.get("status") != "1":
        JOURNAL.debug("etherscan : %s", (reponse or {}).get("message"))
        return []

    ecartes = {a.lower() for a in exclusions} | {NULLE, jeton.lower()}
    acheteurs: list[str] = []
    vus: set[str] = set()
    for transfert in reponse.get("result") or []:
        if not isinstance(transfert, dict):
            continue
        destinataire = str(transfert.get("to") or "").lower()
        if not destinataire or destinataire in ecartes or destinataire in vus:
            continue
        vus.add(destinataire)
        acheteurs.append(destinataire)
        if len(acheteurs) >= limite:
            break
    return acheteurs
