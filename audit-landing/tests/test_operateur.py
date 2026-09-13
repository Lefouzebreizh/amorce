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

    @patch("operateur.rendre_html", side_effect=["<html>premier rapport approuvé</html>", "<html>second rapport</html>"])
    @patch("operateur.rendre_markdown", return_value="# Rapport")
    @patch("operateur.dataclasses.asdict", return_value={"rapport": "test"})
    @patch("operateur.analyser_page", return_value=Mock())
    @patch("operateur.capturer_url")
    @patch("operateur.sync_playwright")
    def test_deux_commandes_de_la_meme_url_conservent_leurs_rapports(self, *_mocks):
        self.base.enregistrer("cs_test_2", "https://example.com/vente", "autre@example.com")
        premier = produire(self.base, "cs_test_1", self.racine / "captures")
        self.base.approuver("cs_test_1", "Relecteur test")
        second = produire(self.base, "cs_test_2", self.racine / "captures")
        self.assertEqual(premier.read_text(), "<html>premier rapport approuvé</html>")
        self.assertNotEqual(premier, second)
        envoi = self.base.preparer_envoi("cs_test_1")
        self.assertEqual(envoi["contenu"], b"<html>premier rapport approuv\xc3\xa9</html>")

    @patch("operateur.rendre_html", return_value="<html>rapport</html>")
    @patch("operateur.rendre_markdown", return_value="# Rapport")
    @patch("operateur.dataclasses.asdict", return_value={"rapport": "test"})
    @patch("operateur.analyser_page", side_effect=[RuntimeError("analyse interrompue"), Mock()])
    @patch("operateur.capturer_url")
    @patch("operateur.sync_playwright")
    def test_reprise_ne_reutilise_pas_des_segments_d_une_capture_inachevee(self, playwright, capturer, *_mocks):
        with self.assertRaisesRegex(RuntimeError, "analyse interrompue"):
            produire(self.base, "cs_test_1", self.racine / "captures")
        premiere_sortie = capturer.call_args.args[2]
        self.base.reprendre_analyse("cs_test_1")
        produire(self.base, "cs_test_1", self.racine / "captures")
        self.assertNotEqual(premiere_sortie, capturer.call_args.args[2])

    @patch("operateur.sync_playwright", side_effect=RuntimeError("navigateur indisponible"))
    def test_echec_est_enregistre_pour_reprise_explicite(self, _playwright):
        with self.assertRaises(RuntimeError):
            produire(self.base, "cs_test_1", self.racine / "captures")
        commande = self.base.lire("cs_test_1")
        self.assertEqual(commande["etat"], "echec_analyse")
        self.assertEqual(commande["erreur"], "navigateur indisponible")


if __name__ == "__main__":
    unittest.main()
