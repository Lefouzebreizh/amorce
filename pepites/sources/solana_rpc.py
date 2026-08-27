#!/usr/bin/env python3
"""Solana : les portefeuilles qui pèsent sur un jeton.

**Ce ne sont pas les premiers acheteurs, et c'est assumé.** Remonter le premier
achat d'un jeton Solana demande de parcourir sa signature la plus ancienne : le
RPC rend les signatures de la plus récente à la plus ancienne, et un jeton actif
en compte des dizaines de milliers. Ce serait des centaines d'appels par jeton,
pour une offre gratuite qui n'en supporte pas le dixième.

On prend donc l'autre bout du même fil : **les plus gros porteurs actuels**.
C'est un signal plus faible — un gros porteur d'aujourd'hui a pu entrer hier —,
mais un portefeuille qui se retrouve dominant sur une série de petits jetons qui
montent ensuite reste exactement ce qu'on cherche. Le rapport et l'alerte disent
laquelle des deux lectures a servi ; les confondre serait se mentir.

Deux appels : les plus gros comptes de jetons, puis les propriétaires de ces
comptes — un compte de jeton n'est pas un portefeuille, c'est un coffre qui
appartient à un portefeuille.
"""

from __future__ import annotations

import logging
import os

from core.reseau import ClientHttp

JOURNAL = logging.getLogger("pepites.solana")

PUBLIC = "https://api.mainnet-beta.solana.com"
HELIUS = "https://mainnet.helius-rpc.com/?api-key={cle}"
# Le RPC public est saturé en permanence ; Helius, en offre gratuite, tient
# largement le rythme d'un scan.
DEBITS = {"solana": 60.0}


def point_d_entree() -> str:
    cle = os.environ.get("HELIUS_API_KEY", "")
    return HELIUS.format(cle=cle) if cle else PUBLIC


def _appeler(client: ClientHttp, methode: str, parametres: list):
    reponse = client.poster("solana", point_d_entree(), {
        "jsonrpc": "2.0", "id": 1, "method": methode, "params": parametres,
    })
    if not isinstance(reponse, dict) or "result" not in reponse:
        JOURNAL.debug("%s : %s", methode, (reponse or {}).get("error"))
        return None
    return reponse["result"]


def principaux_detenteurs(client: ClientHttp, mint: str, limite: int) -> list[str]:
    """Les portefeuilles derrière les plus gros comptes de ce jeton."""
    resultat = _appeler(client, "getTokenLargestAccounts", [mint])
    if not isinstance(resultat, dict):
        return []
    comptes = [c.get("address") for c in (resultat.get("value") or [])
               if isinstance(c, dict) and c.get("address")][:limite]
    if not comptes:
        return []

    detail = _appeler(client, "getMultipleAccounts",
                      [comptes, {"encoding": "jsonParsed"}])
    if not isinstance(detail, dict):
        return []

    proprietaires: list[str] = []
    vus: set[str] = set()
    for compte in detail.get("value") or []:
        if not isinstance(compte, dict):
            continue
        info = (((compte.get("data") or {}).get("parsed") or {}).get("info") or {})
        proprietaire = info.get("owner")
        # Un compte de jeton détenu par un programme est un pool, pas une
        # personne : le compter reviendrait à suivre l'infrastructure.
        if proprietaire and proprietaire not in vus and not info.get("isNative"):
            vus.add(proprietaire)
            proprietaires.append(proprietaire)
    return proprietaires
