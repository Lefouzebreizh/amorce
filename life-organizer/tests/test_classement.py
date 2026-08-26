"""Où va un fichier, vérifié sans en déplacer un seul.

Les cas qui comptent ne sont pas « une photo de mars va dans mars ». Ce sont les
quatre refus : ne pas deviner une date, ne pas toucher à ce qu'on ne sait pas
nommer, ne pas reproposer ce qui est déjà rangé, et ne pas ranger un document
par sa date quand son sujet est reconnu.
"""

import json
import sys
import unittest
from datetime import datetime
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from modules.classement import regles  # noqa: E402
from noyau.modele import Fiche  # noqa: E402

CONFIG = json.loads((RACINE / "organizer_config.json").read_text(encoding="utf-8"))
MARS_2024 = datetime(2024, 3, 15, 19, 12).timestamp()


def fiche(nom, horodatage=MARS_2024, dossier="/entree"):
    return Fiche(chemin=Path(dossier) / nom, poids_octets=2_000_000,
                 date_horodatage=horodatage)


class TestCategorie(unittest.TestCase):
    def test_l_extension_decide_la_categorie_sans_egard_a_la_casse(self):
        categories = CONFIG["classement"]["categories"]
        self.assertEqual(regles.categorie(Path("a.JPG"), categories), "Photos")
        self.assertEqual(regles.categorie(Path("a.mkv"), categories), "Videos")

    def test_une_extension_inconnue_n_a_pas_de_categorie(self):
        self.assertIsNone(regles.categorie(Path("a.odp"), CONFIG["classement"]["categories"]))


class TestDossierDate(unittest.TestCase):
    def test_le_schema_rend_le_mois_en_francais_et_sur_deux_chiffres(self):
        dossier = regles.dossier_date(CONFIG["classement"]["schema"], "Photos", 2024, 3)
        self.assertEqual(dossier, Path("Photos/2024/03 - mars"))

    def test_un_champ_inconnu_dans_le_schema_est_dit_en_clair(self):
        # Le message doit nommer les champs disponibles : une KeyError nue
        # laisse chercher dans le code ce qui aurait dû être dans le message.
        with self.assertRaises(ValueError) as leve:
            regles.dossier_date("{jour}/{categorie}", "Photos", 2024, 3)
        self.assertIn("categorie, annee, mois, mois_nom", str(leve.exception))


class TestDecider(unittest.TestCase):
    def test_une_photo_datee_suit_le_schema(self):
        rangement = regles.decider(fiche("IMG_20240315.jpg"), CONFIG, "exif")
        self.assertEqual(rangement.destination,
                         Path("Photos/2024/03 - mars/IMG_20240315.jpg"))

    def test_sans_date_fiable_le_fichier_part_a_dater_et_non_dans_le_mois_courant(self):
        # Le piège du domaine : ranger sous le mois courant dix ans de
        # souvenirs, sans que rien ne le signale.
        rangement = regles.decider(fiche("photo.jpg"), CONFIG, None)
        self.assertEqual(rangement.destination.parent, Path("Photos/À dater"))
        self.assertIn("aucune date fiable", rangement.motif)

    def test_une_date_de_modification_range_mais_le_dit(self):
        rangement = regles.decider(fiche("photo.jpg"), CONFIG, "modification")
        self.assertEqual(rangement.destination.parent, Path("Photos/2024/03 - mars"))
        self.assertIn("faute de mieux", rangement.motif)

    def test_un_document_reconnu_va_a_son_theme_et_non_a_sa_date(self):
        rangement = regles.decider(
            fiche("taxe foncière 2024.pdf"), CONFIG, "modification",
            texte="taxe foncière 2024.pdf")
        self.assertEqual(rangement.destination.parent,
                         Path("Documents/Administratif/Impôts"))
        self.assertIn("Impôts", rangement.motif)

    def test_un_document_sans_theme_reste_date_dans_le_fourre_tout(self):
        rangement = regles.decider(fiche("scan001.pdf"), CONFIG, "exif", texte="scan001.pdf")
        self.assertEqual(rangement.destination.parent,
                         Path("Documents/Divers/2024/03 - mars"))

    def test_une_extension_inconnue_n_est_pas_deplacee(self):
        rangement = regles.decider(fiche("presentation.odp"), CONFIG, "exif")
        self.assertFalse(rangement.a_deplacer)
        self.assertIn("classement.categories", rangement.motif)

    def test_un_fichier_deja_range_ne_produit_rien(self):
        # Sans ça, la commande repropose éternellement le même travail et
        # personne ne la relance.
        bibliotheque = Path("/biblio")
        deja = fiche("IMG_20240315.jpg", dossier="/biblio/Photos/2024/03 - mars")
        rangement = regles.decider(deja, CONFIG, "exif", bibliotheque=bibliotheque)
        self.assertFalse(rangement.a_deplacer)
        self.assertEqual(rangement.motif, "déjà rangé")


class TestTheme(unittest.TestCase):
    def test_le_premier_theme_de_la_liste_l_emporte(self):
        themes = [
            {"nom": "A", "dossier": "D/A", "mots_cles": ["facture"]},
            {"nom": "B", "dossier": "D/B", "mots_cles": ["facture"]},
        ]
        self.assertEqual(regles.theme("une Facture", themes)["nom"], "A")

    def test_aucun_mot_cle_ne_donne_aucun_theme(self):
        self.assertIsNone(regles.theme("photo de vacances", CONFIG["classement"]["themes"]))


class TestDossiersAParcourir(unittest.TestCase):
    def test_la_bibliotheque_n_est_pas_parcourue_d_office(self):
        # Sinon le rangement défait son propre travail : un fichier déjà rangé
        # dont la date d'origine a disparu repart dans le mois courant.
        gardes = regles.dossiers_a_parcourir(
            [], [Path("/entree"), Path("/biblio")], Path("/biblio"))
        self.assertEqual(gardes, [Path("/entree")])

    def test_un_dossier_sous_la_bibliotheque_est_ecarte_aussi(self):
        gardes = regles.dossiers_a_parcourir(
            [], [Path("/biblio/Photos")], Path("/biblio"))
        self.assertEqual(gardes, [])

    def test_la_bibliotheque_demandee_explicitement_est_parcourue(self):
        # « range ma bibliothèque » reste une demande légitime.
        gardes = regles.dossiers_a_parcourir(
            [Path("/biblio")], [Path("/entree")], Path("/biblio"))
        self.assertEqual(gardes, [Path("/biblio")])


class TestCompter(unittest.TestCase):
    def test_le_compte_ignore_ce_qui_ne_bouge_pas(self):
        rangements = [
            regles.decider(fiche("a.jpg"), CONFIG, "exif"),
            regles.decider(fiche("b.jpg"), CONFIG, "exif"),
            regles.decider(fiche("c.odp"), CONFIG, "exif"),
        ]
        self.assertEqual(regles.compter(rangements), {"Photos/2024/03 - mars": 2})


if __name__ == "__main__":
    unittest.main()
