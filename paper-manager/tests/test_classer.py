#!/usr/bin/env python3
"""Le parcours complet : déposer, lire, nommer, ranger.

C'est la commande qu'on tape ; ces contrôles portent donc sur ce qu'elle fait au
disque, et non sur les fonctions prises une à une.
"""

import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

import pymupdf

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
import paper  # noqa: E402

FACTURE_EDF = """EDF - Electricite de France
FACTURE D'ELECTRICITE
Reference client : 0123456789
Date de facture : 14/03/2026
Net a payer 78,42 EUR
"""


class Classer(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.addCleanup(self.dossier.cleanup)
        self.racine = Path(self.dossier.name)
        self.entree = self.racine / "coffre" / "entree"
        self.entree.mkdir(parents=True)
        reglages = json.loads((RACINE / "admin_config.exemple.json").read_text(encoding="utf-8"))
        reglages["classement"].update({
            "racine": str(self.racine / "coffre"), "entree": str(self.entree),
            "classes": str(self.racine / "coffre" / "classes"),
            "courriers": str(self.racine / "coffre" / "courriers"),
        })
        self.config = self.racine / "admin_config.json"
        self.config.write_text(json.dumps(reglages, ensure_ascii=False), encoding="utf-8")

    def deposer(self, nom: str, texte: str) -> Path:
        chemin = self.entree / nom
        document = pymupdf.open()
        document.new_page().insert_textbox(pymupdf.Rect(40, 40, 555, 780), texte, fontsize=10)
        document.save(chemin)
        document.close()
        return chemin

    def classer(self, *options: str) -> str:
        sortie = io.StringIO()
        with redirect_stdout(sortie):
            code = paper.main(["classer", "--config", str(self.config), *options])
        self.assertEqual(code, 0)
        return sortie.getvalue()

    def classes(self) -> list[Path]:
        racine = self.racine / "coffre" / "classes"
        return sorted(p for p in racine.rglob("*") if p.is_file()) if racine.exists() else []

    def test_par_defaut_rien_ne_bouge(self):
        # Un classement dont on n'a pas vu la sortie est un classement qu'on refait.
        depose = self.deposer("edf.pdf", FACTURE_EDF)
        sortie = self.classer()
        self.assertIn("Simulation", sortie)
        self.assertTrue(depose.exists())
        self.assertEqual(self.classes(), [])

    def test_avec_appliquer_le_document_est_range_a_sa_place(self):
        depose = self.deposer("edf.pdf", FACTURE_EDF)
        self.classer("--appliquer")
        self.assertFalse(depose.exists())
        self.assertEqual([p.relative_to(self.racine / "coffre" / "classes") for p in self.classes()],
                         [Path("2026/energie/2026-03-14_EDF_facture_78-42EUR.pdf")])

    def test_un_document_illisible_reste_dans_le_depot_avec_sa_raison(self):
        casse = self.entree / "casse.pdf"
        casse.write_bytes(b"PK\x03\x04 pas un pdf")
        sortie = self.classer("--appliquer")
        self.assertIn("À RELIRE", sortie)
        self.assertTrue(casse.exists())

    def test_un_fichier_illisible_n_arrete_pas_le_lot(self):
        # Les autres sont déposés en même temps : les traiter vaut mieux que de
        # tout suspendre.
        (self.entree / "casse.pdf").write_bytes(b"PK\x03\x04 pas un pdf")
        self.deposer("edf.pdf", FACTURE_EDF)
        self.classer("--appliquer")
        self.assertEqual(len(self.classes()), 1)

    def test_deux_copies_du_meme_fichier_ne_sont_rangees_qu_une_fois(self):
        premier = self.deposer("edf.pdf", FACTURE_EDF)
        (self.entree / "copie.pdf").write_bytes(premier.read_bytes())
        sortie = self.classer("--appliquer")
        self.assertEqual(len(self.classes()), 1)
        self.assertIn("même dépôt", sortie)

    def test_un_second_passage_reconnait_ce_qui_est_deja_range(self):
        # Et le dit autrement qu'un doublon du lot : « déjà rangé » est une
        # bonne nouvelle, « deux copies » demande de choisir.
        octets = self.deposer("edf.pdf", FACTURE_EDF).read_bytes()
        self.classer("--appliquer")
        (self.entree / "edf.pdf").write_bytes(octets)
        sortie = self.classer()
        self.assertIn("passage précédent", sortie)
        self.assertEqual(len(self.classes()), 1)

    def test_un_document_au_contenu_identique_mais_aux_octets_differents_est_un_autre(self):
        # L'empreinte porte sur les octets : deux exports du même relevé, faits
        # à deux instants, en sont deux. Le second se décale en « -2 » plutôt
        # que d'effacer le premier — c'est la garde qui compte ici.
        self.deposer("edf.pdf", FACTURE_EDF)
        self.classer("--appliquer")
        self.deposer("edf-encore.pdf", FACTURE_EDF)
        self.classer("--appliquer")
        noms = sorted(p.name for p in self.classes())
        self.assertEqual(noms, ["2026-03-14_EDF_facture_78-42EUR-2.pdf",
                                "2026-03-14_EDF_facture_78-42EUR.pdf"])

    def test_un_depot_vide_le_dit_sans_se_plaindre(self):
        self.assertIn("Rien à classer", self.classer())


if __name__ == "__main__":
    unittest.main()
