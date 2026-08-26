#!/usr/bin/env python3
"""Ce que la chaîne doit tenir, sans réseau, sans GPU et sans DaVinci Resolve.

Les trois scripts passent l'essentiel de leur temps dans des outils extérieurs
qu'on ne peut pas convoquer ici : l'API ElevenLabs, un modèle PyTorch d'un demi-
gigaoctet, un logiciel de montage propriétaire. Ce qui reste vérifiable est
précisément ce qui décide du sort de l'utilisateur quand quelque chose se passe
mal — la traduction d'un code d'erreur en phrase actionnable, l'ordre des plans,
le repérage de la progression — et c'est ce qui est couvert ici.

    python3 -m unittest discover -s montage-auto/tests
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from auto_lipsync import MOTIF_PROGRESSION  # noqa: E402
from elevenlabs_voice import _expliquer_erreur_api  # noqa: E402
from prepare_my_edit import rassembler_rushes  # noqa: E402


class ErreurFeinte:
    """Tient lieu d'`ApiError` : seuls `status_code` et `body` sont consultés."""

    def __init__(self, status_code, body=None):
        self.status_code = status_code
        self.body = body


class TraductionDesErreursApi(unittest.TestCase):
    def test_une_cle_refusee_nomme_la_variable_a_corriger(self):
        message = _expliquer_erreur_api(ErreurFeinte(401))
        self.assertIn("ELEVENLABS_API_KEY", message)

    def test_un_quota_epuise_ne_se_confond_pas_avec_une_cle_invalide(self):
        # ElevenLabs annonce le quota épuisé tantôt en 402, tantôt en 401 avec la
        # cause dans le corps. Les deux doivent mener au même conseil, sinon on
        # envoie l'utilisateur régénérer une clé parfaitement valide.
        for erreur in (
            ErreurFeinte(402),
            ErreurFeinte(401, {"detail": {"status": "quota_exceeded"}}),
        ):
            with self.subTest(code=erreur.status_code):
                self.assertIn("Crédits insuffisants", _expliquer_erreur_api(erreur))

    def test_une_voix_inconnue_rappelle_qu_on_attend_un_identifiant(self):
        message = _expliquer_erreur_api(ErreurFeinte(404))
        self.assertIn("identifiant", message)

    def test_un_code_imprevu_reste_lisible(self):
        message = _expliquer_erreur_api(ErreurFeinte(503, {"detail": "maintenance"}))
        self.assertIn("503", message)
        self.assertIn("maintenance", message)

    def test_une_reponse_volumineuse_est_tronquee(self):
        # Certaines erreurs renvoient la requête entière : déversée telle quelle,
        # elle noierait le conseil qui la précède.
        message = _expliquer_erreur_api(ErreurFeinte(500, "x" * 5000))
        self.assertLess(len(message), 700)


class RepérageDeLaProgression(unittest.TestCase):
    def test_une_ligne_de_tqdm_livre_l_avancement(self):
        ligne = " 45%|████      | 45/100 [00:03<00:04, 12.30it/s]"
        fait, total = MOTIF_PROGRESSION.search(ligne).groups()
        self.assertEqual((fait, total), ("45", "100"))

    def test_une_fraction_hors_barre_n_est_pas_prise_pour_un_avancement(self):
        # FFmpeg et Wav2Lip écrivent des fractions dans leurs messages ; sans le
        # crochet ouvrant exigé par le motif, la barre partirait sur un total
        # arbitraire et n'atteindrait jamais sa fin.
        for ligne in (
            "Input #0, mov,mp4, fps=30000/1001",
            "Number of frames available for inference: 250",
            "Resizing 1920/1080 to fit",
        ):
            with self.subTest(ligne=ligne):
                self.assertIsNone(MOTIF_PROGRESSION.search(ligne))


class CollecteDesRushes(unittest.TestCase):
    def setUp(self):
        import tempfile

        self.dossier = Path(tempfile.mkdtemp())

    def tearDown(self):
        import shutil

        shutil.rmtree(self.dossier, ignore_errors=True)

    def _poser(self, *noms):
        for nom in noms:
            (self.dossier / nom).write_bytes(b"")

    def test_les_plans_sortent_dans_l_ordre_alphabetique(self):
        self._poser("plan_10.mp4", "plan_02.mp4", "plan_01.mp4")
        noms = [chemin.name for chemin in rassembler_rushes(self.dossier, None)]
        self.assertEqual(noms, ["plan_01.mp4", "plan_02.mp4", "plan_10.mp4"])

    def test_le_tri_ignore_la_casse(self):
        # Sur un système sensible à la casse, un tri brut placerait toutes les
        # majuscules avant toutes les minuscules : « Plan_02 » monterait avant
        # « plan_01 », ce qui n'a de sens pour personne.
        self._poser("plan_01.mp4", "Plan_02.mov")
        noms = [chemin.name for chemin in rassembler_rushes(self.dossier, None)]
        self.assertEqual(noms, ["plan_01.mp4", "Plan_02.mov"])

    def test_les_extensions_sont_reconnues_quelle_que_soit_la_casse(self):
        # Beaucoup d'appareils photo écrivent « .MOV » en majuscules.
        self._poser("a.MP4", "b.MoV", "c.MKV")
        self.assertEqual(len(rassembler_rushes(self.dossier, None)), 3)

    def test_ce_qui_n_est_pas_une_video_reste_dehors(self):
        self._poser("plan.mp4", "notes.txt", "musique.wav", "vieux.avi")
        noms = [chemin.name for chemin in rassembler_rushes(self.dossier, None)]
        self.assertEqual(noms, ["plan.mp4"])

    def test_un_fichier_explicite_manquant_annule_tout(self):
        # Importer trois rushes sur quatre produirait une timeline plausible mais
        # incomplète : le trou ne se verrait qu'au visionnage.
        self._poser("present.mp4")
        demandes = [str(self.dossier / "present.mp4"), str(self.dossier / "absent.mp4")]
        self.assertEqual(rassembler_rushes(self.dossier, demandes), [])


if __name__ == "__main__":
    unittest.main()
