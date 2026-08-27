#!/usr/bin/env python3
"""La traduction du JSON DexScreener.

Tous les refus testés ici ont la même conséquence s'ils passent : une note
calculée sur des zéros par défaut, qui vaut moins qu'une absence de note.
"""

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from aides import BASE, MAINTENANT, WETH  # noqa: E402
from sources.dexscreener import paire_depuis_json  # noqa: E402

CHAINES = {"base": BASE}

# Forme réelle d'une réponse DexScreener, réduite aux champs lus.
BRUT = {
    "chainId": "base",
    "dexId": "aerodrome",
    "pairAddress": "0xPool",
    "baseToken": {"address": "0xPepite", "name": "Pepite", "symbol": "PEP"},
    "quoteToken": {"address": WETH, "name": "Wrapped Ether", "symbol": "WETH"},
    "priceUsd": "0.0012345",                       # une chaîne, pas un nombre
    "txns": {"h1": {"buys": 190, "sells": 120}, "h24": {"buys": 2400, "sells": 2100}},
    "volume": {"h1": 90000.0, "h6": 280000.0, "h24": 700000.0},
    "priceChange": {"h1": 6.0, "h6": 11.0, "h24": 18.0},
    "liquidity": {"usd": 120000.0, "base": 1.0, "quote": 2.0},
    "fdv": 2000000.0,
    "marketCap": 1500000.0,
    "pairCreatedAt": 1_756_000_000_000,
}


class TestTraduction(unittest.TestCase):
    def test_une_paire_complete_se_traduit(self):
        paire = paire_depuis_json(BRUT, CHAINES, MAINTENANT)
        self.assertIsNotNone(paire)
        self.assertEqual(paire.jeton.symbole, "PEP")
        self.assertAlmostEqual(paire.prix_usd, 0.0012345)
        self.assertEqual(paire.achats_h1, 190)
        self.assertTrue(paire.cotee_en_reference)

    def test_la_date_de_creation_arrive_en_millisecondes(self):
        paire = paire_depuis_json(BRUT, CHAINES, MAINTENANT)
        self.assertEqual(
            paire.creee_le,
            datetime.fromtimestamp(1_756_000_000, tz=timezone.utc),
        )

    def test_une_chaine_hors_perimetre_est_ignoree_sans_erreur(self):
        # Une recherche par adresse de cotation remonte des paires de toutes
        # les chaînes : ce n'est pas une anomalie, c'est le fonctionnement.
        self.assertIsNone(paire_depuis_json({**BRUT, "chainId": "sui"}, CHAINES))

    def test_une_paire_sans_adresse_de_jeton_est_refusee(self):
        self.assertIsNone(paire_depuis_json({**BRUT, "baseToken": {}}, CHAINES))

    def test_sans_capitalisation_la_fdv_prend_le_relais(self):
        # La FDV majore la capitalisation, donc durcit le jugement : c'est le
        # bon sens de l'échec quand l'offre en circulation est inconnue.
        sans = {k: v for k, v in BRUT.items() if k != "marketCap"}
        paire = paire_depuis_json(sans, CHAINES, MAINTENANT)
        self.assertEqual(paire.market_cap, 2_000_000.0)

    def test_les_champs_absents_valent_zero_et_non_une_exception(self):
        minimal = {
            "chainId": "base", "pairAddress": "0xPool",
            "baseToken": {"address": "0xX"}, "quoteToken": {"address": WETH},
        }
        paire = paire_depuis_json(minimal, CHAINES, MAINTENANT)
        self.assertEqual(paire.volume_h24, 0.0)
        self.assertIsNone(paire.creee_le)
        self.assertEqual(paire.age_heures, 0.0)


if __name__ == "__main__":
    unittest.main()
