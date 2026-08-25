#!/usr/bin/env python3
"""Le regroupement et les éliminations franches.

Les éliminations sont comptées autant qu'appliquées : un radar qui rend zéro
candidat sans dire pourquoi est indébogable.
"""

import sys
import unittest
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from aides import BASE, MAINTENANT, WETH, candidat, paire  # noqa: E402
from core.modeles import Jeton  # noqa: E402
from core.reglages import charger  # noqa: E402
from skills.radar import filtrer, regrouper  # noqa: E402

FILTRES = charger().filtres
CHAINES = {"base": BASE}


class TestRegroupement(unittest.TestCase):
    def test_les_pools_d_un_meme_jeton_ne_font_qu_un_candidat(self):
        candidats, _ = regrouper(
            [paire(adresse="0xa", liquidite_usd=60_000),
             paire(adresse="0xb", liquidite_usd=40_000)],
            CHAINES,
        )
        self.assertEqual(len(candidats), 1)
        self.assertEqual(candidats[0].liquidite_usd, 100_000)

    def test_une_paire_cotee_hors_reference_est_ecartee_et_comptee(self):
        # Une paire SCAM/AUTRESCAM laisse l'agrégateur convertir en dollars
        # imaginaires : c'est le montage exact du faux volume, et sa liquidité
        # ne doit surtout pas grossir la somme du jeton.
        candidats, rejets = regrouper(
            [paire(adresse="0xa"),
             paire(adresse="0xb", quote_adresse="0xAutreScam", quote_symbole="SCAM")],
            CHAINES,
        )
        self.assertEqual(len(candidats), 1)
        self.assertEqual(candidats[0].nombre_de_pools, 1)
        self.assertEqual(sum(rejets.values()), 1)

    def test_deux_jetons_distincts_font_deux_candidats(self):
        autre = Jeton(chaine=BASE, adresse="0xAutre", symbole="AUT", nom="Autre")
        candidats, _ = regrouper(
            [paire(adresse="0xa"), paire(adresse="0xb", jeton=autre)], CHAINES
        )
        self.assertEqual(len(candidats), 2)


class TestFiltres(unittest.TestCase):
    def refuser(self, **remplacements) -> str:
        retenus, rejets = filtrer([candidat(**remplacements)], FILTRES)
        self.assertEqual(retenus, [], "le candidat aurait dû être écarté")
        return next(iter(rejets))

    def test_un_candidat_sain_passe(self):
        retenus, rejets = filtrer([candidat()], FILTRES)
        self.assertEqual(len(retenus), 1)
        self.assertFalse(rejets)

    def test_un_pool_trop_jeune_est_ecarte(self):
        # Le filtre le plus important : sous six heures, l'accélération explose
        # par construction, et c'est la fenêtre du retrait de liquidité.
        motif = self.refuser(creee_le=MAINTENANT - timedelta(hours=2))
        self.assertIn("jeune", motif)

    def test_un_pool_sans_date_est_traite_comme_trop_jeune(self):
        self.assertIn("jeune", self.refuser(creee_le=None))

    def test_une_liquidite_sous_le_plancher_de_la_chaine_est_ecartee(self):
        self.assertIn("liquidité", self.refuser(liquidite_usd=20_000))

    def test_une_capitalisation_hors_bande_est_ecartee(self):
        self.assertIn("trop élevée", self.refuser(market_cap=90_000_000, fdv=90_000_000))
        self.assertIn("trop faible", self.refuser(market_cap=40_000, fdv=40_000))

    def test_un_pool_trop_mince_pour_sa_capitalisation_est_ecarte(self):
        # 25 M$ de capitalisation sur 120 k$ de pool : une vente de 10 000 $
        # effondre le cours. La « capitalisation » est une fiction.
        self.assertIn("mince", self.refuser(market_cap=25_000_000, fdv=25_000_000))

    def test_une_offre_encore_verrouillee_est_ecartee(self):
        self.assertIn("verrouillée", self.refuser(fdv=9_000_000))

    def test_un_cours_deja_parti_est_ecarte(self):
        self.assertIn("déjà parti", self.refuser(variation_h1=220.0))

    def test_une_activite_trop_faible_est_ecartee(self):
        self.assertIn("1 h", self.refuser(achats_h1=3, ventes_h1=2))

    def test_chaque_motif_de_rejet_est_compte(self):
        _, rejets = filtrer(
            [candidat(liquidite_usd=1_000), candidat(liquidite_usd=2_000),
             candidat(variation_h1=300.0)],
            FILTRES,
        )
        self.assertEqual(sum(rejets.values()), 3)
        self.assertEqual(len(rejets), 2)


if __name__ == "__main__":
    unittest.main()
