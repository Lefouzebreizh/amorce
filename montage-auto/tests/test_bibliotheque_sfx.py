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
                                          debit="128k", refaire=True,
                                          apercus=False)
            finally:
                sfx.RECETTES = toutes

            self.assertEqual(len(resultat["catalogue"]), 1)
            entree = resultat["catalogue"][0]
            self.assertTrue((racine / entree["chemin"]).is_file())
            for champ in ("nom", "categorie", "duree_s", "duration_ms", "format",
                          "chemin", "octets", "perte_db", "gain_conseille_db",
                          "phone_loss_db", "sample_rate", "true_peak_db",
                          "mood", "intensity", "license", "recipe_layering"):
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
                self.assertTrue((racine / categorie).is_dir())
            for annexe in ("app_optimized", "previews", "recipes",
                           "my_signature_sounds"):
                self.assertTrue((racine / annexe).is_dir(), annexe)
            for sous in sfx.sfx_pro.SOUS_DOSSIERS["01_Impacts_and_Booms"]:
                self.assertTrue((racine / "01_Impacts_and_Booms" / sous).is_dir())

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


class CoucheProfessionnelle(unittest.TestCase):
    """Ce que la couche « monteur » doit garantir, et que rien d'autre ne dit."""

    def test_un_clic_bref_n_est_pas_pris_pour_un_dechet(self):
        """Le conflit qui a coûté les deux sons les plus utilisés de la catégorie 5.

        Le plancher de 0,3 s vise un fichier tronqué, jamais une recette brève
        voulue. Appliqué littéralement, il supprimait `ui_clic` (0,16 s).
        """
        brefs = [r for r in sfx.RECETTES if r[2] < sfx.DUREE_MINIMALE_S]
        self.assertTrue(brefs, "aucune recette brève : le test ne prouve plus rien")
        with tempfile.TemporaryDirectory() as dossier:
            toutes = sfx.RECETTES
            try:
                sfx.RECETTES = brefs
                resultat = sfx.construire(Path(dossier), sans_reseau=True, par_mot=0,
                                          debit="128k", refaire=True, apercus=False)
            finally:
                sfx.RECETTES = toutes
        self.assertEqual(len(resultat["catalogue"]), len(brefs))

    def test_le_rognage_garde_une_marge(self):
        """Couper au ras du premier échantillon audible fabrique un clic."""
        signal = numpy.zeros(48000)
        signal[24000:24100] = 0.8
        rogne = sfx.sfx_pro.rogner_silence(signal, taux=48000)
        self.assertGreater(len(rogne), 100)
        self.assertLess(len(rogne), 48000)

    def test_un_son_trop_court_n_a_pas_de_sonie(self):
        """BS.1770 exige 400 ms : inventer un LUFS serait plus faux que rien."""
        self.assertIsNone(sfx.sfx_pro.mesurer_lufs(numpy.zeros(4800), 48000))

    def test_le_vrai_pic_depasse_le_pic_echantillon(self):
        t = numpy.arange(4800) / 48000
        signal = numpy.sin(2 * numpy.pi * 11000 * t) * 0.9
        crete = 20 * numpy.log10(float(numpy.max(numpy.abs(signal))))
        self.assertGreaterEqual(sfx.sfx_pro.mesurer_vrai_pic(signal), crete - 0.01)

    def test_chaque_son_a_un_caractere(self):
        """Un filtre par humeur ne vaut que si aucune entrée n'y échappe."""
        for nom, _, _, _ in sfx.RECETTES:
            with self.subTest(nom=nom):
                self.assertIn(nom, sfx.sfx_pro.CARACTERE)

    def test_les_intensites_sont_dans_la_plage(self):
        for nom, (humeur, intensite) in sfx.sfx_pro.CARACTERE.items():
            with self.subTest(nom=nom):
                self.assertTrue(humeur)
                self.assertGreaterEqual(intensite, 1)
                self.assertLessEqual(intensite, 10)

    def test_les_sous_dossiers_ne_citent_que_des_sons_connus(self):
        connus = {r[0] for r in sfx.RECETTES}
        for categorie, groupes in sfx.sfx_pro.SOUS_DOSSIERS.items():
            for sous, membres in groupes.items():
                for nom in membres:
                    with self.subTest(sous=sous, nom=nom):
                        self.assertIn(nom, connus)

    def test_un_son_n_est_range_qu_une_fois(self):
        """Deux sous-dossiers pour un même son en feraient deux copies."""
        for categorie, groupes in sfx.sfx_pro.SOUS_DOSSIERS.items():
            vus = [n for membres in groupes.values() for n in membres]
            self.assertEqual(len(vus), len(set(vus)), categorie)

    def test_la_page_est_autonome_et_echappee(self):
        with tempfile.TemporaryDirectory() as dossier:
            racine = Path(dossier)
            page = sfx.sfx_pro.ecrire_page(
                [{"nom": "essai</script>", "categorie": "01_Impacts_and_Booms",
                  "duree_s": 1.0, "perte_db": 3.0, "chemin": "a.wav"}], racine)
            texte = page.read_text(encoding="utf-8")
        self.assertNotIn("http://", texte)
        self.assertNotIn("https://", texte)
        # Le nom hostile ne doit pas refermer la balise du script.
        self.assertNotIn("essai</script>", texte)

    def test_les_bacs_portent_tous_les_sons(self):
        with tempfile.TemporaryDirectory() as dossier:
            racine = Path(dossier)
            catalogue = [{"nom": "a", "categorie": "01_Impacts_and_Booms",
                          "chemin": "a.wav", "duree_s": 1.0, "mood": "brutal"},
                         {"nom": "b", "categorie": "04_Drones_and_Ambiances",
                          "chemin": "b.wav", "duree_s": 2.0, "mood": "sombre"}]
            for chemin in sfx.sfx_pro.ecrire_bacs(catalogue, racine):
                with self.subTest(fichier=chemin.name):
                    texte = chemin.read_text(encoding="utf-8")
                    self.assertIn("a", texte)
                    self.assertIn("b", texte)

    def test_les_cinq_recettes_sont_ecrites(self):
        with tempfile.TemporaryDirectory() as dossier:
            ecrits = sfx.sfx_pro.ecrire_recettes(Path(dossier))
        self.assertEqual(len(ecrits), 5)

    def test_les_licences_disent_la_verite_sur_l_absence_d_import(self):
        with tempfile.TemporaryDirectory() as dossier:
            chemin = sfx.sfx_pro.ecrire_licences(
                [{"nom": "a", "source": "synthese"}], Path(dossier))
            texte = chemin.read_text(encoding="utf-8")
        self.assertIn("Aucun", texte)

    def test_le_wav_24_bits_fait_l_aller_retour(self):
        with tempfile.TemporaryDirectory() as dossier:
            chemin = Path(dossier) / "e.wav"
            t = numpy.arange(4800) / 48000
            origine = numpy.sin(2 * numpy.pi * 440 * t) * 0.5
            sfx.sfx_pro.ecrire_wav_24(chemin, origine, 48000)
            relu, taux = sfx.sfx_pro.lire_wav(chemin)
        self.assertEqual(taux, 48000)
        self.assertEqual(len(relu), len(origine))
        self.assertLess(float(numpy.max(numpy.abs(relu - origine))), 1e-4)

    def test_la_signature_retient_les_moins_perdus(self):
        with tempfile.TemporaryDirectory() as dossier:
            racine = Path(dossier)
            catalogue = []
            for rang, perte in enumerate((1.0, 20.0, 5.0)):
                nom = f"s{rang}.wav"
                sfx.sfx_pro.ecrire_wav_24(racine / nom, numpy.zeros(4800), 48000)
                catalogue.append({"nom": f"s{rang}", "chemin": nom, "perte_db": perte})
            retenus = sfx.poser_signature(catalogue, racine, combien=2)
        self.assertEqual([s["perte_db"] for s in retenus], [1.0, 5.0])


