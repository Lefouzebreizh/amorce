#!/usr/bin/env python3
"""Ce que les raccords d'outils lourds doivent tenir : ne jamais tuer le montage.

`image_animee` et `bouche_synchronisee` appellent des outils qui coûtent des
dizaines de secondes ou des minutes, et qui peuvent échouer pour des raisons qui
ne regardent pas la recette : un visage absent, un modèle non téléchargé, une
inférence tuée par manque de mémoire.

Ce qui est vérifié ici n'est ni la parallaxe ni la synchronisation labiale —
hors de portée d'un test — mais la seule décision qui compte quand elles
échouent : **le plan est rendu intact et le film se monte quand même**. Un film
de douze plans qui meurt parce qu'un visage manque sur l'un d'eux coûte plus
cher que le plan raté.
"""

import contextlib
import io
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from monter_episode import bouche_synchronisee, image_animee  # noqa: E402


class EchecQuiNeTuePas(unittest.TestCase):
    """Un outil qui ne répond pas rend la source, et le dit."""

    def setUp(self):
        self.dossier = Path(tempfile.mkdtemp())
        self.source = self.dossier / "plan.mp4"
        self.source.write_bytes(b"pas une vraie video")

    def tearDown(self):
        shutil.rmtree(self.dossier, ignore_errors=True)

    def test_replique_absente_rend_le_plan_intact(self):
        journal = io.StringIO()
        with contextlib.redirect_stderr(journal):
            rendu, depart = bouche_synchronisee(
                self.source, 1.5, 2.0,
                {"voix": str(self.dossier / "jamais_ecrite.wav")}, self.dossier)
        self.assertEqual(rendu, self.source)
        # Le départ est rendu tel quel : le plan n'a pas été redécoupé, donc
        # `couper` doit encore chercher sa fenêtre dans la source d'origine.
        self.assertEqual(depart, 1.5)
        self.assertIn("introuvable", journal.getvalue())

    def test_une_synchronisation_reussie_repart_de_zero(self):
        """Le rendu en cache **est** la fenêtre : y rechercher `depart` la manquerait."""
        cache = self.dossier / "cache"
        cache.mkdir()
        (cache / "bouche_plan_1.50_2.00_replique.mp4").write_bytes(b"rendu")
        voix = self.dossier / "replique.wav"
        voix.write_bytes(b"son")
        rendu, depart = bouche_synchronisee(
            self.source, 1.5, 2.0, {"voix": str(voix)}, self.dossier)
        self.assertEqual(rendu.name, "bouche_plan_1.50_2.00_replique.mp4")
        self.assertEqual(depart, 0.0)

    def test_parallaxe_impossible_rend_l_image(self):
        image = self.dossier / "fond.png"
        image.write_bytes(b"pas une vraie image")
        journal = io.StringIO()
        with contextlib.redirect_stderr(journal):
            rendu = image_animee(image, 1.6, {}, self.dossier)
        self.assertEqual(rendu, image)


class CacheQuiSurvit(unittest.TestCase):
    """Le cache n'est pas sous `_*`, que la fin du montage efface."""

    def test_le_cache_n_est_pas_balaye_par_le_nettoyage(self):
        dossier = Path(tempfile.mkdtemp())
        try:
            source = dossier / "plan.mp4"
            source.write_bytes(b"x")
            voix = dossier / "replique.wav"
            voix.write_bytes(b"son")
            cache = dossier / "cache"
            cache.mkdir()
            marque = cache / "bouche_plan_0.00_1.00_replique.mp4"
            marque.write_bytes(b"rendu")

            # Ce que `monter` fait en fin de passe.
            for ancien in dossier.glob("_*"):
                ancien.unlink()

            self.assertTrue(marque.is_file())
            rendu, _ = bouche_synchronisee(source, 0.0, 1.0,
                                           {"voix": str(voix)}, dossier)
            self.assertEqual(rendu, marque)
        finally:
            shutil.rmtree(dossier, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
