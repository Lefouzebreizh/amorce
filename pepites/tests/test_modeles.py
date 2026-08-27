#!/usr/bin/env python3
"""Ce que les fondations doivent tenir.

Deux choses sont vérifiées ici, et ce sont les deux qui décideraient d'une
fausse alerte sans jamais lever d'erreur : la forme de la fonction
d'appartenance, et le regroupement des pools d'un même jeton.
"""

import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.modeles import (  # noqa: E402
    Candidat, Chaine, Jeton, Paire, Trapeze,
)

MAINTENANT = datetime(2026, 8, 25, 12, 0, tzinfo=timezone.utc)

EVM = Chaine(
    cle="base", nom="Base", goplus="8453", honeypot_is=8453,
    explorateur="https://basescan.org/token/", liquidite_min_usd=50000,
    quotes=frozenset({"0x4200000000000000000000000000000000000006"}),
)
SOL = Chaine(
    cle="solana", nom="Solana", goplus="solana", honeypot_is=None,
    explorateur="https://solscan.io/token/", liquidite_min_usd=30000,
    quotes=frozenset({"So11111111111111111111111111111111111111112"}),
    sensible_a_la_casse=True,
)


def paire(liquidite: float, *, market_cap: float = 1_000_000, age_heures: float = 48,
          volume_h1: float = 10_000, adresse: str = "0xpool") -> Paire:
    return Paire(
        adresse=adresse, dex="uniswap",
        jeton=Jeton(chaine=EVM, adresse="0xABCdef", symbole="PEP", nom="Pepite"),
        quote_adresse="0x4200000000000000000000000000000000000006", quote_symbole="WETH",
        prix_usd=0.001, liquidite_usd=liquidite, market_cap=market_cap, fdv=market_cap,
        creee_le=MAINTENANT - timedelta(hours=age_heures),
        volume_h1=volume_h1, volume_h6=volume_h1 * 4, volume_h24=volume_h1 * 12,
        variation_h1=5.0, variation_h6=8.0, variation_h24=12.0,
        achats_h1=60, ventes_h1=40, achats_h24=900, ventes_h24=700,
        releve_le=MAINTENANT,
    )


class TestTrapeze(unittest.TestCase):
    def setUp(self):
        self.t = Trapeze(1.5, 3.0, 12.0, 40.0)

    def test_le_plateau_vaut_un_sur_toute_sa_largeur(self):
        for valeur in (3.0, 7.0, 12.0):
            self.assertEqual(self.t.appartenance(valeur), 1.0)

    def test_les_deux_extremes_valent_zero(self):
        # Le point du trapèze : trop, c'est aussi disqualifiant que pas assez.
        self.assertEqual(self.t.appartenance(1.0), 0.0)
        self.assertEqual(self.t.appartenance(80.0), 0.0)

    def test_la_montee_et_la_descente_sont_lineaires(self):
        self.assertAlmostEqual(self.t.appartenance(2.25), 0.5)
        self.assertAlmostEqual(self.t.appartenance(26.0), 0.5)

    def test_un_trapeze_decroissant_est_refuse(self):
        # Il noterait zéro partout, en silence, et le critère disparaîtrait.
        with self.assertRaises(ValueError):
            Trapeze(10.0, 3.0, 12.0, 40.0)

    def test_un_trapeze_ecrit_avec_trois_bornes_est_refuse(self):
        with self.assertRaises(ValueError):
            Trapeze.depuis_liste([1.0, 2.0, 3.0])


class TestChaine(unittest.TestCase):
    def test_une_adresse_evm_se_compare_sans_egard_a_la_casse(self):
        self.assertTrue(EVM.est_quote_de_reference("0x4200000000000000000000000000000000000006".upper()))

    def test_une_adresse_solana_garde_sa_casse(self):
        # `A` et `a` désignent deux comptes différents en base58 : confondre
        # les deux ferait passer un faux USDC pour le vrai.
        self.assertTrue(SOL.est_quote_de_reference("So11111111111111111111111111111111111111112"))
        self.assertFalse(SOL.est_quote_de_reference("so11111111111111111111111111111111111111112"))

    def test_solana_n_est_pas_une_chaine_evm(self):
        self.assertTrue(EVM.est_evm)
        self.assertFalse(SOL.est_evm)


class TestRegroupement(unittest.TestCase):
    def test_la_liquidite_de_trois_pools_s_additionne(self):
        # Sans cela, un jeton réparti sur trois pools paraît trois fois moins
        # profond qu'il n'est, et tombe sous le plancher de liquidité.
        c = Candidat.depuis_paires([
            paire(30_000, adresse="0xa"), paire(25_000, adresse="0xb"), paire(20_000, adresse="0xc"),
        ])
        self.assertEqual(c.liquidite_usd, 75_000)
        self.assertEqual(c.nombre_de_pools, 3)

    def test_la_capitalisation_ne_s_additionne_pas(self):
        # C'est la même offre vue depuis chaque pool : la sommer la
        # multiplierait par le nombre de pools.
        c = Candidat.depuis_paires([paire(30_000, adresse="0xa"), paire(20_000, adresse="0xb")])
        self.assertEqual(c.market_cap, 1_000_000)

    def test_le_pool_le_plus_profond_sert_de_reference_de_cours(self):
        profond = paire(90_000, adresse="0xprofond")
        c = Candidat.depuis_paires([paire(5_000, adresse="0xmince"), profond])
        self.assertEqual(c.paire_principale.adresse, "0xprofond")

    def test_l_age_retenu_est_celui_du_pool_le_plus_ancien(self):
        # Le jeton est achetable depuis son premier pool, quels que soient
        # ceux ouverts après.
        c = Candidat.depuis_paires([
            paire(30_000, age_heures=200, adresse="0xa"),
            paire(40_000, age_heures=3, adresse="0xb"),
        ])
        self.assertAlmostEqual(c.age_heures, 200)

    def test_regrouper_deux_jetons_differents_est_une_erreur(self):
        autre = Jeton(chaine=EVM, adresse="0x999", symbole="X", nom="X")
        with self.assertRaises(ValueError):
            Candidat.depuis_paires([paire(10_000), Paire(**{**paire(10_000).__dict__, "jeton": autre})])

    def test_un_pool_sans_date_de_creation_est_traite_comme_neuf(self):
        # Le filtre d'âge minimal l'écartera : on ne mise pas sur un pool dont
        # on ignore la date.
        sans_date = Paire(**{**paire(10_000).__dict__, "creee_le": None})
        self.assertEqual(sans_date.age_heures, 0.0)


if __name__ == "__main__":
    unittest.main()
