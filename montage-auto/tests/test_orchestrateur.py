#!/usr/bin/env python3
"""Ce que la reprise doit tenir : ni recalculer pour rien, ni réutiliser un périmé.

Les deux étapes coûteuses sont remplacées par des doublures qui comptent leurs
appels et déposent un fichier. Ce qui est vérifié ici n'est donc pas la qualité
de la voix ni celle du lip-sync — hors de portée d'un test — mais la seule chose
que l'orchestrateur décide vraiment : quelle étape doit tourner.

Les deux erreurs possibles n'ont pas la même gravité. Recalculer une étape
inchangée coûte du temps. Réutiliser une étape périmée produit une vidéo qui
s'ouvre normalement et dit la mauvaise chose : c'est le cas que la moitié de ces
tests surveille.
"""

import contextlib
import io
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import faire_ma_video as chaine  # noqa: E402
from faire_ma_video import empreinte_fichier, faut_il_executer  # noqa: E402


class DecisionDExecution(unittest.TestCase):
    """`faut_il_executer` en isolation : les raisons de refaire."""

    def setUp(self):
        self.dossier = Path(tempfile.mkdtemp())
        self.sortie = self.dossier / "sortie.bin"
        self.sortie.write_bytes(b"resultat")

    def tearDown(self):
        shutil.rmtree(self.dossier, ignore_errors=True)

    def test_une_etape_inchangee_ne_se_refait_pas(self):
        self.assertFalse(faut_il_executer({"empreinte": "abc"}, "abc", self.sortie, refaire=False))

    def test_des_entrees_changees_refont_l_etape(self):
        self.assertTrue(faut_il_executer({"empreinte": "abc"}, "xyz", self.sortie, refaire=False))

    def test_une_sortie_effacee_a_la_main_refait_l_etape(self):
        # L'oubli classique : l'état prétend que c'est fait, le fichier n'est
        # plus là. Sans ce contrôle, l'étape suivante travaillerait sur du vide.
        self.sortie.unlink()
        self.assertTrue(faut_il_executer({"empreinte": "abc"}, "abc", self.sortie, refaire=False))

    def test_une_sortie_vide_compte_comme_absente(self):
        # Un fichier de zéro octet est ce que laisse une interruption : présent,
        # donc crédible, et inutilisable.
        self.sortie.write_bytes(b"")
        self.assertTrue(faut_il_executer({"empreinte": "abc"}, "abc", self.sortie, refaire=False))

    def test_refaire_l_emporte_sur_tout(self):
        self.assertTrue(faut_il_executer({"empreinte": "abc"}, "abc", self.sortie, refaire=True))

    def test_une_empreinte_de_fichier_suit_le_contenu(self):
        fichier = self.dossier / "source.mp4"
        fichier.write_bytes(b"a" * 100)
        avant = empreinte_fichier(fichier)
        fichier.write_bytes(b"a" * 200)
        self.assertNotEqual(avant, empreinte_fichier(fichier))

    def test_un_fichier_absent_a_une_empreinte_stable(self):
        self.assertEqual(empreinte_fichier(self.dossier / "jamais.mp4"), "absent")


