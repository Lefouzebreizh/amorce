#!/usr/bin/env python3
"""Fabriques partagées par les tests. Nommé hors du motif `test*.py` pour ne
pas être ramassé comme une suite."""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.modeles import Candidat, Chaine, Jeton, Paire  # noqa: E402

MAINTENANT = datetime(2026, 8, 25, 12, 0, tzinfo=timezone.utc)

WETH = "0x4200000000000000000000000000000000000006"

BASE = Chaine(
    cle="base", nom="Base", goplus="8453", honeypot_is=8453,
    explorateur="https://basescan.org/token/", liquidite_min_usd=50000,
    quotes=frozenset({WETH}),
)


def paire(**remplacements) -> Paire:
    """Une paire saine par défaut ; on ne remplace que ce que le test observe."""
    defauts = dict(
        adresse="0xpool", dex="uniswap",
        jeton=Jeton(chaine=BASE, adresse="0xPepite", symbole="PEP", nom="Pepite"),
        quote_adresse=WETH, quote_symbole="WETH",
        prix_usd=0.0012, liquidite_usd=120_000, market_cap=1_500_000, fdv=1_500_000,
        creee_le=MAINTENANT - timedelta(hours=240),
        volume_h1=90_000, volume_h6=280_000, volume_h24=700_000,
        variation_h1=6.0, variation_h6=11.0, variation_h24=18.0,
        achats_h1=190, ventes_h1=120, achats_h24=2400, ventes_h24=2100,
        releve_le=MAINTENANT,
    )
    defauts.update(remplacements)
    return Paire(**defauts)


def candidat(**remplacements) -> Candidat:
    return Candidat.depuis_paires([paire(**remplacements)])
