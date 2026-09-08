"""Résolution de gabarit et contrôle des mentions obligatoires."""

import tempfile
import unittest
from datetime import date
from pathlib import Path

from moteur_administratif.redaction.regles import (
    ErreurGabarit, controler_mentions, formater, resoudre_texte,
)
from moteur_administratif.redaction.traitement import composer


class Identite:
    nom = "Chevallier"


class TestFormater(unittest.TestCase):
    def test_date(self):
        self.assertEqual(formater(date(2026, 3, 14)), "14/03/2026")

    def test_none(self):
        self.assertEqual(formater(None), "")

    def test_booleen(self):
        self.assertEqual(formater(True), "Oui")
        self.assertEqual(formater(False), "Non")


class TestResoudreTexte(unittest.TestCase):
    def test_chemin_dans_un_dict(self):
        contexte = {"identite": {"nom": "Chevallier"}}
        self.assertEqual(resoudre_texte("Cher {identite.nom},", contexte), "Cher Chevallier,")

    def test_chemin_sur_un_objet(self):
        contexte = {"identite": Identite()}
        self.assertEqual(resoudre_texte("Cher {identite.nom},", contexte), "Cher Chevallier,")

    def test_aujourdhui_avec_format(self):
        texte = resoudre_texte("Le {@aujourdhui:%d/%m/%Y}", {}, date(2026, 9, 3))
        self.assertEqual(texte, "Le 03/09/2026")

    def test_jeton_inconnu_leve(self):
        with self.assertRaises(ErreurGabarit):
            resoudre_texte("{inconnu.champ}", {})

    def test_chemin_partiel_inconnu_leve(self):
        with self.assertRaises(ErreurGabarit):
            resoudre_texte("{identite.telephone}", {"identite": {"nom": "Chevallier"}})


class TestControlerMentions(unittest.TestCase):
    def test_tout_present(self):
        self.assertEqual(controler_mentions("Réf. AB123. Merci de confirmer.",
                                            ("AB123", "confirmer")), ())

    def test_une_mention_absente(self):
        manquantes = controler_mentions("Bonjour.", ("référence client",))
        self.assertEqual(manquantes, ("référence client",))


class TestComposer(unittest.TestCase):
    def test_ecrit_pret_a_signer(self):
        with tempfile.TemporaryDirectory() as dossier:
            gabarit = Path(dossier) / "lettre.txt"
            gabarit.write_text("Réf. {reference}. Merci de confirmer.", encoding="utf-8")
            ecrit = composer(gabarit, {"reference": "AB123"}, mentions_obligatoires=("AB123",))
        self.assertTrue(ecrit.pret_a_signer)
        self.assertIn("AB123", ecrit.contenu)

    def test_ecrit_incomplet(self):
        with tempfile.TemporaryDirectory() as dossier:
            gabarit = Path(dossier) / "lettre.txt"
            gabarit.write_text("Bonjour.", encoding="utf-8")
            ecrit = composer(gabarit, {}, mentions_obligatoires=("référence client",))
        self.assertFalse(ecrit.pret_a_signer)
        self.assertEqual(ecrit.mentions_manquantes, ("référence client",))


if __name__ == "__main__":
    unittest.main()
