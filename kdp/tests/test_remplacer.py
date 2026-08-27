#!/usr/bin/env python3
"""Ce que le remplacement en lot doit tenir.

Le point risqué est la reconnaissance de la page au nom du fichier : une erreur
y poserait le texte d'une histoire sur le dessin d'une autre, et cela ne se
verrait qu'à la relecture du volume imprimé. Le module préfère donc ignorer une
planche plutôt que de deviner, et ces tests vérifient les deux moitiés de cette
promesse — il reconnaît ce qu'il doit, et rend None sur le reste.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import charte  # noqa: E402
from pipeline.remplacer import _page_du_nom, pique  # noqa: E402

import numpy as np  # noqa: E402


class ReconnaitreLaPage(unittest.TestCase):
    def test_le_nom_du_depot(self):
        self.assertEqual(
            _page_du_nom(Path("RoussyEtZephy_Page04_FaireLeSinge.png"), 1), 4)

    def test_les_formes_relachees_du_numero(self):
        for nom in ("page 12.jpg", "Page-12.png", "planche_page12_v2.webp"):
            self.assertEqual(_page_du_nom(Path(nom), 1), 12, nom)

    def test_le_slug_seul_suffit(self):
        self.assertEqual(_page_du_nom(Path("faimdeloup_final.png"), 1), 5)
        self.assertEqual(_page_du_nom(Path("Le-Secret-Des-Vagues-D-Ys.jpg"), 1), 17)

    def test_un_nom_muet_ne_se_devine_pas(self):
        """Rendre None coûte un renommage ; deviner coûte un livre à refaire."""
        for nom in ("image finale.jpg", "IMG_20260827.png", "sans titre (3).webp"):
            self.assertIsNone(_page_du_nom(Path(nom), 1), nom)

    def test_toute_page_du_sommaire_se_retrouve_par_son_nom_de_depot(self):
        for p in charte.TOME_1:
            nom = Path(f"RoussyEtZephy_Page{p.numero:02d}_{p.slug}.png")
            self.assertEqual(_page_du_nom(nom, 1), p.numero, nom.name)


class Pique(unittest.TestCase):
    def test_une_image_floue_mesure_moins_qu_une_nette(self):
        import cv2
        nette = np.zeros((400, 400), np.uint8)
        nette[::20, :] = 255                      # rayures franches
        floue = cv2.GaussianBlur(nette, (9, 9), 0)
        self.assertGreater(pique(nette), pique(floue))

    def test_un_aplat_uni_ne_leve_pas(self):
        """Sans aucun contour, la mesure doit rendre zéro et non lever."""
        self.assertEqual(pique(np.full((100, 100), 128, np.uint8)), 0.0)


if __name__ == "__main__":
    unittest.main()
