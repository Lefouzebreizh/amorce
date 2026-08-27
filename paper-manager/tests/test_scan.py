#!/usr/bin/env python3
"""Ce que la lecture d'un fichier déposé doit tenir.

Les fichiers d'essai sont fabriqués à l'exécution : ce dépôt ne versionne aucun
binaire, et un PDF en est un.
"""

import sys
import tempfile
import unittest
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.scan import (  # noqa: E402
    PAGES_RENDUES_MAX, ErreurLecture, empreinte, format_de, lire,
)


def pdf_avec_texte(chemin: Path, pages: int = 1, par_page: str = "Facture EDF " * 30) -> Path:
    document = pymupdf.open()
    for _ in range(pages):
        page = document.new_page()
        page.insert_textbox(pymupdf.Rect(50, 50, 545, 700), par_page, fontsize=9)
    document.save(chemin)
    document.close()
    return chemin


def pdf_scanne(chemin: Path, pages: int = 1, entete: str = "") -> Path:
    """Un scan : des pixels, et au plus quelques caractères d'en-tête."""
    document = pymupdf.open()
    for _ in range(pages):
        page = document.new_page()
        page.draw_rect(pymupdf.Rect(40, 40, 555, 750), color=(0.9, 0.9, 0.9), fill=(0.93, 0.93, 0.93))
        if entete:
            page.insert_text((50, 30), entete, fontsize=8)
    document.save(chemin)
    document.close()
    return chemin


class Format(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.addCleanup(self.dossier.cleanup)
        self.chemin = Path(self.dossier.name)

    def test_le_format_se_lit_sur_les_octets_et_non_sur_l_extension(self):
        # Un « .jpg » d'iPhone est souvent un HEIC, et un « .pdf » renommé à la
        # main n'en est pas un : l'extension ment, les octets non.
        menteur = self.chemin / "facture.pdf"
        menteur.write_bytes(b"PK\x03\x04 une archive deguisee")
        with self.assertRaises(ErreurLecture) as leve:
            format_de(menteur)
        self.assertIn("format non reconnu", str(leve.exception))

    def test_un_vrai_pdf_est_reconnu_meme_sans_extension(self):
        sans_nom = pdf_avec_texte(self.chemin / "document")
        self.assertEqual(format_de(sans_nom), "pdf")

    def test_une_image_est_reconnue_sur_sa_signature(self):
        image = self.chemin / "photo.bin"
        pymupdf.open().new_page().get_pixmap().save(image, output="png")
        self.assertEqual(format_de(image), "png")

    def test_un_fichier_vide_le_dit_plutot_que_de_se_taire(self):
        vide = self.chemin / "vide.pdf"
        vide.write_bytes(b"")
        with self.assertRaises(ErreurLecture) as leve:
            format_de(vide)
        self.assertIn("vide", str(leve.exception))


class Empreinte(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.addCleanup(self.dossier.cleanup)
        self.chemin = Path(self.dossier.name)

    def test_le_meme_contenu_sous_deux_noms_a_la_meme_empreinte(self):
        # C'est ce qui permet de reconnaître un doublon issu d'une synchronisation.
        octets = pdf_avec_texte(self.chemin / "a.pdf").read_bytes()
        (self.chemin / "copie-de-a.pdf").write_bytes(octets)
        self.assertEqual(empreinte(self.chemin / "a.pdf"),
                         empreinte(self.chemin / "copie-de-a.pdf"))

    def test_un_octet_qui_change_change_l_empreinte(self):
        original = pdf_avec_texte(self.chemin / "a.pdf")
        avant = empreinte(original)
        octets = bytearray(original.read_bytes())
        octets[-1] ^= 0x01
        (self.chemin / "b.pdf").write_bytes(bytes(octets))
        self.assertNotEqual(avant, empreinte(self.chemin / "b.pdf"))


class Lecture(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.addCleanup(self.dossier.cleanup)
        self.chemin = Path(self.dossier.name)
        self.images = self.chemin / "images"

    def test_un_pdf_qui_porte_son_texte_est_lu_sans_rien_rendre(self):
        # Le relire en image, c'est payer et perdre en fiabilité pour rien.
        lecture = lire(pdf_avec_texte(self.chemin / "facture.pdf"), dossier_images=self.images)
        self.assertTrue(lecture.a_du_texte)
        self.assertIn("Facture EDF", lecture.texte)
        self.assertEqual(lecture.images, [])
        self.assertFalse(self.images.exists())

    def test_un_scan_est_rendu_en_image(self):
        lecture = lire(pdf_scanne(self.chemin / "scan.pdf"), dossier_images=self.images)
        self.assertFalse(lecture.a_du_texte)
        self.assertEqual(len(lecture.images), 1)
        self.assertTrue(lecture.images[0].exists())

    def test_quelques_caracteres_d_en_tete_ne_font_pas_un_document_lisible(self):
        # Le piège : un PDF scanné portant « Page 1 sur 3 » en surimpression
        # aurait l'air d'avoir son texte, et personne n'en tirerait un champ.
        lecture = lire(pdf_scanne(self.chemin / "scan.pdf", entete="Page 1 sur 3"),
                       dossier_images=self.images)
        self.assertFalse(lecture.a_du_texte)
        self.assertEqual(len(lecture.images), 1)

    def test_le_rendu_s_arrete_aux_premieres_pages(self):
        # Les champs sont en tête ; rendre quarante pages à 200 ppp coûte des
        # secondes et des mégaoctets pour rien.
        lecture = lire(pdf_scanne(self.chemin / "releve.pdf", pages=12),
                       dossier_images=self.images)
        self.assertEqual(len(lecture.images), PAGES_RENDUES_MAX)

    def test_une_image_deposee_est_deja_son_image(self):
        image = self.chemin / "photo.png"
        pymupdf.open().new_page().get_pixmap().save(image)
        lecture = lire(image, dossier_images=self.images)
        self.assertEqual(lecture.images, [image])
        self.assertEqual(lecture.pages, 1)

    def test_le_fichier_depose_n_est_jamais_touche(self):
        # Le rangement appartient à `nommage.py`, et seulement quand on lui demande.
        source = pdf_avec_texte(self.chemin / "facture.pdf")
        avant = empreinte(source)
        lire(source, dossier_images=self.images)
        self.assertTrue(source.exists())
        self.assertEqual(empreinte(source), avant)

    def test_un_fichier_absent_le_dit_clairement(self):
        with self.assertRaises(ErreurLecture) as leve:
            lire(self.chemin / "jamais-depose.pdf")
        self.assertIn("introuvable", str(leve.exception))


if __name__ == "__main__":
    unittest.main()
