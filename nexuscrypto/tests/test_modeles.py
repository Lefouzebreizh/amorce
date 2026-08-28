#!/usr/bin/env python3
"""Ce que les fondations doivent tenir.

Trois familles de garanties : les horodatages sont toujours conscients du
fuseau, la comptabilité d'une position est exacte au renforcement comme à la
vente, et la lecture du carnet ne ment pas sur la liquidité.
"""

import unittest
from datetime import datetime, timedelta

from aides import MAINTENANT, carnet, portefeuille, position

from src.core.modeles import (
    Bougie, Portefeuille, SerieOHLCV, SignalSentiment, Zone, borner,
)


class TestBougie(unittest.TestCase):
    def test_refuse_un_horodatage_naif(self):
        """Un instant sans fuseau lève à la construction et non trois modules
        plus loin, au milieu d'une comparaison de dates."""

        with self.assertRaises(ValueError):
            Bougie(datetime(2026, 1, 1), 1, 2, 0.5, 1.5, 10)

    def test_refuse_un_bas_au_dessus_du_haut(self):
        with self.assertRaises(ValueError):
            Bougie(MAINTENANT, 1, 1.0, 2.0, 1.5, 10)

    def test_refuse_un_volume_negatif(self):
        with self.assertRaises(ValueError):
            Bougie(MAINTENANT, 1, 2, 0.5, 1.5, -1)


class TestSerie(unittest.TestCase):
    def test_refuse_des_bougies_desordonnees(self):
        """Une série à l'envers donnerait des indicateurs silencieusement
        inversés : aucun calcul ne lèverait, tous les signaux seraient faux."""

        premiere = Bougie(MAINTENANT, 1, 2, 0.5, 1.5, 10)
        seconde = Bougie(MAINTENANT - timedelta(hours=4), 1, 2, 0.5, 1.5, 10)
        with self.assertRaises(ValueError):
            SerieOHLCV("BTC/USDT", "4h", (premiere, seconde))

    def test_serie_vide_leve_sur_le_prix(self):
        with self.assertRaises(ValueError):
            SerieOHLCV("BTC/USDT", "4h", ()).dernier_prix


class TestCarnet(unittest.TestCase):
    def test_spread_et_desequilibre(self):
        livre = carnet(milieu=100.0, taille=10.0, lignes=3, pas=0.001)
        self.assertAlmostEqual(livre.milieu, 100.0, places=6)
        self.assertAlmostEqual(livre.spread_relatif, 0.002, places=6)
        self.assertAlmostEqual(livre.desequilibre, 0.0, places=6)

    def test_carnet_vide_ne_leve_pas(self):
        """Un carnet vide rend `None` partout plutôt que de lever : c'est un
        cas normal sur une paire peu liquide, pas une erreur."""

        from src.core.modeles import CarnetOrdres

        vide = CarnetOrdres("X/USDT", (), (), MAINTENANT)
        self.assertIsNone(vide.milieu)
        self.assertIsNone(vide.spread_relatif)
        self.assertIsNone(vide.desequilibre)


class TestSentiment(unittest.TestCase):
    def test_zones(self):
        for valeur, attendue in (
            (10, Zone.PEUR_EXTREME), (24, Zone.PEUR_EXTREME), (30, Zone.PEUR),
            (50, Zone.NEUTRE), (70, Zone.AVIDITE), (90, Zone.AVIDITE_EXTREME),
        ):
            self.assertIs(SignalSentiment(fear_greed=valeur).zone, attendue, valeur)

    def test_sans_indice_la_zone_est_neutre(self):
        """L'absence de donnée ne doit jamais pousser à acheter plus."""

        self.assertIs(SignalSentiment().zone, Zone.NEUTRE)

    def test_indice_hors_bornes_leve(self):
        with self.assertRaises(ValueError):
            SignalSentiment(fear_greed=120)


class TestPosition(unittest.TestCase):
    def test_renforcement_recalcule_le_prix_moyen(self):
        ligne = position(quantite=1.0, prix_moyen=100.0)
        renforcee = ligne.avec_achat(1.0, 200.0)
        self.assertAlmostEqual(renforcee.quantite, 2.0)
        self.assertAlmostEqual(renforcee.prix_moyen, 150.0)

    def test_le_renforcement_garde_la_date_d_ouverture(self):
        """Garder la première entrée est ce qui permet de lire l'âge réel d'une
        ligne DCA, qui se renforce vingt fois."""

        ligne = position()
        self.assertEqual(ligne.avec_achat(1.0, 200.0).ouverte_le, ligne.ouverte_le)

    def test_vente_totale_solde_la_ligne(self):
        """Une position à quantité zéro qui traîne fausse toutes les moyennes."""

        self.assertIsNone(position(quantite=1.0).avec_vente(1.0))

    def test_vente_partielle_garde_le_prix_moyen(self):
        restante = position(quantite=2.0, prix_moyen=100.0).avec_vente(0.5)
        self.assertAlmostEqual(restante.quantite, 1.5)
        self.assertAlmostEqual(restante.prix_moyen, 100.0)

    def test_plus_haut_ne_recule_jamais(self):
        ligne = position(prix_moyen=100.0, plus_haut=150.0)
        self.assertAlmostEqual(ligne.avec_plus_haut(120.0).plus_haut_atteint, 150.0)
        self.assertAlmostEqual(ligne.avec_plus_haut(180.0).plus_haut_atteint, 180.0)


class TestPortefeuille(unittest.TestCase):
    def test_valeur_et_allocation(self):
        pf = portefeuille(
            liquidites=5_000.0,
            positions={"BTC/USDT": position(quantite=50.0, prix_moyen=100.0)},
        )
        prix = {"BTC/USDT": 100.0}
        self.assertAlmostEqual(pf.valeur_totale(prix), 10_000.0)
        self.assertAlmostEqual(pf.allocation(prix)["BTC/USDT"], 0.5)

    def test_portefeuille_vide(self):
        self.assertEqual(Portefeuille(liquidites_usd=0.0).allocation({}), {})


class TestBorner(unittest.TestCase):
    def test_nan_tombe_sur_le_minimum(self):
        """Toutes les notes passent par `borner`. Un NaN qui traverserait
        lèverait dans `Score`, à un endroit sans rapport avec sa cause."""

        self.assertEqual(borner(float("nan"), 0.0, 100.0), 0.0)

    def test_bornes(self):
        self.assertEqual(borner(150.0, 0.0, 100.0), 100.0)
        self.assertEqual(borner(-3.0, 0.0, 100.0), 0.0)


if __name__ == "__main__":
    unittest.main()
