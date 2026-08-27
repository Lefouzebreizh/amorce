#!/usr/bin/env python3
"""Ce que le lettrage vectoriel de la page 4 doit tenir.

Le réglage non trivial est le resserrement de la bulle : on la rétrécit tant
que cela n'ajoute pas de ligne. Écrit à l'envers, il produirait des bulles qui
paraissent correctes en aperçu et débordent sur une réplique plus longue —
défaut qui ne se voit qu'à la planche suivante.
"""

import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import charte  # noqa: E402
from pipeline import page04  # noqa: E402

COURT = "Miaou !"
LONG = ("Et c’est beaucoup plus joli qu’une tête qui boude ! "
        "HI HI ! Vraiment beaucoup plus joli, tu peux me croire.")


class HauteurUtile(unittest.TestCase):
    def test_un_texte_plus_long_demande_plus_de_hauteur(self):
        g = charte.GABARIT_INTERIEUR
        self.assertLess(page04._hauteur_utile(g, 200, COURT, 11),
                        page04._hauteur_utile(g, 200, LONG, 11))

    def test_une_bulle_plus_etroite_demande_plus_de_hauteur(self):
        g = charte.GABARIT_INTERIEUR
        self.assertLessEqual(page04._hauteur_utile(g, 260, LONG, 11),
                             page04._hauteur_utile(g, 130, LONG, 11))

    def test_la_hauteur_suffit_vraiment(self):
        """La hauteur rendue doit faire tenir le texte, pas presque."""
        import fitz
        g = charte.GABARIT_INTERIEUR
        haut = page04._hauteur_utile(g, 200, LONG, 11)
        d = fitz.open()
        p = d.new_page(width=g.points[0], height=g.points[1])
        p.insert_font(fontname="corps", fontfile=str(page04.CORPS))
        reste = p.insert_textbox(fitz.Rect(0, 0, 200, haut), LONG,
                                 fontname="corps", fontsize=11,
                                 align=fitz.TEXT_ALIGN_CENTER, lineheight=1.25)
        d.close()
        self.assertGreaterEqual(reste, 0)


class Composition(unittest.TestCase):
    def test_la_page_sort_au_gabarit_et_porte_toutes_les_repliques(self):
        import fitz
        with tempfile.TemporaryDirectory() as dossier:
            planche = Path(dossier) / "fond.png"
            Image.new("RGB", (600, 600), (250, 244, 230)).save(planche)
            cible = Path(dossier) / "page.pdf"
            page04.composer(planche, cible)

            d = fitz.open(cible)
            self.assertEqual(len(d), 1)
            largeur, hauteur = charte.GABARIT_INTERIEUR.points
            self.assertAlmostEqual(d[0].rect.width, largeur, places=2)
            self.assertAlmostEqual(d[0].rect.height, hauteur, places=2)

            # Le texte rendu est replié sur plusieurs lignes : on compare sans
            # les blancs, sinon on teste le point de césure et non la présence.
            serre = "".join(d[0].get_text().split())
            for _, _, replique, _ in page04.BULLES:
                self.assertIn("".join(replique.split()), serre,
                              f"réplique absente : {replique[:30]}")
            self.assertIn("".join(page04.PARCHEMIN.split()), serre)
            self.assertIn("".join(page04.TITRE.split()), serre)
            d.close()

    def test_les_quatre_cases_ne_se_chevauchent_pas(self):
        for i, a in enumerate(page04.CASES):
            for b in page04.CASES[i + 1:]:
                separe = a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1]
                self.assertTrue(separe, f"cases superposées : {a} et {b}")


if __name__ == "__main__":
    unittest.main()