class ChaineComplete(unittest.TestCase):
    """La chaîne de bout en bout, les deux étapes coûteuses remplacées."""

    def setUp(self):
        self.dossier = Path(tempfile.mkdtemp())
        self.travail = self.dossier / "travail"
        self.travail.mkdir()
        self.visage = self.dossier / "visage.mp4"
        self.visage.write_bytes(b"video" * 100)
        self.sortie = self.dossier / "final.mp4"

        self.appels = {"voix": 0, "lipsync": 0, "resolve": 0}
        self._vraies = (chaine.generate_speech, chaine.run_lipsync, chaine.preparer_montage)

        chaine.generate_speech = self._fausse_voix
        chaine.run_lipsync = self._faux_lipsync
        chaine.preparer_montage = self._faux_resolve

    def tearDown(self):
        chaine.generate_speech, chaine.run_lipsync, chaine.preparer_montage = self._vraies
        shutil.rmtree(self.dossier, ignore_errors=True)

    def _fausse_voix(self, texte, voice_id, output_path, model_id):
        self.appels["voix"] += 1
        Path(output_path).write_bytes(b"mp3" + texte.encode())
        return Path(output_path)

    def _faux_lipsync(self, video, audio, sortie, pads, resize_factor, nosmooth):
        self.appels["lipsync"] += 1
        Path(sortie).write_bytes(b"mp4")
        return True

    def _faux_resolve(self, rushes):
        self.appels["resolve"] += 1
        return True

    def _lancer(self, texte="Bonjour", **extras):
        extras.setdefault("sans_resolve", True)
        muet = io.StringIO()
        with contextlib.redirect_stdout(muet), contextlib.redirect_stderr(muet):
            return self._appeler(texte, extras)

    def _appeler(self, texte, extras):
        return chaine.faire_ma_video(
            texte=texte,
            video_visage=self.visage,
            sortie_finale=self.sortie,
            dossier_travail=self.travail,
            **extras,
        )

    def test_le_premier_lancement_fait_tout(self):
        self.assertEqual(self._lancer(), 0)
        self.assertEqual((self.appels["voix"], self.appels["lipsync"]), (1, 1))

    def test_relancer_a_l_identique_ne_refait_rien(self):
        self._lancer()
        self.assertEqual(self._lancer(), 0)
        self.assertEqual((self.appels["voix"], self.appels["lipsync"]), (1, 1))

    def test_un_texte_corrige_refait_la_voix_et_le_lipsync(self):
        # Le cas qui justifie tout le fichier : garder l'ancien lip-sync
        # donnerait une vidéo qui dit encore la phrase d'avant.
        self._lancer(texte="Bonjour")
        self._lancer(texte="Bonjour à tous")
        self.assertEqual((self.appels["voix"], self.appels["lipsync"]), (2, 2))

    def test_changer_de_voix_refait_aussi_le_lipsync(self):
        self._lancer()
        self._lancer(voice_id="une_autre_voix")
        self.assertEqual((self.appels["voix"], self.appels["lipsync"]), (2, 2))

    def test_un_reglage_de_lipsync_ne_refait_pas_la_voix(self):
        # La voix ne dépend pas des marges du visage : la refaire coûterait des
        # crédits ElevenLabs pour un fichier rigoureusement identique.
        self._lancer()
        self._lancer(pads=(0, 25, 0, 0))
        self.assertEqual((self.appels["voix"], self.appels["lipsync"]), (1, 2))

    def test_une_video_source_remplacee_refait_le_lipsync_seul(self):
        self._lancer()
        self.visage.write_bytes(b"autre video" * 50)
        self._lancer()
        self.assertEqual((self.appels["voix"], self.appels["lipsync"]), (1, 2))

    def test_la_sortie_effacee_se_refait_sans_toucher_a_la_voix(self):
        self._lancer()
        self.sortie.unlink()
        self._lancer()
        self.assertEqual((self.appels["voix"], self.appels["lipsync"]), (1, 2))

    def test_refaire_relance_tout(self):
        self._lancer()
        self._lancer(refaire=True)
        self.assertEqual((self.appels["voix"], self.appels["lipsync"]), (2, 2))

    def test_un_echec_de_voix_arrete_la_chaine(self):
        chaine.generate_speech = lambda *a, **k: None
        self.assertEqual(self._lancer(), 1)
        self.assertEqual(self.appels["lipsync"], 0)

    def test_un_echec_de_lipsync_laisse_la_voix_reutilisable(self):
        # Après un échec, relancer ne doit pas redemander la voix à ElevenLabs :
        # elle est faite, elle est bonne, elle est payée.
        chaine.run_lipsync = lambda *a, **k: False
        self.assertEqual(self._lancer(), 1)

        chaine.run_lipsync = self._faux_lipsync
        self.assertEqual(self._lancer(), 0)
        self.assertEqual(self.appels["voix"], 1)

    def test_resolve_est_appele_quand_on_ne_le_coupe_pas(self):
        self.assertEqual(self._lancer(sans_resolve=False), 0)
        self.assertEqual(self.appels["resolve"], 1)

    def test_un_echec_de_resolve_n_efface_pas_la_video(self):
        # Décision 4 du fichier : le livrable est la vidéo, pas la timeline.
        chaine.preparer_montage = lambda rushes: False
        self.assertEqual(self._lancer(sans_resolve=False), 1)
        self.assertTrue(self.sortie.is_file())

    def test_un_etat_illisible_ne_bloque_pas_la_chaine(self):
        self._lancer()
        (self.travail / chaine.NOM_ETAT).write_text("{ ceci n'est pas du json")
        self.assertEqual(self._lancer(), 0)


if __name__ == "__main__":
    unittest.main()