if __name__ == "__main__":
    unittest.main()


class Esquive(unittest.TestCase):
    """L'esquive du lit sous la voix, et le piège qu'elle a coûté."""

    def setUp(self):
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
        import monter_episode
        self.montage = monter_episode

    def test_une_fenetre_creuse_bien_le_lit(self):
        gain = self.montage.enveloppe_esquive(
            [{"debut": 1.0, "fin": 2.0, "gain": -12}], self.montage.TAUX * 3)
        milieu = gain[int(1.5 * self.montage.TAUX)]
        self.assertAlmostEqual(milieu, 10 ** (-12 / 20), places=3)

    def test_hors_fenetre_le_lit_reste_entier(self):
        gain = self.montage.enveloppe_esquive(
            [{"debut": 1.0, "fin": 2.0, "gain": -12}], self.montage.TAUX * 3)
        self.assertAlmostEqual(gain[0], 1.0, places=6)
        self.assertAlmostEqual(gain[-1], 1.0, places=6)

    def test_deux_fenetres_qui_se_chevauchent_creusent_le_plus_profond(self):
        """Elles ne s'additionnent pas : la plus creuse gagne."""
        gain = self.montage.enveloppe_esquive(
            [{"debut": 1.0, "fin": 2.0, "gain": -6},
             {"debut": 1.5, "fin": 2.5, "gain": -14}], self.montage.TAUX * 3)
        self.assertAlmostEqual(gain[int(1.7 * self.montage.TAUX)],
                               10 ** (-14 / 20), places=3)

    def test_l_attaque_est_plus_rapide_que_le_retour(self):
        """Un lit qui remonte trop vite entre deux mots s'entend respirer."""
        taux = self.montage.TAUX
        gain = self.montage.enveloppe_esquive(
            [{"debut": 1.0, "fin": 2.0, "gain": -12}], taux * 4)
        avant = gain[int(0.95 * taux)]      # dans la rampe d'attaque
        apres = gain[int(2.15 * taux)]      # dans la rampe de retour
        self.assertLess(avant, 1.0)
        self.assertLess(apres, 1.0)
        # à distance égale du bord, le retour a moins progressé que l'attaque
        self.assertLess(apres, avant)

    def test_une_fenetre_hors_du_montage_ne_casse_rien(self):
        gain = self.montage.enveloppe_esquive(
            [{"debut": 90.0, "fin": 95.0, "gain": -9}], self.montage.TAUX)
        self.assertTrue((gain == 1.0).all())
