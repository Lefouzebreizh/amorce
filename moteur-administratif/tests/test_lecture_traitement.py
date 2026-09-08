"""Le pipeline fichier → texte : texte natif d'abord, OCR local ensuite.

Ces tests créent de vrais PDF et de vraies images avec `pymupdf`, et — pour
l'OCR — appellent le vrai `tesseract` de la machine : c'est la seule façon de
vérifier que l'appel en ligne de commande (entrée standard, `--tessdata-dir`,
décodage de la sortie) fonctionne réellement, pas seulement que le code
compile. Les classes qui en ont besoin se désactivent d'elles-mêmes sur une
machine qui ne les a pas.
"""

import importlib.util
import tempfile
import unittest
from pathlib import Path

from moteur_administratif.lecture import outils_ocr
from moteur_administratif.lecture.traitement import capacites, extraire

PYMUPDF_PRESENT = importlib.util.find_spec("pymupdf") is not None
PYPDF_PRESENT = importlib.util.find_spec("pypdf") is not None
TESSERACT_PRESENT = outils_ocr.trouver_tesseract() is not None


class TestCapacites(unittest.TestCase):
    def test_possible_quand_pypdf_installe(self):
        possible, _ = capacites()
        self.assertTrue(possible)

    def test_pas_de_manque_sur_les_langues_sans_dossier_demande(self):
        _, manques = capacites(dossier_langues=None)
        self.assertFalse(any("Langue" in m for m in manques))


@unittest.skipUnless(PYMUPDF_PRESENT and PYPDF_PRESENT, "pymupdf/pypdf absents")
class TestTexteNatif(unittest.TestCase):
    def _pdf_avec_texte(self, dossier: Path, pages: list[str]) -> Path:
        import pymupdf

        document = pymupdf.open()
        for texte in pages:
            page = document.new_page()
            page.insert_text((72, 72), texte, fontsize=14)
        chemin = dossier / "document.pdf"
        document.save(chemin)
        document.close()
        return chemin

    def test_pdf_numerique_pris_par_le_texte_natif(self):
        with tempfile.TemporaryDirectory() as dossier:
            # Assez long pour dépasser CARACTERES_MINIMAUX_PAR_PAGE (40) : en
            # dessous, le module bascule sur la rastérisation, à raison — un
            # PDF scanné en rend souvent quelques-uns, glissés par le logiciel
            # de numérisation.
            chemin = self._pdf_avec_texte(
                Path(dossier), ["Facture EDF, net à payer 78,42 euros, référence AB-12345."])
            resultat = extraire([chemin])
        self.assertEqual(len(resultat), 1)
        extraction = resultat[0]
        self.assertTrue(extraction.lisible)
        self.assertEqual(extraction.origine, "texte natif")
        self.assertIn("Facture EDF", extraction.texte)
        self.assertEqual(extraction.pages_lues, 1)

    def test_pages_max_borne_la_lecture(self):
        with tempfile.TemporaryDirectory() as dossier:
            chemin = self._pdf_avec_texte(
                Path(dossier), ["Contenu de la page un, assez long pour dépasser le seuil.",
                                "Contenu de la page deux, assez long pour dépasser le seuil.",
                                "Contenu de la page trois, assez long pour dépasser le seuil."])
            [extraction] = extraire([chemin], pages_max=2)
        self.assertEqual(extraction.pages_lues, 2)
        self.assertIn("page un", extraction.texte)
        self.assertIn("page deux", extraction.texte)
        self.assertNotIn("page trois", extraction.texte)

    def test_pdf_illisible_consigne_et_marque_illisible(self):
        with tempfile.TemporaryDirectory() as dossier:
            chemin = Path(dossier) / "casse.pdf"
            chemin.write_bytes(b"ceci n'est pas un PDF")
            consignes = []
            [extraction] = extraire([chemin], consigner=lambda c, d: consignes.append((c, d)))
        self.assertFalse(extraction.lisible)
        self.assertTrue(extraction.diagnostic)
        self.assertEqual(consignes, [(chemin, extraction.diagnostic)])


@unittest.skipUnless(PYMUPDF_PRESENT and TESSERACT_PRESENT, "pymupdf/tesseract absents")
class TestOcr(unittest.TestCase):
    def test_image_sans_texte_incorpore_passe_par_l_ocr(self):
        import pymupdf

        with tempfile.TemporaryDirectory() as dossier:
            # Une page dont le texte est **rendu en pixels**, sans couche de
            # texte : c'est ce qui force le chemin OCR, comme une vraie photo.
            document = pymupdf.open()
            page = document.new_page(width=400, height=200)
            page.insert_text((20, 100), "BONJOUR", fontsize=48)
            image = Path(dossier) / "photo.png"
            page.get_pixmap(dpi=200).save(image)
            document.close()

            [extraction] = extraire([image], langues=("eng",))
        self.assertTrue(extraction.lisible, extraction.diagnostic)
        self.assertEqual(extraction.origine, "OCR")
        self.assertTrue(extraction.texte.strip())

    def test_fichier_image_illisible(self):
        with tempfile.TemporaryDirectory() as dossier:
            chemin = Path(dossier) / "vide.png"
            chemin.write_bytes(b"")
            [extraction] = extraire([chemin], langues=("eng",))
        # Un fichier vide n'est pas une image : tesseract le refuse, et le
        # diagnostic doit le dire plutôt que planter.
        self.assertFalse(extraction.lisible)
        self.assertTrue(extraction.diagnostic)


if __name__ == "__main__":
    unittest.main()
