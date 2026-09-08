"""Le remplissage de PDF (Cerfa à champs, PDF plat) et la mise en page d'une lettre.

Utilise de vrais PDF construits avec `pymupdf` — la seule façon de vérifier
que les widgets sont réellement lus et écrits, pas seulement que le code
compile.
"""

import json
import tempfile
import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path

import pymupdf

from moteur_administratif.redaction.modele import Ecrit
from moteur_administratif.redaction.regles import date_en_toutes_lettres, texte_lisible_en_pdf
from moteur_administratif.redaction.traitement import (
    ErreurFormulaire, charger_plan, lire_champs, remplir_formulaire, rendre_lettre_pdf,
)


class TestTexteLisibleEnPdf(unittest.TestCase):
    def test_transpose_ce_que_les_polices_de_base_ne_savent_pas_tracer(self):
        self.assertEqual(texte_lisible_en_pdf("Cœur 78,42 €"), "Coeur 78,42 EUR")

    def test_texte_ordinaire_intact(self):
        self.assertEqual(texte_lisible_en_pdf("Bonjour"), "Bonjour")


class TestDateEnToutesLettres(unittest.TestCase):
    def test_premier_du_mois(self):
        self.assertEqual(date_en_toutes_lettres(date(2026, 9, 1)), "1er septembre 2026")

    def test_autre_quantieme(self):
        self.assertEqual(date_en_toutes_lettres(date(2026, 3, 12)), "12 mars 2026")

    def test_date_absente(self):
        self.assertEqual(date_en_toutes_lettres(None), "[date]")


def _pdf_a_champs(dossier: Path) -> Path:
    document = pymupdf.open()
    page = document.new_page()

    champ_texte = pymupdf.Widget()
    champ_texte.field_name = "nom"
    champ_texte.field_type = pymupdf.PDF_WIDGET_TYPE_TEXT
    champ_texte.rect = pymupdf.Rect(50, 50, 300, 70)
    page.add_widget(champ_texte)

    case = pymupdf.Widget()
    case.field_name = "coche"
    case.field_type = pymupdf.PDF_WIDGET_TYPE_CHECKBOX
    case.rect = pymupdf.Rect(50, 90, 70, 110)
    case.field_value = False
    page.add_widget(case)

    chemin = dossier / "cerfa.pdf"
    document.save(chemin)
    document.close()
    return chemin


class TestRemplirFormulaire(unittest.TestCase):
    def test_champ_texte_et_case_a_cocher(self):
        with tempfile.TemporaryDirectory() as dossier:
            dossier = Path(dossier)
            source = _pdf_a_champs(dossier)
            sortie = dossier / "rempli.pdf"
            ecrits = remplir_formulaire(
                source, {"nom": "Chevallier", "coche": True}, sortie, aplatir=False)

            releve = {c.nom: c.valeur_actuelle for c in lire_champs(sortie)}
        self.assertEqual(set(ecrits), {"nom", "coche"})
        self.assertEqual(releve["nom"], "Chevallier")
        self.assertEqual(releve["coche"], "Yes")

    def test_champ_absent_du_pdf_et_sans_position_leve(self):
        with tempfile.TemporaryDirectory() as dossier:
            dossier = Path(dossier)
            source = _pdf_a_champs(dossier)
            with self.assertRaises(ErreurFormulaire):
                remplir_formulaire(source, {"inconnu": "x"}, dossier / "rempli.pdf")

    def test_refuse_d_ecraser_le_pdf_source(self):
        with tempfile.TemporaryDirectory() as dossier:
            source = _pdf_a_champs(Path(dossier))
            with self.assertRaises(ErreurFormulaire):
                remplir_formulaire(source, {"nom": "x"}, source)

    def test_positions_pour_un_pdf_plat(self):
        with tempfile.TemporaryDirectory() as dossier:
            dossier = Path(dossier)
            document = pymupdf.open()
            document.new_page()
            source = dossier / "plat.pdf"
            document.save(source)
            document.close()

            sortie = dossier / "rempli.pdf"
            positions = {
                "nom": {"page": 1, "rect": [50, 50, 300, 70]},
                "coche": {"page": 1, "rect": [50, 90, 70, 110]},
            }
            ecrits = remplir_formulaire(
                source, {"nom": "Chevallier", "coche": True}, sortie, positions=positions)
            self.assertEqual(set(ecrits), {"nom", "coche"})
            self.assertTrue(sortie.exists())

    def test_texte_trop_long_pour_le_cadre_leve(self):
        with tempfile.TemporaryDirectory() as dossier:
            dossier = Path(dossier)
            document = pymupdf.open()
            document.new_page()
            source = dossier / "plat.pdf"
            document.save(source)
            document.close()

            positions = {"nom": {"page": 1, "rect": [50, 50, 60, 60], "taille": 40}}
            with self.assertRaises(ErreurFormulaire):
                remplir_formulaire(source, {"nom": "Un texte bien trop long pour ce cadre minuscule"},
                                   dossier / "rempli.pdf", positions=positions)


