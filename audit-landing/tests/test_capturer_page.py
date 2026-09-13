"""Tests de la logique pure de capturer_page.py — aucun navigateur requis.

Le découpage en segments est ce qui décide si le futur modèle de vision
reçoit des images lisibles ou un bandeau écrasé (voir l'en-tête du module) :
c'est la partie qui mérite d'être éprouvée sans dépendre du réseau.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from unittest.mock import patch

from capturer_page import (
    Segment,
    calculer_segments,
    installer_filtre_reseau,
    nom_dossier_pour_url,
    verifier_url_publique,
)


class TestCalculerSegments(unittest.TestCase):
    def test_page_plus_courte_qu_un_segment_rend_hero_bas_unique(self):
        segments = calculer_segments(hauteur_totale_px=1200, hauteur_segment_px=1800)
        self.assertEqual(segments, [Segment("01-hero-bas", 0, 1200)])

    def test_deux_segments_exactement_hero_et_bas_sans_milieu(self):
        segments = calculer_segments(hauteur_totale_px=3600, hauteur_segment_px=1800)
        noms = [s.nom for s in segments]
        self.assertEqual(noms, ["01-hero", "02-bas"])

    def test_page_longue_produit_des_segments_milieu_numerotes(self):
        # Une page SaaS typique : ~9000 px physiques pour un segment de 1800.
        segments = calculer_segments(hauteur_totale_px=9000, hauteur_segment_px=1800)
        noms = [s.nom for s in segments]
        self.assertEqual(noms, ["01-hero", "02-milieu", "03-milieu", "04-milieu", "05-bas"])

    def test_aucun_segment_ne_depasse_la_hauteur_demandee(self):
        segments = calculer_segments(hauteur_totale_px=9000, hauteur_segment_px=1800)
        for segment in segments:
            self.assertLessEqual(segment.y_fin_px - segment.y_debut_px, 1800)

    def test_les_segments_couvrent_toute_la_page_sans_trou_ni_chevauchement(self):
        segments = calculer_segments(hauteur_totale_px=9000, hauteur_segment_px=1800)
        self.assertEqual(segments[0].y_debut_px, 0)
        self.assertEqual(segments[-1].y_fin_px, 9000)
        for precedent, suivant in zip(segments, segments[1:]):
            self.assertEqual(precedent.y_fin_px, suivant.y_debut_px)

    def test_dernier_segment_partiel_n_est_pas_rembourre(self):
        # 9000 / 1800 = 5 pile ; on prend une hauteur qui laisse un reste.
        segments = calculer_segments(hauteur_totale_px=9100, hauteur_segment_px=1800)
        self.assertEqual(segments[-1].y_fin_px - segments[-1].y_debut_px, 100)

    def test_hauteur_nulle_ou_negative_refusee(self):
        with self.assertRaises(ValueError):
            calculer_segments(hauteur_totale_px=0, hauteur_segment_px=1800)
        with self.assertRaises(ValueError):
            calculer_segments(hauteur_totale_px=-10, hauteur_segment_px=1800)


class TestNomDossierPourUrl(unittest.TestCase):
    def test_domaine_simple(self):
        self.assertEqual(nom_dossier_pour_url("https://pennylane.com"), "pennylane-com")

    def test_chemin_conserve_pour_distinguer_deux_pages_du_meme_domaine(self):
        self.assertEqual(nom_dossier_pour_url("https://qonto.com/fr"), "qonto-com-fr")

    def test_sous_domaine_conserve(self):
        self.assertEqual(nom_dossier_pour_url("https://app.spendesk.com"), "app-spendesk-com")

    def test_schema_absent_tolere(self):
        self.assertEqual(nom_dossier_pour_url("payfit.com/fr"), "payfit-com-fr")


class TestVerifierUrlPublique(unittest.TestCase):
    @patch("capturer_page.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("93.184.216.34", 443))])
    def test_accepte_un_domaine_public(self, _dns):
        verifier_url_publique("https://example.com/vente")

    @patch("capturer_page.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("127.0.0.1", 80))])
    def test_refuse_loopback(self, _dns):
        with self.assertRaisesRegex(ValueError, "locale ou privée"):
            verifier_url_publique("http://localhost/admin")

    @patch("capturer_page.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("169.254.169.254", 80))])
    def test_refuse_metadonnees_cloud(self, _dns):
        with self.assertRaises(ValueError):
            verifier_url_publique("http://169.254.169.254/latest/meta-data")

    @patch("capturer_page.socket.getaddrinfo", return_value=[
        (2, 1, 6, "", ("93.184.216.34", 443)),
        (2, 1, 6, "", ("10.0.0.5", 443)),
    ])
    def test_refuse_un_dns_mixte_public_prive(self, _dns):
        with self.assertRaises(ValueError):
            verifier_url_publique("https://rebinding.example")

    def test_refuse_identifiants_et_protocoles_non_web(self):
        for url in ("https://user:secret@example.com", "file:///etc/passwd", "ftp://example.com"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                verifier_url_publique(url)

    @patch("capturer_page.verifier_url_publique")
    def test_filtre_intercepte_une_redirection_privee(self, verifier):
        contexte = unittest.mock.Mock()
        installer_filtre_reseau(contexte)
        filtrer = contexte.route.call_args.args[1]
        route = unittest.mock.Mock()
        route.request.url = "http://127.0.0.1/admin"
        verifier.side_effect = ValueError("privée")
        filtrer(route)
        route.abort.assert_called_once_with("blockedbyclient")
        route.continue_.assert_not_called()


if __name__ == "__main__":
    unittest.main()
