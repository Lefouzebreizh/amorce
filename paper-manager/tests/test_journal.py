#!/usr/bin/env python3
"""Ce que l'index des documents lus doit tenir.

Deux enjeux : reconnaître un doublon quel que soit son nom, et rester jetable —
ce fichier se refabrique, il ne se sauvegarde pas.
"""

import json
import sys
import tempfile
import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.journal import ErreurJournal, Journal, charger, enregistrer  # noqa: E402
from core.modele import Document, Nature  # noqa: E402


def document(empreinte="abc", **changements) -> Document:
    base = dict(
        id="2026-03-14_EDF_facture", chemin="coffre/classes/2026/energie/f.pdf",
        nature=Nature.FACTURE, emetteur="EDF", categorie="energie",
        montant=Decimal("78.42"), date_emission=date(2026, 3, 14),
        reference="0000000000", empreinte=empreinte, confiance=0.9,
    )
    return Document(**{**base, **changements})


class Doublons(unittest.TestCase):
    def test_un_journal_absent_est_un_debut_et_non_une_erreur(self):
        with tempfile.TemporaryDirectory() as dossier:
            journal = charger(Path(dossier) / "documents.json")
            self.assertEqual(len(journal), 0)

    def test_le_meme_fichier_sous_un_autre_nom_n_est_pas_classe_deux_fois(self):
        # C'est le cas courant : deux dossiers synchronisés, un même relevé.
        journal = Journal(chemin=Path("x"))
        self.assertTrue(journal.inscrire(document()))
        self.assertFalse(journal.inscrire(document(id="autre-nom", chemin="ailleurs.pdf")))
        self.assertEqual(len(journal), 1)

    def test_deux_documents_differents_cohabitent(self):
        journal = Journal(chemin=Path("x"))
        journal.inscrire(document("abc"))
        journal.inscrire(document("def"))
        self.assertEqual(len(journal), 2)

    def test_un_document_sans_empreinte_est_refuse(self):
        # Sans elle, le doublon ne se voit pas : mieux vaut s'arrêter.
        with self.assertRaises(ErreurJournal):
            Journal(chemin=Path("x")).inscrire(document(empreinte=""))

    def test_on_retrouve_un_document_par_son_empreinte(self):
        journal = Journal(chemin=Path("x"))
        journal.inscrire(document("abc"))
        self.assertIsNotNone(journal.connu("abc"))
        self.assertIsNone(journal.connu("inconnue"))


class AllerRetour(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.addCleanup(self.dossier.cleanup)
        self.chemin = Path(self.dossier.name) / "coffre" / "documents.json"

    def journal_ecrit(self, *documents) -> Journal:
        journal = Journal(chemin=self.chemin)
        for doc in documents or (document(),):
            journal.inscrire(doc)
        enregistrer(journal)
        return journal

    def test_un_document_fait_l_aller_retour_sans_rien_perdre(self):
        self.journal_ecrit()
        relu = charger(self.chemin).connu("abc")
        self.assertIsNotNone(relu)
        self.assertEqual(relu.montant, Decimal("78.42"))
        self.assertEqual(relu.date_emission, date(2026, 3, 14))
        self.assertIs(relu.nature, Nature.FACTURE)

    def test_le_dossier_du_journal_est_cree_au_besoin(self):
        self.journal_ecrit()
        self.assertTrue(self.chemin.exists())

    def test_aucune_copie_de_sauvegarde_n_est_laissee(self):
        # Le journal se refabrique : une copie donnerait deux vérités.
        self.journal_ecrit()
        restes = [f.name for f in self.chemin.parent.iterdir() if f.suffix in (".bak", ".tmp")]
        self.assertEqual(restes, [])

    def test_deux_ecritures_identiques_donnent_le_meme_fichier(self):
        # Déterminisme : un diff vide quand rien n'a changé.
        self.journal_ecrit()
        premier = self.chemin.read_bytes()
        enregistrer(charger(self.chemin))
        self.assertEqual(self.chemin.read_bytes(), premier)

    def test_le_fichier_reste_lisible_avec_ses_accents(self):
        self.journal_ecrit(document(emetteur="Électricité de France"))
        self.assertIn("Électricité", self.chemin.read_text(encoding="utf-8"))

    def test_les_documents_sont_ranges_par_date(self):
        self.journal_ecrit(
            document("b", date_emission=date(2026, 5, 1)),
            document("a", date_emission=date(2026, 1, 1)),
        )
        écrits = json.loads(self.chemin.read_text(encoding="utf-8"))["documents"]
        self.assertEqual([d["empreinte"] for d in écrits], ["a", "b"])

    def test_un_journal_abime_dit_qu_il_se_refabrique(self):
        self.chemin.parent.mkdir(parents=True, exist_ok=True)
        self.chemin.write_text("{ ceci n'est pas du json", encoding="utf-8")
        with self.assertRaises(ErreurJournal) as leve:
            charger(self.chemin)
        self.assertIn("sans risque", str(leve.exception))


class SuiviParEmetteur(unittest.TestCase):
    def test_les_documents_d_un_emetteur_sortent_du_plus_recent_au_plus_ancien(self):
        # Sert à voir qu'une facture mensuelle a cessé d'arriver.
        journal = Journal(chemin=Path("x"))
        journal.inscrire(document("a", date_emission=date(2026, 1, 5)))
        journal.inscrire(document("b", date_emission=date(2026, 3, 5)))
        journal.inscrire(document("c", emetteur="Orange", date_emission=date(2026, 2, 5)))
        self.assertEqual([d.empreinte for d in journal.derniers_de("EDF")], ["b", "a"])


if __name__ == "__main__":
    unittest.main()
