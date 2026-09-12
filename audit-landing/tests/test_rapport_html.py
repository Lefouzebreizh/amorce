"""Tests de rapport_html.py — aucun réseau, aucune clé, aucun vrai segment.

Comme pour analyser_captures.py, ce qui se teste ici est la logique pure :
le rendu HTML depuis un `Rapport` déjà construit, l'échappement du texte
venu du modèle, l'inclusion conditionnelle des vignettes. Aucun de ces
gestes ne dépend d'un appel réseau.
"""

import base64
import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from analyser_captures import Categorie, Constat, Rapport
from rapport_html import construire_vignettes, echapper, rendre_html

# Un PNG 1×1 minimal — suffisant pour vérifier que Pillow peut l'ouvrir et
# qu'une vignette en sort, pas pour être regardé.
OCTETS_PNG_MINIMAL = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


def _rapport_exemple() -> Rapport:
    return Rapport(
        verdict_global="a_ameliorer",
        resume="Page claire, appel à l'action peu visible en bas.",
        categories=[
            Categorie(
                nom="Message et promesse",
                note=7,
                constats=[
                    Constat(
                        segment="01-hero.png",
                        severite="important",
                        observation="Le titre principal manque de contraste.",
                        recommandation="Foncer la couleur du texte.",
                    ),
                ],
            ),
            Categorie(
                nom="Appel à l'action",
                note=4,
                constats=[
                    Constat(
                        segment="03-bas.png",
                        severite="bloquant",
                        observation="Aucun bouton visible en bas de page.",
                        recommandation="Ajouter un bouton contrasté.",
                    ),
                ],
            ),
            Categorie(nom="Preuve sociale", note=9, constats=[]),
            Categorie(nom="Objections et confiance", note=6, constats=[]),
            Categorie(nom="Lisibilité et hiérarchie visuelle", note=8, constats=[]),
            Categorie(nom="Cohérence de marque", note=8, constats=[]),
        ],
        priorites=["Ajouter un bouton en bas de page", "Contraster le titre"],
    )


class TestEchapper(unittest.TestCase):
    def test_echappe_les_chevrons_et_esperluettes(self):
        self.assertEqual(
            echapper("<script>alert(1)</script> & voilà"),
            "&lt;script&gt;alert(1)&lt;/script&gt; &amp; voilà",
        )


class TestConstruireVignettes(unittest.TestCase):
    def test_seuls_les_segments_cites_sont_encodes(self):
        with TemporaryDirectory() as tmp:
            dossier = Path(tmp)
            (dossier / "01-hero.png").write_bytes(OCTETS_PNG_MINIMAL)
            (dossier / "03-bas.png").write_bytes(OCTETS_PNG_MINIMAL)
            (dossier / "02-milieu.png").write_bytes(OCTETS_PNG_MINIMAL)  # jamais cité

            vignettes = construire_vignettes(dossier, _rapport_exemple())

            self.assertEqual(set(vignettes), {"01-hero.png", "03-bas.png"})
            self.assertTrue(vignettes["01-hero.png"].startswith("data:image/jpeg;base64,"))

    def test_segment_cite_mais_fichier_absent_est_ignore(self):
        with TemporaryDirectory() as tmp:
            dossier = Path(tmp)
            (dossier / "01-hero.png").write_bytes(OCTETS_PNG_MINIMAL)
            # 03-bas.png cité par le rapport mais jamais écrit sur disque.

            vignettes = construire_vignettes(dossier, _rapport_exemple())

            self.assertEqual(set(vignettes), {"01-hero.png"})

    def test_rapport_sans_constat_ne_produit_aucune_vignette(self):
        with TemporaryDirectory() as tmp:
            dossier = Path(tmp)
            (dossier / "01-hero.png").write_bytes(OCTETS_PNG_MINIMAL)
            rapport_vide = Rapport(
                verdict_global="excellent",
                resume="",
                categories=[Categorie(nom="Cohérence de marque", note=10, constats=[])],
                priorites=["Rien à changer"],
            )
            self.assertEqual(construire_vignettes(dossier, rapport_vide), {})


class TestRendreHtml(unittest.TestCase):
    def test_contient_verdict_resume_priorites_et_categories(self):
        html = rendre_html(_rapport_exemple(), nom_page="exemple-com")

        self.assertIn("À améliorer", html)  # libellé du verdict a_ameliorer
        self.assertIn(echapper("Page claire, appel à l'action peu visible en bas."), html)
        self.assertIn("Ajouter un bouton en bas de page", html)
        self.assertIn("Message et promesse", html)
        self.assertIn(echapper("Appel à l'action"), html)
        self.assertIn("7/10", html)
        self.assertIn("4/10", html)
        self.assertIn("9/10", html)
        self.assertIn("Aucun constat particulier.", html)  # Preuve sociale, sans constat

    def test_texte_du_modele_est_echappe(self):
        rapport = Rapport(
            verdict_global="solide",
            resume="<b>Résumé</b> avec balise",
            categories=[Categorie(nom="Preuve sociale", note=6, constats=[])],
            priorites=["<script>x()</script>"],
        )
        html = rendre_html(rapport, nom_page="exemple-com")

        self.assertNotIn("<script>x()</script>", html)
        self.assertIn("&lt;script&gt;x()&lt;/script&gt;", html)
        self.assertNotIn("<b>Résumé</b>", html)

    def test_sans_dossier_page_aucune_vignette_mais_page_complete(self):
        html = rendre_html(_rapport_exemple(), nom_page="exemple-com", dossier_page=None)
        self.assertNotIn('class="vignette"', html)
        self.assertIn("Message et promesse", html)

    def test_avec_dossier_page_les_constats_cites_portent_une_vignette(self):
        with TemporaryDirectory() as tmp:
            dossier = Path(tmp)
            (dossier / "01-hero.png").write_bytes(OCTETS_PNG_MINIMAL)
            (dossier / "03-bas.png").write_bytes(OCTETS_PNG_MINIMAL)

            html = rendre_html(_rapport_exemple(), nom_page="exemple-com", dossier_page=dossier)

            self.assertIn('class="vignette"', html)
            self.assertIn("data:image/jpeg;base64,", html)

    def test_page_est_un_document_html_valide_en_forme(self):
        html = rendre_html(_rapport_exemple(), nom_page="exemple-com")
        self.assertTrue(html.startswith("<!DOCTYPE html>"))
        self.assertIn("<html lang=\"fr\">", html)
        self.assertIn("</html>", html)
        # Autonome : aucune ressource externe chargée sur le réseau.
        self.assertNotIn("http://", html)
        self.assertNotIn("https://", html)


class TestChargeDepuisJson(unittest.TestCase):
    """Le contrat entre analyser_captures.py (écrit le JSON) et rapport_html.py
    (le lit) : ce que dataclasses.asdict(rapport) produit doit rester
    lisible par analyser_reponse_json, sans quoi la brique suivante casse.
    """

    def test_rapport_serialise_puis_reparsed_est_identique(self):
        import dataclasses

        from analyser_captures import analyser_reponse_json

        original = _rapport_exemple()
        texte_json = json.dumps(dataclasses.asdict(original), ensure_ascii=False)
        relu = analyser_reponse_json(texte_json)

        self.assertEqual(relu, original)


if __name__ == "__main__":
    unittest.main()
