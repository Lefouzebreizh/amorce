"""Tests de la logique pure d'analyser_captures.py — aucun réseau, aucune clé.

Ce qui appelle réellement Claude (analyser_page) n'est pas testé ici : c'est
la partie qui décide quoi faire de sa réponse — lister les segments, encoder
une image, parser et valider le JSON rendu, mettre en forme le rapport — qui
mérite d'être éprouvée sans dépendre d'un compte, et c'est ce qui reste vrai
que la réponse vienne d'un vrai appel ou d'un texte fabriqué à la main.
"""

import base64
import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from analyser_captures import (
    CATEGORIES,
    Categorie,
    Constat,
    Rapport,
    analyser_reponse_json,
    construire_messages,
    encoder_image_base64,
    lister_segments,
    rendre_markdown,
)

# Un PNG 1×1 minimal — suffisant pour vérifier l'encodage, pas pour être
# affiché : aucun des tests ici n'a besoin d'une image qui se décode.
OCTETS_PNG_MINIMAL = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


class TestListerSegments(unittest.TestCase):
    def test_ordre_alphabetique_donc_ordre_de_lecture(self):
        with TemporaryDirectory() as tmp:
            dossier = Path(tmp)
            for nom in ["03-milieu.png", "01-hero.png", "02-milieu.png"]:
                (dossier / nom).write_bytes(OCTETS_PNG_MINIMAL)
            noms = [p.name for p in lister_segments(dossier)]
            self.assertEqual(noms, ["01-hero.png", "02-milieu.png", "03-milieu.png"])

    def test_capture_de_reference_pleine_page_exclue(self):
        # 00-pleine-page.png reste en full_page=True côté capturer_page.py et
        # peut donc être tronquée sur une page très haute (voir son propre
        # correctif d'échelle) : elle ne doit jamais être analysée comme un
        # segment de lecture.
        with TemporaryDirectory() as tmp:
            dossier = Path(tmp)
            (dossier / "00-pleine-page.png").write_bytes(OCTETS_PNG_MINIMAL)
            (dossier / "01-hero.png").write_bytes(OCTETS_PNG_MINIMAL)
            noms = [p.name for p in lister_segments(dossier)]
            self.assertEqual(noms, ["01-hero.png"])

    def test_dossier_introuvable_leve_erreur(self):
        with self.assertRaises(ValueError):
            lister_segments(Path("/chemin/qui/n/existe/pas"))

    def test_dossier_vide_leve_erreur(self):
        with TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                lister_segments(Path(tmp))

    def test_dossier_avec_seulement_la_reference_leve_erreur(self):
        with TemporaryDirectory() as tmp:
            dossier = Path(tmp)
            (dossier / "00-pleine-page.png").write_bytes(OCTETS_PNG_MINIMAL)
            with self.assertRaises(ValueError):
                lister_segments(dossier)


class TestEncoderImageBase64(unittest.TestCase):
    def test_rendu_conforme_a_imageblockparam(self):
        with TemporaryDirectory() as tmp:
            chemin = Path(tmp) / "01-hero.png"
            chemin.write_bytes(OCTETS_PNG_MINIMAL)
            bloc = encoder_image_base64(chemin)
            self.assertEqual(bloc["type"], "image")
            self.assertEqual(bloc["source"]["type"], "base64")
            self.assertEqual(bloc["source"]["media_type"], "image/png")
            # L'octet décodé doit redonner exactement le fichier d'origine.
            self.assertEqual(
                base64.standard_b64decode(bloc["source"]["data"]), OCTETS_PNG_MINIMAL
            )


class TestConstruireMessages(unittest.TestCase):
    def test_alterne_legende_texte_et_image_par_segment(self):
        with TemporaryDirectory() as tmp:
            dossier = Path(tmp)
            chemins = []
            for nom in ["01-hero.png", "02-bas.png"]:
                chemin = dossier / nom
                chemin.write_bytes(OCTETS_PNG_MINIMAL)
                chemins.append(chemin)

            messages = construire_messages(chemins)
            self.assertEqual(len(messages), 1)
            contenu = messages[0]["content"]

            # légende, image, légende, image, puis la consigne finale.
            self.assertEqual(contenu[0]["type"], "text")
            self.assertIn("01-hero.png", contenu[0]["text"])
            self.assertEqual(contenu[1]["type"], "image")
            self.assertEqual(contenu[2]["type"], "text")
            self.assertIn("02-bas.png", contenu[2]["text"])
            self.assertEqual(contenu[3]["type"], "image")
            self.assertEqual(contenu[4]["type"], "text")


