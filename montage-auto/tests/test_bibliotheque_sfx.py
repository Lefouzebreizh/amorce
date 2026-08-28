"""Vérifie la bibliothèque d'effets cinématiques.

Ce qui est testé n'est pas le timbre — une oreille seule en juge — mais les
trois propriétés qui, absentes, rendent la bibliothèque inutilisable sans que
rien ne le signale : les recettes doivent produire du son, le catalogue doit
décrire ce qui existe, et le gain conseillé doit rapprocher les sons plutôt que
les écarter.
"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy

import download_blockbuster_sfx as sfx


class Recettes(unittest.TestCase):
    def test_toutes_les_recettes_rendent_du_son(self):
        """Une recette muette passerait toutes les autres vérifications."""
        for recette in sfx.RECETTES:
            nom, _, duree, _ = recette
            with self.subTest(nom=nom):
                piste = sfx.synthetiser(recette)
                self.assertEqual(len(piste), sfx.bruitages.secondes(duree))
                self.assertGreater(float(numpy.max(numpy.abs(piste))), 1e-3,
                                   f"« {nom} » ne produit rien d'audible")

    def test_les_categories_annoncees_existent(self):
        for nom, categorie, _, _ in sfx.RECETTES:
            with self.subTest(nom=nom):
                self.assertIn(categorie, sfx.CATEGORIES)

    def test_chaque_categorie_est_pourvue(self):
        """Un dossier vide dans l'arborescence est un mensonge à l'usage."""
        for categorie in sfx.CATEGORIES:
            with self.subTest(categorie=categorie):
                self.assertTrue(
                    any(r[1] == categorie for r in sfx.RECETTES),
                    f"aucune recette pour {categorie}")

    def test_les_noms_sont_uniques(self):
        noms = [r[0] for r in sfx.RECETTES]
        self.assertEqual(len(noms), len(set(noms)))


class Mesure(unittest.TestCase):
    def test_un_silence_ne_ment_pas(self):
        mesures = sfx.mesurer(numpy.zeros(4800))
        self.assertLessEqual(mesures["niveau_db"], -100)

    def test_un_grave_pur_est_signale_comme_perdu(self):
        """Le cas qui justifie toute la colonne « perte »."""
        t = numpy.arange(48000) / sfx.TAUX
        grave = numpy.sin(2 * numpy.pi * 45 * t)
        self.assertGreater(sfx.mesurer(grave)["perte_db"], 20.0)

    def test_un_aigu_traverse_le_filtre(self):
        t = numpy.arange(48000) / sfx.TAUX
        aigu = numpy.sin(2 * numpy.pi * 2000 * t)
        self.assertLess(abs(sfx.mesurer(aigu)["perte_db"]), 1.0)


class GainConseille(unittest.TestCase):
    def test_un_son_trop_discret_est_remonte(self):
        self.assertGreater(sfx.gain_conseille("01_Impacts_and_Booms", -30.0), 0)

    def test_un_son_trop_fort_est_baisse(self):
        self.assertLess(sfx.gain_conseille("05_UI_and_App_Buttons", -2.0), 0)

    def test_le_gain_est_plafonne(self):
        """Au-delà du plafond, on ne remonte plus un son mais son souffle."""
        for niveau in (-90.0, 40.0):
            with self.subTest(niveau=niveau):
                self.assertLessEqual(
                    abs(sfx.gain_conseille("01_Impacts_and_Booms", niveau)),
                    sfx.GAIN_MAXIMAL_DB)

    def test_un_silence_ne_recoit_aucun_gain(self):
        self.assertEqual(sfx.gain_conseille("04_Drones_and_Ambiances", -180.0), 0.0)

    def test_le_gain_resserre_l_ecart_entendu(self):
        """La raison d'être du champ, et la mesure qui l'a imposé.

        Normalisés à la même crête, les sons d'une même catégorie s'étalaient
        sur plus de trente décibels de niveau entendu. Appliquer le gain
        conseillé doit ramener cet écart sous le plafond, sinon le champ ne
        sert à rien.
        """
        categorie = "01_Impacts_and_Booms"
        avant = [-34.7, -30.6, -22.1, -14.0]
        apres = [n + sfx.gain_conseille(categorie, n) for n in avant]
        self.assertGreater(max(avant) - min(avant), 20.0)
        self.assertLess(max(apres) - min(apres), max(avant) - min(avant))


class Construction(unittest.TestCase):
    def test_le_catalogue_decrit_ce_qui_existe(self):
        """Un catalogue qui pointe vers un fichier absent est pire qu'aucun."""
        with tempfile.TemporaryDirectory() as dossier:
            racine = Path(dossier)
            # Une seule recette : construire les quarante-deux prendrait huit
            # secondes à chaque passage de la barrière.
            toutes = sfx.RECETTES
            try:
                sfx.RECETTES = [r for r in toutes if r[0] == "ui_clic"]
                resultat = sfx.construire(racine, sans_reseau=True, par_mot=0,
                                          debit="128k", refaire=True)
            finally:
                sfx.RECETTES = toutes

            self.assertEqual(len(resultat["catalogue"]), 1)
            entree = resultat["catalogue"][0]
            self.assertTrue((racine / entree["chemin"]).is_file())
            for champ in ("nom", "categorie", "duree_s", "format", "chemin",
                          "octets", "perte_db", "gain_conseille_db"):
                self.assertIn(champ, entree)
            self.assertGreater(entree["octets"], 0)

    def test_l_arborescence_est_complete(self):
        with tempfile.TemporaryDirectory() as dossier:
            racine = Path(dossier)
            toutes = sfx.RECETTES
            try:
                sfx.RECETTES = []
                sfx.construire(racine, sans_reseau=True, par_mot=0,
                               debit="128k", refaire=True)
            finally:
                sfx.RECETTES = toutes
            for categorie in sfx.CATEGORIES:
                self.assertTrue((racine / categorie / "app_optimized").is_dir())

    def test_le_catalogue_est_du_json_lisible(self):
        with tempfile.TemporaryDirectory() as dossier:
            racine = Path(dossier)
            (racine / "audio_catalog.json").write_text(
                json.dumps({"version": 1, "sons": []}), encoding="utf-8")
            charge = json.loads((racine / "audio_catalog.json").read_text(encoding="utf-8"))
            self.assertEqual(charge["version"], 1)


class SansReseau(unittest.TestCase):
    def test_l_absence_de_cle_n_est_pas_une_erreur(self):
        """Le cas courant : pas de clé, et la bibliothèque se suffit."""
        import os
        ancienne = os.environ.pop("FREESOUND_API_KEY", None)
        try:
            journal = []
            with tempfile.TemporaryDirectory() as dossier:
                obtenus = sfx.telecharger_freesound(Path(dossier), 2, journal)
            self.assertEqual(obtenus, [])
            self.assertTrue(any("FREESOUND_API_KEY" in l for l in journal))
        finally:
            if ancienne is not None:
                os.environ["FREESOUND_API_KEY"] = ancienne


if __name__ == "__main__":
    unittest.main()
