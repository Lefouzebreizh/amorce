#!/usr/bin/env python3
"""Ce que le contrôle des planches doit tenir.

Les mesures se vérifient sur des images fabriquées à la main, où l'on sait
combien il y a de lettres et de quelle taille. C'est la seule façon de savoir si
une médiane qui « paraît plausible » sur une vraie planche mesure bien ce qu'elle
prétend mesurer — deux mesures antérieures ont été jetées pour l'avoir oublié.
"""

import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import charte  # noqa: E402
from planches import (  # noqa: E402
    Mesures, controler, epaisseur_du_trait, hauteurs_de_lettres, millimetres,
)


def bulle_vide(hauteur=60, largeur=80) -> np.ndarray:
    return np.zeros((hauteur, largeur), dtype=bool)


class TestHauteurDesLettres(unittest.TestCase):
    def test_trois_lettres_de_meme_taille(self):
        encre = bulle_vide()
        for colonne in (5, 20, 35):
            encre[10:20, colonne:colonne + 6] = True
        self.assertEqual(hauteurs_de_lettres(encre), [10, 10, 10])

    def test_une_poussiere_ne_compte_pas_pour_une_lettre(self):
        # Le grain de compression d'un WebP en sème des dizaines par bulle.
        encre = bulle_vide()
        encre[10:20, 5:11] = True
        encre[40:42, 40:42] = True
        self.assertEqual(hauteurs_de_lettres(encre), [10])

    def test_le_contour_de_la_bulle_n_est_pas_une_lettre(self):
        # Un trait qui traverse la bulle : c'est son cerne, et il mesurerait
        # quatre-vingts pixels de large.
        encre = bulle_vide()
        encre[2:5, :] = True
        encre[10:20, 5:11] = True
        self.assertEqual(hauteurs_de_lettres(encre), [10])

    def test_deux_lettres_qui_se_touchent_comptent_pour_une(self):
        # Limite acceptée : un accent collé à sa lettre fait une composante. La
        # médiane sur des centaines de lettres l'absorbe, là où la mesure par
        # bandes d'encre se trompait d'un facteur deux.
        encre = bulle_vide()
        encre[10:20, 5:11] = True
        encre[19:26, 8:12] = True
        self.assertEqual(hauteurs_de_lettres(encre), [16])

    def test_une_bulle_sans_encre_ne_rend_rien(self):
        self.assertEqual(hauteurs_de_lettres(bulle_vide()), [])


class TestEpaisseurDuTrait(unittest.TestCase):
    def test_la_mediane_des_courses_d_encre(self):
        encre = bulle_vide(hauteur=4, largeur=40)
        encre[0, 0:2] = True       # course de 2
        encre[1, 0:4] = True       # course de 4
        encre[2, 10:13] = True     # course de 3
        self.assertEqual(epaisseur_du_trait(encre), 3.0)

    def test_un_aplat_n_est_pas_un_trait(self):
        encre = bulle_vide(hauteur=3, largeur=40)
        encre[0, 0:3] = True
        encre[1, 0:30] = True      # au-delà de douze pixels : un aplat
        self.assertEqual(epaisseur_du_trait(encre), 3.0)

    def test_sans_encre_l_epaisseur_est_nulle(self):
        self.assertEqual(epaisseur_du_trait(bulle_vide()), 0.0)


class TestConversion(unittest.TestCase):
    def test_les_pixels_deviennent_des_millimetres_de_page(self):
        # 1600 px sur 8,625 pouces : un pixel vaut 0,137 mm.
        self.assertAlmostEqual(millimetres(12, 1600, charte.GABARIT_INTERIEUR), 1.64, places=2)


def mesures(**remplace) -> Mesures:
    base = dict(largeur=2588, hauteur=2588, mode='RGB', bulles=3, lettres=200,
                oeil_px=20, oeil_mm=2.4, trait_mm=0.3, flou=0.5)
    base.update(remplace)
    return Mesures(**base)


class TestVerdicts(unittest.TestCase):
    def test_une_planche_conforme_passe_tout(self):
        controles = controler(mesures(), charte.GABARIT_INTERIEUR)
        self.assertTrue(all(c.passe for c in controles))

    def test_une_planche_trop_petite_est_recalee(self):
        controles = controler(mesures(largeur=1600), charte.GABARIT_INTERIEUR)
        resolution = next(c for c in controles if c.intitule == 'Résolution')
        self.assertFalse(resolution.passe)
        self.assertIn('2588', resolution.conseil)

    def test_un_texte_sous_le_confort_avertit_sans_recaler(self):
        # Un corps 9 se lit, il fatigue. Recaler la planche pour cela ferait
        # ignorer le rapport entier.
        controle = next(c for c in controler(mesures(oeil_mm=1.7), charte.GABARIT_INTERIEUR)
                        if c.intitule == 'Hauteur d’œil')
        self.assertTrue(controle.passe)
        self.assertTrue(controle.conseil)

    def test_un_texte_sous_le_minimum_recale(self):
        controle = next(c for c in controler(mesures(oeil_mm=1.4), charte.GABARIT_INTERIEUR)
                        if c.intitule == 'Hauteur d’œil')
        self.assertFalse(controle.passe)

    def test_un_trait_trop_fin_recale(self):
        controle = next(c for c in controler(mesures(trait_mm=0.08), charte.GABARIT_INTERIEUR)
                        if c.intitule == 'Épaisseur du trait')
        self.assertFalse(controle.passe)

    def test_une_planche_sans_bulle_ne_juge_pas_le_texte(self):
        controles = controler(mesures(lettres=0), charte.GABARIT_INTERIEUR)
        self.assertEqual([c.intitule for c in controles], ['Résolution', 'Texte des bulles'])


if __name__ == '__main__':
    unittest.main()
