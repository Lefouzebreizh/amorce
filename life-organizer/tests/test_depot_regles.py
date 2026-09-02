"""Où va un fichier déposé, et si on s'y fie — sans image ni clé d'API.

Les cas qui comptent : une catégorie sans règle ne mène nulle part plutôt que
vers un dossier par défaut inventé, un projet inconnu ne mène nulle part non
plus, et la confiance en dessous du seuil marque la proposition comme
incertaine sans l'empêcher d'exister.
"""

import json
import sys
import unittest
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from modules.depot import regles  # noqa: E402

CONFIG = json.loads((RACINE / "organizer_config.json").read_text(encoding="utf-8"))
DEPOT = CONFIG["depot"]


class TestCategorieValide(unittest.TestCase):
    def test_les_trois_categories_declarees_sont_valides(self):
        for categorie in regles.CATEGORIES:
            self.assertTrue(regles.categorie_valide(categorie))

    def test_une_categorie_inventee_par_le_modele_est_rejetee(self):
        self.assertFalse(regles.categorie_valide("autre_chose"))


class TestDossierPour(unittest.TestCase):
    def test_le_gabarit_resout_les_champs_fournis(self):
        regles_projet = DEPOT["projets"]["personnel"]["regles"]
        dossier = regles.dossier_pour("photo_personnelle", regles_projet,
                                       {"annee": "2026", "mois": "09"})
        self.assertEqual(dossier, "Photos/2026/09")

    def test_une_categorie_sans_regle_ne_mene_nulle_part(self):
        self.assertIsNone(regles.dossier_pour("photo_personnelle", [], {}))

    def test_un_champ_absent_du_gabarit_ne_fait_pas_echouer_la_regle(self):
        dossier = regles.dossier_pour(
            "papier_administratif",
            [{"categorie": "papier_administratif", "dossier": "Documents/{annee}"}],
            {},
        )
        self.assertEqual(dossier, "Documents/{annee}")

    def test_la_premiere_regle_correspondante_l_emporte(self):
        regles_projet = [
            {"categorie": "photo_personnelle", "dossier": "Premier"},
            {"categorie": "photo_personnelle", "dossier": "Second"},
        ]
        self.assertEqual(regles.dossier_pour("photo_personnelle", regles_projet, {}), "Premier")


class TestProposer(unittest.TestCase):
    def _classification(self, confiance=0.9, categorie="photo_personnelle"):
        return regles.Classification(categorie=categorie, confiance=confiance, raison="test")

    def test_un_projet_inconnu_ne_mene_nulle_part(self):
        proposition = regles.proposer(self._classification(), DEPOT, "projet_absent", {})
        self.assertIsNone(proposition)

    def test_une_categorie_invalide_ne_mene_nulle_part(self):
        classification = self._classification(categorie="autre_chose")
        proposition = regles.proposer(classification, DEPOT, "personnel", {})
        self.assertIsNone(proposition)

    def test_une_confiance_au_dessus_du_seuil_est_fiable(self):
        proposition = regles.proposer(self._classification(confiance=0.95), DEPOT, "personnel",
                                       {"annee": "2026", "mois": "09"})
        self.assertTrue(proposition.fiable)

    def test_une_confiance_en_dessous_du_seuil_reste_une_proposition_mais_incertaine(self):
        proposition = regles.proposer(self._classification(confiance=0.2), DEPOT, "personnel",
                                       {"annee": "2026", "mois": "09"})
        self.assertIsNotNone(proposition)
        self.assertFalse(proposition.fiable)


class TestProjetConnu(unittest.TestCase):
    def test_le_projet_personnel_du_gabarit_est_connu(self):
        self.assertTrue(regles.projet_connu(DEPOT, "personnel"))

    def test_un_projet_non_declare_ne_l_est_pas(self):
        self.assertFalse(regles.projet_connu(DEPOT, "aznaroth"))


if __name__ == "__main__":
    unittest.main()
