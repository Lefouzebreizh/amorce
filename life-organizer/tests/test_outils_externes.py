"""La recherche de ffmpeg, ffprobe et tesseract, sans en installer aucun.

Le `PATH` est fabriqué pour l'occasion : c'est la seule façon de vérifier le
comportement en l'absence d'un outil sur une machine où il est présent, et
inversement. Sans cela, ces tests diraient quelque chose de différent sur chaque
machine, ce qui revient à ne rien dire.

Ce qui compte ici tient en une phrase : trouver `ffmpeg` ne donne pas `ffprobe`.
Le repli `imageio-ffmpeg` n'embarque que le premier, et supposer le second fait
échouer l'inspection des vidéos au premier fichier, sur une installation qui
semblait complète.
"""

import os
import stat
import sys
import tempfile
import unittest
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from noyau import outils_externes  # noqa: E402


class PathFabriqué:
    """Un `PATH` ne contenant que les outils nommés, le temps d'un test."""

    def __init__(self, *outils: str) -> None:
        self.outils = outils

    def __enter__(self) -> Path:
        self._dossier = tempfile.TemporaryDirectory()
        dossier = Path(self._dossier.name)
        for outil in self.outils:
            binaire = dossier / outil
            binaire.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
            binaire.chmod(binaire.stat().st_mode | stat.S_IXUSR)
        self._ancien = os.environ.get("PATH", "")
        os.environ["PATH"] = str(dossier)
        # La recherche est mise en cache pour ne pas parcourir le PATH deux
        # mille fois : sans purge, le premier test déciderait des suivants.
        outils_externes.trouver.cache_clear()
        return dossier

    def __exit__(self, *_) -> None:
        os.environ["PATH"] = self._ancien
        outils_externes.trouver.cache_clear()
        self._dossier.cleanup()


class Recherche(unittest.TestCase):
    def test_un_outil_du_PATH_est_trouvé(self):
        with PathFabriqué("ffmpeg", "ffprobe") as dossier:
            self.assertEqual(outils_externes.trouver_ffprobe(), dossier / "ffprobe")

    def test_un_outil_absent_rend_None_plutôt_que_de_lever(self):
        # Une absence est un état à lire avant de commencer, pas une exception
        # à rattraper au millième fichier.
        with PathFabriqué():
            self.assertIsNone(outils_externes.trouver_tesseract())

    def test_ffmpeg_présent_ne_vaut_pas_ffprobe_présent(self):
        # Le repli imageio-ffmpeg ne livre que ffmpeg. Confondre les deux fait
        # échouer l'inspection des vidéos sur une machine qui semblait prête.
        with PathFabriqué("ffmpeg"):
            self.assertIsNotNone(outils_externes.trouver_ffmpeg())
            self.assertIsNone(outils_externes.trouver_ffprobe())


class Capacités(unittest.TestCase):
    def test_l_état_rendu_couvre_les_trois_outils(self):
        with PathFabriqué("ffmpeg"):
            capacites = outils_externes.capacites()
        self.assertEqual(set(capacites), {"ffmpeg", "ffprobe", "tesseract"})
        self.assertTrue(capacites["ffmpeg"])
        self.assertFalse(capacites["ffprobe"])

    def test_chaque_outil_a_sa_marche_à_suivre_d_installation(self):
        for outil in ("ffmpeg", "ffprobe", "tesseract"):
            message = outils_externes.message_installation(outil)
            # Une ligne de commande, pas un « installez ffmpeg » qui renvoie à
            # un moteur de recherche.
            self.assertIn("apt install", message, outil)

    def test_le_message_de_ffprobe_dit_que_le_paquet_Python_ne_suffit_pas(self):
        self.assertIn("imageio-ffmpeg", outils_externes.message_installation("ffprobe"))


if __name__ == "__main__":
    unittest.main()
