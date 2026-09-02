#!/usr/bin/env python3
"""La dérive contre la cible, et la bande qui décide s'il faut bouger."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from aides import reglages  # noqa: E402
from analyse.ecarts import analyser  # noqa: E402
from core.modeles import Classe  # noqa: E402


def ecarts(**totaux):
    complet = {classe: 0.0 for classe in Classe}
    complet.update({Classe(nom): float(valeur) for nom, valeur in totaux.items()})
    return {ecart.classe: ecart for ecart in analyser(complet, reglages().profil)}


class TestParts(unittest.TestCase):
    def test_la_part_se_calcule_sur_le_total_net(self):
        # 40 000 d'immobilier net sur 60 000 : deux tiers, et non 40 % du brut.
        resultat = ecarts(bourse=5000, crypto=5000, immobilier=40000, liquidites=10000)
        self.assertAlmostEqual(resultat[Classe.IMMOBILIER].part_pct, 66.6666, places=3)

    def test_un_patrimoine_vide_ne_divise_pas_par_zero(self):
        # Le cas de la toute première utilisation, quand le fichier ne porte
        # encore aucun actif — le pire moment pour planter.
        self.assertEqual(ecarts()[Classe.BOURSE].part_pct, 0.0)


class TestBande(unittest.TestCase):
    def test_un_ecart_sous_la_bande_ne_declenche_rien(self):
        # 52 % pour une cible de 50 avec une bande de 5 points : on ne touche à rien.
        resultat = ecarts(bourse=52000, crypto=10000, immobilier=28000, liquidites=10000)
        self.assertFalse(resultat[Classe.BOURSE].hors_bande)

    def test_un_ecart_egal_a_la_bande_declenche(self):
        # La bande dit « en dessous, on ne bouge pas » : à la valeur exacte on
        # est déjà sorti. Une comparaison stricte laisserait passer le cas pile.
        resultat = ecarts(bourse=55000, crypto=10000, immobilier=25000, liquidites=10000)
        self.assertTrue(resultat[Classe.BOURSE].hors_bande)

    def test_la_bande_joue_dans_les_deux_sens(self):
        resultat = ecarts(bourse=45000, crypto=10000, immobilier=35000, liquidites=10000)
        self.assertTrue(resultat[Classe.BOURSE].hors_bande)
        self.assertLess(resultat[Classe.BOURSE].ecart_pts, 0)


class TestDeuxMesures(unittest.TestCase):
    def test_l_ecart_en_euros_dit_combien_il_manque(self):
        # 50 % de 60 000 = 30 000 visés, 5 000 détenus : 25 000 de retard.
        resultat = ecarts(bourse=5000, crypto=5000, immobilier=40000, liquidites=10000)
        self.assertAlmostEqual(resultat[Classe.BOURSE].ecart_eur, -25000.0)

    def test_l_ecart_en_points_et_l_ecart_en_euros_ont_le_meme_signe(self):
        # Les deux disent la même chose dans deux unités : un signe divergent
        # ferait afficher « à alléger » à côté d'un montant à investir.
        resultat = ecarts(bourse=5000, crypto=5000, immobilier=40000, liquidites=10000)
        for ecart in resultat.values():
            if ecart.ecart_eur:
                self.assertEqual(ecart.ecart_pts > 0, ecart.ecart_eur > 0)


if __name__ == "__main__":
    unittest.main()
