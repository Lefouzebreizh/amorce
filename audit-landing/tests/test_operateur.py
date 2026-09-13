import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from commandes import Commandes
from operateur import produire


class TestOperateur(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.racine = Path(self.tmp.name)
        self.base = Commandes(self.racine / "commandes.sqlite")
        self.base.enregistrer("cs_test_1", "https://example.com/vente", "client@example.com")

    def tearDown(self):
        self.base.fermer()
        self.tmp.cleanup()

    @patch("operateur.rendre_html", return_value="<html>rapport</html>")
    @patch("operateur.rendre_markdown", return_value="# Rapport")
    @patch("operateur.dataclasses.asdict", return_value={"rapport": "test"})
    @patch("operateur.analyser_page", return_value=Mock())
    @patch("operateur.capturer_url")
    @patch("operateur.sync_playwright")
    def test_produit_puis_attend_la_relecture(self, playwright, capturer, analyser, asdict, markdown, html):
        contexte = playwright.return_value.__enter__.return_value.chromium.launch.return_value.new_context.return_value
        chemin = produire(self.base, "cs_test_1", self.racine / "captures")
        self.assertEqual(chemin.read_text(), "<html>rapport</html>")
        self.assertEqual(self.base.lire("cs_test_1")["etat"], "relecture")
        capturer.assert_called_once()

    def test_refuse_de_retraiter_une_commande_deja_prise(self):
        self.base.prendre("cs_test_1")
        with self.assertRaisesRegex(ValueError, "déjà prise"):
            produire(self.base, "cs_test_1", self.racine / "captures")


if __name__ == "__main__":
    unittest.main()
