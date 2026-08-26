#!/usr/bin/env python3
"""Ce que la comparaison de planches doit tenir.

Les cas se fabriquent : une image et sa copie décalée, une image et sa copie
amputée d'un coin, deux images sans rapport. C'est ainsi qu'on a découvert que
le SSIM répondait à la mauvaise question — il notait deux dessins de la même
scène comme deux planches étrangères.
"""

import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from reprise import (  # noqa: E402
    CADRAGE, Ecart, correlation, decalage, masses, zones,
)


def paysage(cote=CADRAGE) -> np.ndarray:
    """Une image sans motif répété, sur laquelle un décalage a une seule réponse.

    Un damier serait plus simple à écrire et faux à mesurer : périodique, il se
    recale aussi bien avec plusieurs décalages différents, et la corrélation de
    phase rend l'un d'eux au hasard.
    """
    tirage = np.random.default_rng(3)
    image = np.zeros((cote, cote))
    for _ in range(12):
        y, x = tirage.integers(40, cote - 80, size=2)
        h, w = tirage.integers(20, 70, size=2)
        image[y:y + h, x:x + w] = tirage.integers(60, 240)
    return image


class TestMasses(unittest.TestCase):
    def test_la_grille_resume_l_image(self):
        image = np.zeros((512, 512))
        image[:256, :256] = 100.0
        grille = masses(image, grille=8)
        self.assertEqual(grille.shape, (8, 8))
        self.assertAlmostEqual(grille[0, 0], 100.0)
        self.assertAlmostEqual(grille[7, 7], 0.0)


class TestCorrelation(unittest.TestCase):
    def test_deux_grilles_identiques_correlent_parfaitement(self):
        grille = np.arange(64, dtype=float).reshape(8, 8)
        self.assertAlmostEqual(correlation(grille, grille), 1.0)

    def test_une_grille_inversee_correle_a_l_oppose(self):
        grille = np.arange(64, dtype=float).reshape(8, 8)
        self.assertAlmostEqual(correlation(grille, -grille), -1.0)

    def test_une_grille_uniforme_ne_correle_avec_rien(self):
        # Sans variation, il n'y a pas de composition à comparer : rendre 0
        # plutôt que diviser par zéro.
        plate = np.full((8, 8), 42.0)
        self.assertEqual(correlation(plate, np.arange(64, dtype=float).reshape(8, 8)), 0.0)


class TestDecalage(unittest.TestCase):
    def test_le_decalage_rendu_est_celui_qui_recale(self):
        # La convention qui compte : `np.roll(apres, decalage(avant, apres))`
        # doit ramener la reprise dans le cadrage de l'originale.
        image = paysage()
        deplacee = np.roll(image, (7, -5), axis=(0, 1))
        rendu = decalage(image, deplacee)
        self.assertEqual(rendu, (-7, 5))
        recalee = np.roll(deplacee, rendu, axis=(0, 1))
        self.assertAlmostEqual(float(np.abs(image - recalee).mean()), 0.0)

    def test_deux_images_calees_ne_bougent_pas(self):
        image = paysage()
        self.assertEqual(decalage(image, image), (0, 0))


class TestZones(unittest.TestCase):
    def test_la_zone_qui_change_est_celle_qu_on_nomme(self):
        a = np.zeros((8, 8))
        b = np.zeros((8, 8))
        b[6:, 6:] = 90.0                      # le coin bas-droit
        ecart = Ecart(correlation=0.9, moyen=5.0, zones=zones(a, b))
        self.assertEqual(ecart.pire[1], 'en bas à droite')
        self.assertAlmostEqual(ecart.pire[0], 90.0)


class TestVerdict(unittest.TestCase):
    def test_une_reprise_fidele_tient(self):
        self.assertTrue(Ecart(0.97, 6.0, np.full((4, 4), 8.0)).tenue)

    def test_une_scene_differente_ne_tient_pas(self):
        self.assertFalse(Ecart(0.72, 23.0, np.full((4, 4), 25.0)).tenue)

    def test_une_bonne_note_d_ensemble_ne_sauve_pas_une_zone_qui_a_bougé(self):
        # Le cas qui justifie les zones : un quart redessiné laisse la moyenne
        # rassurante. Sans ce contrôle, on valide sans regarder.
        zones_locales = np.full((4, 4), 5.0)
        zones_locales[3, 3] = 60.0
        self.assertFalse(Ecart(0.86, 6.8, zones_locales).tenue)


if __name__ == '__main__':
    unittest.main()
