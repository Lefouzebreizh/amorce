"""Convertir ou ne pas convertir, vérifié sans encoder un seul fichier.

Les cas qui comptent ne sont pas « un HEIC devient un JPG ». Ce sont les refus,
et surtout le refus qui n'en est pas un : un HEIC repassé en JPEG **grossit**,
et un module qui exigerait un gain d'espace de toutes ses règles ne convertirait
jamais une seule photo d'iPhone — en ayant l'air de marcher.
"""

import json
import sys
import unittest
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from modules.conversion import regles  # noqa: E402

CONFIG = json.loads((RACINE / "organizer_config.json").read_text(encoding="utf-8"))
REGLES = CONFIG["conversion"]["regles"]


def source(nom, **precisions):
    """Une source par défaut lisible, non animée et de définition modeste."""
    defauts = {"poids_octets": 3_000_000, "largeur": 1920, "hauteur": 1080}
    defauts.update(precisions)
    return regles.Source(chemin=Path("/entree") / nom, **defauts)


class TestReglePour(unittest.TestCase):
    def test_l_extension_trouve_sa_regle_sans_egard_a_la_casse(self):
        self.assertEqual(regles.regle_pour(Path("a.HEIC"), REGLES)["vers"], "jpg")
        self.assertEqual(regles.regle_pour(Path("a.mkv"), REGLES)["vers"], "mp4")

    def test_une_extension_sans_regle_ne_rend_rien(self):
        self.assertIsNone(regles.regle_pour(Path("a.odt"), REGLES))

    def test_la_premiere_regle_de_la_liste_l_emporte(self):
        # Même parti pris que les thèmes du classement : un ordre que
        # l'utilisateur maîtrise, plutôt qu'un score qu'il devrait deviner.
        deux = [{"de": ["png"], "vers": "jpg"}, {"de": ["png"], "vers": "webp"}]
        self.assertEqual(regles.regle_pour(Path("a.png"), deux)["vers"], "jpg")

    def test_les_extensions_traitees_sont_celles_des_regles_sans_doublon(self):
        traitees = regles.extensions_traitees(REGLES)
        self.assertIn("heic", traitees)
        self.assertIn("mkv", traitees)
        self.assertEqual(len(traitees), len(set(traitees)))


class TestObjectif(unittest.TestCase):
    def test_le_heic_vise_la_compatibilite_et_le_png_l_espace(self):
        # C'est ce couple-là qui rend le module utile : sans lui, un seul seuil
        # de gain déciderait des deux, et le HEIC ne passerait jamais.
        self.assertEqual(regles.objectif_de(regles.regle_pour(Path("a.heic"), REGLES)),
                         regles.OBJECTIF_COMPATIBILITE)
        self.assertEqual(regles.objectif_de(regles.regle_pour(Path("a.png"), REGLES)),
                         regles.OBJECTIF_ESPACE)

    def test_un_objectif_absent_ou_inconnu_retombe_sur_le_plus_exigeant(self):
        self.assertEqual(regles.objectif_de({"de": ["x"], "vers": "jpg"}),
                         regles.OBJECTIF_ESPACE)
        self.assertEqual(regles.objectif_de({"objectif": "rapidité"}),
                         regles.OBJECTIF_ESPACE)


