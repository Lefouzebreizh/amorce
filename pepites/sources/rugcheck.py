#!/usr/bin/env python3
"""RugCheck : le second avis sur Solana.

GoPlus lit les autorités du jeton ; RugCheck y ajoute une lecture du marché —
liquidité verrouillée, concentration, jeton déjà signalé. Deux lectures valent
mieux qu'une là où il n'existe aucun simulateur d'achat/revente comparable à
honeypot.is.

Le point d'entrée « résumé » suffit et reste ouvert ; le rapport complet demande
désormais une authentification. On lit donc les risques et on les traduit, sans
chercher à reconstituer ce qu'on n'a pas.
"""

from __future__ import annotations

import logging

from core.modeles import Constat
from core.reseau import ClientHttp

JOURNAL = logging.getLogger("pepites.rugcheck")

URL = "https://api.rugcheck.xyz/v1/tokens/{mint}/report/summary"
DEBITS = {"rugcheck": 30.0}

# Les intitulés de risque sont du texte libre côté service. On ne reconnaît que
# ceux qui ont une conséquence mécanique — le reste devient une remarque, pas un
# verdict. Reconnaître un intitulé de travers coûterait un rejet injustifié.
MOTS_CLES = {
    "mint authority": "emission_possible",
    "freeze authority": "gel_possible",
    "mutable metadata": "metadonnees_modifiables",
}


def constat(brut: dict) -> Constat | None:
    if not isinstance(brut, dict):
        return None
    risques = brut.get("risks")
    if not isinstance(risques, list):
        return None

    champs: dict[str, bool] = {}
    remarques: list[str] = []
    for risque in risques:
        if not isinstance(risque, dict):
            continue
        intitule = str(risque.get("name") or "")
        minuscule = intitule.lower()
        for cle, champ in MOTS_CLES.items():
            if cle in minuscule:
                champs[champ] = True
        if risque.get("level") == "danger" and intitule:
            remarques.append(intitule)

    return Constat(source="RugCheck", remarques=tuple(remarques), **champs)


def analyser(client: ClientHttp, adresse: str) -> Constat | None:
    reponse = client.json("rugcheck", URL.format(mint=adresse))
    return constat(reponse) if reponse else None
