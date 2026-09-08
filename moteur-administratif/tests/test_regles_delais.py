"""La table de règles, chargée depuis un fichier, puis appliquée à une date."""

import json
import tempfile
import unittest
from datetime import date
from pathlib import Path

from moteur_administratif.regles_delais.modele import Regle
from moteur_administratif.regles_delais.regles import calculer_echeance, regle_pour
from moteur_administratif.regles_delais.traitement import (
    ErreurTableDeRegles, charger_table_de_regles,
)

TABLE = [
    Regle("mise_en_demeure", 30, "date_reception", "Répondre avant l'échéance.",
          "article 1231-1 du code civil"),
    Regle("avis_imposition", 60, "date_emission", "Contester si nécessaire.", ""),
]


class TestRegles(unittest.TestCase):
    def test_regle_pour_trouve(self):
        self.assertEqual(regle_pour("mise_en_demeure", TABLE).delai_jours, 30)

    def test_regle_pour_absente(self):
        self.assertIsNone(regle_pour("inconnu", TABLE))

    def test_calculer_echeance(self):
        echeance = calculer_echeance("mise_en_demeure", date(2026, 9, 1), TABLE)
        self.assertEqual(echeance.date_limite, date(2026, 10, 1))
        self.assertEqual(echeance.demarche, "Répondre avant l'échéance.")

    def test_calculer_echeance_type_inconnu(self):
        self.assertIsNone(calculer_echeance("inconnu", date(2026, 9, 1), TABLE))

    def test_jours_restants_et_depassee(self):
        echeance = calculer_echeance("mise_en_demeure", date(2026, 9, 1), TABLE)
        self.assertEqual(echeance.jours_restants(date(2026, 9, 1)), 30)
        self.assertFalse(echeance.depassee(date(2026, 10, 1)))
        self.assertTrue(echeance.depassee(date(2026, 10, 2)))


class TestChargement(unittest.TestCase):
    def test_charge_une_table_valide(self):
        with tempfile.TemporaryDirectory() as dossier:
            chemin = Path(dossier) / "regles.json"
            chemin.write_text(json.dumps([{
                "type_document": "mise_en_demeure",
                "delai_jours": 30,
                "point_de_depart": "date_reception",
                "demarche": "Répondre avant l'échéance.",
                "texte_de_reference": "article 1231-1 du code civil",
            }]), encoding="utf-8")
            table = charger_table_de_regles(chemin)
        self.assertEqual(len(table), 1)
        self.assertEqual(table[0].type_document, "mise_en_demeure")

    def test_fichier_introuvable(self):
        with self.assertRaises(ErreurTableDeRegles):
            charger_table_de_regles("/chemin/qui/n/existe/pas.json")

    def test_champ_manquant(self):
        with tempfile.TemporaryDirectory() as dossier:
            chemin = Path(dossier) / "regles.json"
            chemin.write_text(json.dumps([{"type_document": "x"}]), encoding="utf-8")
            with self.assertRaises(ErreurTableDeRegles):
                charger_table_de_regles(chemin)

    def test_pas_une_liste(self):
        with tempfile.TemporaryDirectory() as dossier:
            chemin = Path(dossier) / "regles.json"
            chemin.write_text(json.dumps({"pas": "une liste"}), encoding="utf-8")
            with self.assertRaises(ErreurTableDeRegles):
                charger_table_de_regles(chemin)


if __name__ == "__main__":
    unittest.main()