class TestRefus(unittest.TestCase):
    def test_un_fichier_deja_au_format_vise_n_est_pas_reconverti(self):
        decision = regles.decider(source("photo.jpg"), CONFIG)
        self.assertFalse(decision.a_convertir)

    def test_un_heic_qui_est_un_png_deguise_n_est_pas_recompresse(self):
        # Piège 4 du domaine. Sans le format réel, ce fichier repasserait par
        # l'encodeur JPEG à chaque exécution, une génération de qualité à chaque
        # fois — et rien ne le signalerait.
        decision = regles.decider(source("photo.heic", format_reel="jpeg"), CONFIG)
        self.assertFalse(decision.a_convertir)
        self.assertIn("recompresserait", decision.motif)

    def test_un_png_transparent_reste_un_png(self):
        decision = regles.decider(source("logo.png", transparence=True), CONFIG)
        self.assertFalse(decision.a_convertir)
        self.assertIn("aplatirait", decision.motif)

    def test_une_transparence_non_mesuree_vaut_refus_et_non_absence(self):
        # « pas mesuré » n'est pas « pas de transparence », comme `nettete = None`
        # n'est pas « nette ». Le doute garde l'original.
        decision = regles.decider(source("capture.png", transparence=None), CONFIG)
        self.assertFalse(decision.a_convertir)
        self.assertIn("non mesurée", decision.motif)

    def test_un_png_anime_ne_perd_pas_ses_images(self):
        decision = regles.decider(source("anime.png", transparence=False, images=48), CONFIG)
        self.assertFalse(decision.a_convertir)
        self.assertIn("première", decision.motif)

    def test_un_conteneur_sans_piste_video_n_est_pas_une_video(self):
        decision = regles.decider(source("concert.mkv", piste_video=False), CONFIG)
        self.assertFalse(decision.a_convertir)
        self.assertIn("enregistrement sonore", decision.motif)

    def test_un_film_a_sous_titres_image_reste_dans_son_conteneur(self):
        # Le MP4 porte du texte, pas les images d'un PGS. Les laisser tomber en
        # silence retirerait ses sous-titres à un film sans que rien ne le dise.
        decision = regles.decider(
            source("film.mkv", codec_video="h264", codec_audio="aac",
                   sous_titres_image=2), CONFIG)
        self.assertFalse(decision.a_convertir)
        self.assertIn("sous-titres image", decision.motif)

    def test_un_fichier_illisible_porte_le_mot_de_l_outil(self):
        decision = regles.decider(
            source("casse.mkv", lisible=False, diagnostic="moov atom not found"), CONFIG)
        self.assertFalse(decision.a_convertir)
        self.assertIn("moov atom not found", decision.motif)


class TestDecider(unittest.TestCase):
    def test_un_heic_ordinaire_part_en_jpg_a_cote_de_lui(self):
        decision = regles.decider(source("IMG_4312.heic"), CONFIG)
        self.assertEqual(decision.destination, Path("/entree/IMG_4312.jpg"))
        self.assertIn("compatibilite", decision.motif)

    def test_une_photo_trop_large_est_reduite_en_conservant_son_rapport(self):
        decision = regles.decider(
            source("panorama.heic", largeur=8000, hauteur=4000), CONFIG)
        self.assertEqual(decision.redimensionner, (4096, 2048))

    def test_un_mkv_h264_aac_est_remuxe_et_non_reencode(self):
        # Le geste qui change tout : quelques secondes au lieu de plusieurs
        # minutes, et pas une image retouchée.
        decision = regles.decider(
            source("film.mkv", codec_video="h264", codec_audio="aac"), CONFIG)
        self.assertTrue(decision.remuxer)

    def test_un_mkv_en_vp9_doit_etre_reencode(self):
        decision = regles.decider(
            source("film.mkv", codec_video="vp9", codec_audio="opus"), CONFIG)
        self.assertTrue(decision.a_convertir)
        self.assertFalse(decision.remuxer)

    def test_une_video_a_reduire_ne_peut_pas_etre_remuxee(self):
        # Réduire suppose de décoder : les deux gestes s'excluent, et c'est le
        # plafond posé par l'utilisateur qui l'emporte.
        decision = regles.decider(
            source("4k.mkv", codec_video="h264", codec_audio="aac",
                   largeur=3840, hauteur=2160), CONFIG)
        self.assertFalse(decision.remuxer)
        self.assertEqual(decision.redimensionner, (1920, 1080))


class TestRemuxable(unittest.TestCase):
    def test_une_video_muette_se_remuxe(self):
        self.assertTrue(regles.remuxable("h264", "", "mp4"))

    def test_un_codec_audio_inconnu_impose_le_reencodage(self):
        self.assertFalse(regles.remuxable("h264", "opus", "mp4"))

    def test_on_ne_remuxe_que_vers_le_mp4(self):
        self.assertFalse(regles.remuxable("h264", "aac", "mkv"))