class TestAnalyserReponseJson(unittest.TestCase):
    def test_capture_inventee_refusee(self):
        texte = json.dumps(self._rapport_brut_valide())
        with self.assertRaisesRegex(ValueError, "Capture inconnue"):
            analyser_reponse_json(texte, {"02-bas.png"})
        analyser_reponse_json(texte, {"01-hero.png"})

    def test_notes_non_entieres_refusees(self):
        for note in (True, 8.9, "8"):
            with self.subTest(note=note):
                brut = self._rapport_brut_valide()
                brut["categories"][0]["note"] = note
                with self.assertRaises(ValueError):
                    analyser_reponse_json(json.dumps(brut))

    def _rapport_brut_valide(self) -> dict:
        # Les six catégories, parce qu'un rapport valide les porte toutes :
        # la contrainte vivait dans le schéma JSON envoyé à l'API, qui la
        # refuse (`minItems` non supporté au-delà de 1), et elle est depuis
        # portée par `analyser_reponse_json`. Un jeu d'essai à une seule
        # catégorie décrivait donc un rapport que le produit n'accepte pas.
        return {
            "verdict_global": "solide",
            "resume": "Page claire, appel à l'action peu visible en bas.",
            "categories": [
                {
                    "nom": nom,
                    "note": 8,
                    "constats": [
                        {
                            "segment": "01-hero.png",
                            "severite": "mineur",
                            "observation": "Le titre est clair.",
                            "recommandation": "Rien à changer.",
                        }
                    ],
                }
                for nom in CATEGORIES
            ],
            "priorites": ["Contraster le bouton principal"],
        }

    def test_reponse_valide_est_parsee_en_rapport(self):
        rapport = analyser_reponse_json(json.dumps(self._rapport_brut_valide()))
        self.assertIsInstance(rapport, Rapport)
        self.assertEqual(rapport.verdict_global, "solide")
        self.assertEqual(len(rapport.categories), len(CATEGORIES))
        self.assertEqual(rapport.categories[0].note, 8)
        self.assertEqual(rapport.categories[0].constats[0].severite, "mineur")

    def test_json_invalide_leve_valueerror_jamais_silencieux(self):
        with self.assertRaises(ValueError):
            analyser_reponse_json("ceci n'est pas du JSON")

    def test_categorie_manquante_est_refusee(self):
        """La garantie retirée du schéma JSON doit vivre ici, ou nulle part.

        L'API refuse `minItems` au-delà de 1 : sans ce contrôle, un rapport
        amputé d'une catégorie passerait pour complet et deux audits ne se
        compareraient plus.
        """
        brut = self._rapport_brut_valide()
        brut["categories"] = brut["categories"][:-1]
        with self.assertRaises(ValueError) as capture:
            analyser_reponse_json(json.dumps(brut))
        self.assertIn(CATEGORIES[-1], str(capture.exception))

    def test_note_hors_echelle_est_refusee(self):
        """Même raison : `minimum`/`maximum` ne sont pas supportés non plus."""
        brut = self._rapport_brut_valide()
        brut["categories"][0]["note"] = 42
        with self.assertRaises(ValueError):
            analyser_reponse_json(json.dumps(brut))

    def test_rapport_sans_priorite_est_refuse(self):
        brut = self._rapport_brut_valide()
        brut["priorites"] = []
        with self.assertRaises(ValueError):
            analyser_reponse_json(json.dumps(brut))

    def test_champ_racine_manquant_leve_erreur(self):
        brut = self._rapport_brut_valide()
        del brut["priorites"]
        with self.assertRaises(ValueError):
            analyser_reponse_json(json.dumps(brut))

    def test_verdict_hors_enumeration_leve_erreur(self):
        brut = self._rapport_brut_valide()
        brut["verdict_global"] = "parfait"  # pas dans VERDICTS
        with self.assertRaises(ValueError):
            analyser_reponse_json(json.dumps(brut))

    def test_severite_hors_enumeration_leve_erreur(self):
        brut = self._rapport_brut_valide()
        brut["categories"][0]["constats"][0]["severite"] = "catastrophique"
        with self.assertRaises(ValueError):
            analyser_reponse_json(json.dumps(brut))

    def test_constat_incomplet_leve_erreur(self):
        brut = self._rapport_brut_valide()
        del brut["categories"][0]["constats"][0]["recommandation"]
        with self.assertRaises(ValueError):
            analyser_reponse_json(json.dumps(brut))


class TestRendreMarkdown(unittest.TestCase):
    def test_contient_verdict_resume_priorites_et_categories(self):
        rapport = Rapport(
            verdict_global="a_ameliorer",
            resume="Résumé de test.",
            categories=[
                Categorie(
                    nom="Appel à l'action",
                    note=4,
                    constats=[
                        Constat(
                            segment="03-bas.png",
                            severite="bloquant",
                            observation="Aucun bouton visible en bas de page.",
                            recommandation="Ajouter un bouton contrasté.",
                        )
                    ],
                )
            ],
            priorites=["Ajouter un bouton en bas de page"],
        )
        markdown = rendre_markdown(rapport, nom_page="exemple-com")

        self.assertIn("a_ameliorer", markdown)
        self.assertIn("Résumé de test.", markdown)
        self.assertIn("Ajouter un bouton en bas de page", markdown)
        self.assertIn("Appel à l'action", markdown)
        self.assertIn("4/10", markdown)
        self.assertIn("03-bas.png", markdown)
        self.assertIn("bloquant", markdown)

    def test_constats_tries_par_severite_bloquant_dabord(self):
        rapport = Rapport(
            verdict_global="solide",
            resume="",
            categories=[
                Categorie(
                    nom="Preuve sociale",
                    note=6,
                    constats=[
                        Constat("a.png", "mineur", "obs mineure", "reco mineure"),
                        Constat("b.png", "bloquant", "obs bloquante", "reco bloquante"),
                        Constat("c.png", "important", "obs importante", "reco importante"),
                    ],
                )
            ],
            priorites=[],
        )
        markdown = rendre_markdown(rapport, nom_page="exemple-com")
        position_bloquant = markdown.index("obs bloquante")
        position_important = markdown.index("obs importante")
        position_mineur = markdown.index("obs mineure")
        self.assertLess(position_bloquant, position_important)
        self.assertLess(position_important, position_mineur)

    def test_categorie_sans_constat_ne_casse_pas(self):
        rapport = Rapport(
            verdict_global="excellent",
            resume="",
            categories=[Categorie(nom="Cohérence de marque", note=10, constats=[])],
            priorites=[],
        )
        markdown = rendre_markdown(rapport, nom_page="exemple-com")
        self.assertIn("Aucun constat particulier", markdown)


if __name__ == "__main__":
    unittest.main()
