#!/usr/bin/env python3
"""Ce que le lettrage vectoriel doit tenir.

Le défaut qui a motivé ces tests ne se voyait pas dans le texte extrait du PDF,
seulement à l'écran : Lora ne dessine pas l'espace fine insécable, et posait à
sa place un glyphe parasite — « Ouvre grand ! » sortait « Ouvre grandn ! ». Le
contrôle porte donc sur *toute* la matière des deux dossiers, pas sur le seul
caractère fautif : c'est la classe de défaut qu'on garde, pas son exemplaire.
"""

import sys
import tempfile
import unittest
from pathlib import Path

import fitz
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import charte  # noqa: E402
from pipeline import lettrage  # noqa: E402

DOSSIERS = [Path(__file__).parents[1] / f"tome{t}/DOSSIER.md" for t in (1, 2)]


class Repliques(unittest.TestCase):
    def test_un_seul_locuteur(self):
        self.assertEqual(lettrage.repliques("Roussy : J’ai faim."),
                         [("Roussy", "J’ai faim.")])

    def test_deux_locuteurs_separes_par_un_cadratin(self):
        d = lettrage.repliques("Roussy : J’ai faim. — Zéphy : Déjà ?")
        self.assertEqual(d, [("Roussy", "J’ai faim."), ("Zéphy", "Déjà ?")])

    def test_un_cadratin_dans_la_phrase_ne_coupe_pas(self):
        """Sans nom propre suivi de deux-points, ce n'est pas un changement."""
        d = lettrage.repliques("Roussy : Un jour — un seul — tout ira bien.")
        self.assertEqual(len(d), 1)


class Police(unittest.TestCase):
    def test_toute_la_matiere_des_dossiers_se_dessine(self):
        police = fitz.Font(fontfile=str(lettrage.CORPS))
        manquants = {}
        for chemin in DOSSIERS:
            if not chemin.exists():
                continue
            for numero, page in lettrage._dossier(chemin).items():
                morceaux = [page["titre"], page["parchemin"]]
                morceaux += [t for _, t in page["repliques"]]
                for texte in morceaux:
                    for c in lettrage.rendable(texte):
                        if not police.has_glyph(ord(c)):
                            manquants.setdefault(c, []).append(
                                f"{chemin.parent.name} p.{numero}")
        self.assertEqual(manquants, {},
                         "caractères absents de Lora après substitution : "
                         + ", ".join(f"U+{ord(c):04X}" for c in manquants))

    def test_la_substitution_vise_bien_des_absents(self):
        """Un remplacement vers un caractère lui aussi absent ne servirait à rien."""
        police = fitz.Font(fontfile=str(lettrage.CORPS))
        for absent, present in lettrage.SANS_GLYPHE.items():
            self.assertFalse(police.has_glyph(ord(absent)),
                             f"U+{ord(absent):04X} n'est pas absent, "
                             "la substitution est inutile")
            self.assertTrue(police.has_glyph(ord(present)),
                            f"U+{ord(present):04X} est absent lui aussi")


class HauteurUtile(unittest.TestCase):
    def test_un_texte_plus_long_demande_plus_de_hauteur(self):
        g = charte.GABARIT_INTERIEUR
        self.assertLess(lettrage.hauteur_utile(g, 200, "Miaou !", 11),
                        lettrage.hauteur_utile(g, 200, "Miaou ! " * 12, 11))

    def test_la_hauteur_rendue_suffit_vraiment(self):
        g = charte.GABARIT_INTERIEUR
        texte = "Et c’est beaucoup plus joli qu’une tête qui boude ! HI HI !"
        haut = lettrage.hauteur_utile(g, 200, texte, 11)
        d = fitz.open()
        p = d.new_page(width=g.points[0], height=g.points[1])
        p.insert_font(fontname="corps", fontfile=str(lettrage.CORPS))
        reste = p.insert_textbox(fitz.Rect(0, 0, 200, haut), lettrage.rendable(texte),
                                 fontname="corps", fontsize=11,
                                 align=fitz.TEXT_ALIGN_CENTER, lineheight=1.25)
        d.close()
        self.assertGreaterEqual(reste, 0)


class Composition(unittest.TestCase):
    def _composer(self, numero: int, dossier: Path):
        pages = lettrage._dossier(DOSSIERS[0])
        planche = dossier / "fond.png"
        Image.new("RGB", (600, 600), (250, 244, 230)).save(planche)
        cible = dossier / "page.pdf"
        lettrage.composer(planche, cible, pages[numero], 1, numero)
        return fitz.open(cible)

    def test_la_page_sort_au_gabarit_avec_toutes_ses_repliques(self):
        with tempfile.TemporaryDirectory() as d:
            doc = self._composer(5, Path(d))
            self.assertEqual(len(doc), 1)
            largeur, hauteur = charte.GABARIT_INTERIEUR.points
            self.assertAlmostEqual(doc[0].rect.width, largeur, places=2)
            self.assertAlmostEqual(doc[0].rect.height, hauteur, places=2)

            serre = "".join(doc[0].get_text().split())
            pages = lettrage._dossier(DOSSIERS[0])
            for _, ligne in pages[5]["repliques"]:
                for _, texte in lettrage.repliques(ligne):
                    self.assertIn("".join(lettrage.rendable(texte).split()), serre)
            doc.close()

    def test_aucune_fine_insecable_ne_survit_dans_le_pdf(self):
        with tempfile.TemporaryDirectory() as d:
            doc = self._composer(5, Path(d))
            texte = doc[0].get_text()
            for absent in lettrage.SANS_GLYPHE:
                self.assertNotIn(absent, texte)
            doc.close()

    def test_les_quatre_cases_ne_se_chevauchent_pas(self):
        for i, a in enumerate(lettrage.CASES):
            for b in lettrage.CASES[i + 1:]:
                separe = a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1]
                self.assertTrue(separe, f"cases superposées : {a} et {b}")

    def test_chaque_nombre_de_bulles_rencontre_a_un_placement(self):
        """Une case à trois répliques sans placement lèverait à la composition."""
        for chemin in DOSSIERS:
            if not chemin.exists():
                continue
            for numero, page in lettrage._dossier(chemin).items():
                for panneau, ligne in page["repliques"]:
                    n = len(lettrage.repliques(ligne))
                    self.assertIn(n, lettrage.OFFRE,
                                  f"{chemin.parent.name} p.{numero} case {panneau} : "
                                  f"{n} bulles, aucun placement")


if __name__ == "__main__":
    unittest.main()