class TestDimensionsCibles(unittest.TestCase):
    def test_un_fichier_sous_le_plafond_n_est_pas_touche(self):
        self.assertIsNone(regles.dimensions_cibles(1280, 720, hauteur_max=1080))

    def test_on_n_agrandit_jamais(self):
        # Agrandir est le travail du module 5, « à côté de l'original ».
        self.assertIsNone(regles.dimensions_cibles(640, 480, largeur_max=4096))

    def test_les_deux_cotes_sont_pairs_car_libx264_les_exige(self):
        # L'échec arrive après le réencodage, jamais avant : c'est le pire
        # moment pour découvrir une largeur impaire.
        largeur, hauteur = regles.dimensions_cibles(1919, 1439, hauteur_max=1080)
        self.assertEqual(largeur % 2, 0)
        self.assertEqual(hauteur % 2, 0)

    def test_une_definition_nulle_ne_donne_aucune_cible(self):
        self.assertIsNone(regles.dimensions_cibles(0, 0, hauteur_max=1080))


class TestVerdict(unittest.TestCase):
    def _conversion(self, nom, poids):
        return regles.decider(source(nom, poids_octets=poids, transparence=False), CONFIG)

    def test_un_png_qui_maigrit_assez_remplace_son_original(self):
        retenu, motif = regles.verdict(
            self._conversion("capture.png", 1_000_000), 600_000, CONFIG)
        self.assertTrue(retenu)
        self.assertIn("40 %", motif)

    def test_un_png_qui_maigrit_trop_peu_ne_remplace_rien(self):
        # Le cas fréquent : une capture d'écran de couleurs plates. Le JPEG ne
        # gagne presque rien et coûte les artefacts.
        retenu, motif = regles.verdict(
            self._conversion("capture.png", 1_000_000), 950_000, CONFIG)
        self.assertFalse(retenu)
        self.assertIn("seuil", motif)

    def test_un_png_qui_grossit_ne_dit_pas_avoir_rendu_de_l_espace(self):
        # Mesuré sur un vrai dossier : une capture d'écran d'aplats grossit de
        # 79 % en JPEG, et « −79 % d'espace rendu » se lit exactement à l'envers
        # de ce qui s'est passé.
        retenu, motif = regles.verdict(
            self._conversion("capture.png", 1_000_000), 1_790_000, CONFIG)
        self.assertFalse(retenu)
        self.assertIn("79 % plus lourd", motif)
        self.assertNotIn("rendu", motif)

    def test_un_heic_qui_grossit_est_quand_meme_converti(self):
        # Le cœur du module : ce que la conversion achète ici n'est pas de la
        # place, c'est un fichier qui s'ouvre ailleurs qu'à l'intérieur d'Apple.
        retenu, motif = regles.verdict(
            self._conversion("IMG_1.heic", 2_000_000), 3_400_000, CONFIG)
        self.assertTrue(retenu)
        self.assertIn("compatibilité", motif)

    def test_un_encodage_qui_explose_le_poids_est_refuse_meme_en_compatibilite(self):
        retenu, motif = regles.verdict(
            self._conversion("IMG_1.heic", 2_000_000), 9_000_000, CONFIG)
        self.assertFalse(retenu)
        self.assertIn("plus lourd", motif)

    def test_un_fichier_produit_vide_ne_remplace_jamais_rien(self):
        retenu, motif = regles.verdict(self._conversion("IMG_1.heic", 2_000_000), 0, CONFIG)
        self.assertFalse(retenu)
        self.assertIn("vide", motif)


class TestGainEtBilan(unittest.TestCase):
    def test_un_gain_negatif_dit_que_le_fichier_a_grossi(self):
        self.assertAlmostEqual(regles.gain_pct(100, 150), -50.0)

    def test_un_poids_de_depart_nul_ne_divise_pas_par_zero(self):
        self.assertEqual(regles.gain_pct(0, 100), 0.0)

    def test_le_bilan_totalise_l_avant_et_l_apres(self):
        self.assertEqual(regles.bilan([(1000, 600), (2000, 1500)]), (3000, 2100))


if __name__ == "__main__":
    unittest.main()