class TestChargerPlan(unittest.TestCase):
    def test_plan_valide(self):
        with tempfile.TemporaryDirectory() as dossier:
            chemin = Path(dossier) / "plan.json"
            chemin.write_text(json.dumps({
                "nom": "mon-cerfa", "titre": "Mon Cerfa",
                "champs": {"nom": "{identite.nom}", "coche": True},
            }), encoding="utf-8")
            plan = charger_plan(chemin)
        self.assertEqual(plan.nom, "mon-cerfa")
        self.assertEqual(plan.champs["coche"], True)

    def test_champs_vides_leve(self):
        with tempfile.TemporaryDirectory() as dossier:
            chemin = Path(dossier) / "plan.json"
            chemin.write_text(json.dumps({"nom": "x", "champs": {}}), encoding="utf-8")
            with self.assertRaises(ErreurFormulaire):
                charger_plan(chemin)

    def test_fichier_introuvable(self):
        with self.assertRaises(ErreurFormulaire):
            charger_plan("/chemin/qui/n/existe/pas.json")


class TestRendreLettrePdf(unittest.TestCase):
    def test_ecrit_un_pdf_lisible(self):
        ecrit = Ecrit(
            gabarit="test",
            contenu="Objet : résiliation de mon contrat\n\nMadame, Monsieur,\n\n"
                    "Je vous informe de ma décision de résilier ce contrat, "
                    "référence AB-12345.\n\nCordialement,",
        )
        with tempfile.TemporaryDirectory() as dossier:
            chemin = rendre_lettre_pdf(
                ecrit,
                expediteur=["Erwann Chevallier", "12 rue des Fleurs", "75000 Paris"],
                destinataire=["Service client Exemple", "1 avenue du Test"],
                lieu_et_date="Paris, le 1er septembre 2026",
                chemin=Path(dossier) / "lettre.pdf",
            )
            self.assertTrue(chemin.exists())
            document = pymupdf.open(chemin)
            texte = "\n".join(page.get_text() for page in document)
            document.close()
        self.assertIn("résiliation", texte)
        self.assertIn("Erwann Chevallier", texte)
        self.assertIn("AB-12345", texte)

    def test_lettre_recommandee_mentionnee(self):
        ecrit = Ecrit(gabarit="test", contenu="Objet : test\n\nCorps très court.")
        with tempfile.TemporaryDirectory() as dossier:
            chemin = rendre_lettre_pdf(
                ecrit, expediteur=["Moi"], destinataire=["Eux"],
                lieu_et_date="Paris, le 1er septembre 2026",
                chemin=Path(dossier) / "lettre.pdf", recommande=True,
            )
            document = pymupdf.open(chemin)
            texte = document[0].get_text()
            document.close()
        self.assertIn("recommandée", texte)

    def test_corps_long_tourne_la_page(self):
        # Un corps assez long pour ne pas tenir sur une page doit produire une
        # deuxième page plutôt que de déborder en silence.
        paragraphe = ("Ce paragraphe se répète pour occuper de la place sur la "
                      "page et forcer un débordement. ") * 40
        ecrit = Ecrit(gabarit="test", contenu=f"Objet : test\n\n{paragraphe}")
        with tempfile.TemporaryDirectory() as dossier:
            chemin = rendre_lettre_pdf(
                ecrit, expediteur=["Moi"], destinataire=["Eux"],
                lieu_et_date="Paris, le 1er septembre 2026",
                chemin=Path(dossier) / "lettre.pdf",
            )
            document = pymupdf.open(chemin)
            nombre_de_pages = len(document)
            document.close()
        self.assertGreater(nombre_de_pages, 1)


if __name__ == "__main__":
    unittest.main()
