#!/usr/bin/env python3
"""Le verrou de tour, éprouvé sur de vrais processus.

Les deux tests qui comptent lancent un **second interpréteur** plutôt que de
simuler la concurrence : `flock` est consultatif et par descripteur, et deux
prises depuis le même processus ne prouveraient rien du cas réel — deux tâches
planifiées qui se chevauchent. Un test qui passerait sans rien garder serait
pire que pas de test.
"""

import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
from core.verrou import ScanDejaEnCours, Verrou  # noqa: E402

# Prend le verrou, annonce qu'il le tient, puis attend qu'on le tue.
TENANT = """
import sys, time
sys.path.insert(0, {racine!r})
from core.verrou import Verrou
with Verrou({chemin!r}):
    print("pris", flush=True)
    time.sleep(30)
"""


class TestVerrou(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.chemin = Path(self.dossier.name) / "pepites.verrou"

    def tearDown(self):
        self.dossier.cleanup()

    def _tenant(self):
        """Lance un processus qui tient le verrou, et attend qu'il l'ait pris.

        Le nettoyage est inscrit tout de suite : un `finally` par test laissait
        le tube de sortie ouvert, et sept `ResourceWarning` traversaient le
        journal de la CI — du bruit qui finit par masquer un vrai avertissement.
        """
        processus = subprocess.Popen(
            [sys.executable, "-c",
             TENANT.format(racine=str(RACINE), chemin=str(self.chemin))],
            stdout=subprocess.PIPE, text=True,
        )
        self.addCleanup(processus.stdout.close)
        self.addCleanup(processus.wait)
        self.addCleanup(processus.kill)
        self.assertEqual(processus.stdout.readline().strip(), "pris")
        return processus

    def test_un_scan_seul_prend_le_verrou_sans_broncher(self):
        with Verrou(self.chemin):
            self.assertTrue(self.chemin.exists())

    def test_le_verrou_se_reprend_apres_un_tour_termine(self):
        # Le cas nominal d'une tâche planifiée : quinze minutes plus tard, le
        # tour suivant doit pouvoir démarrer.
        for _ in range(3):
            with Verrou(self.chemin):
                pass

    def test_un_second_scan_est_refuse_pendant_le_premier(self):
        self._tenant()
        with self.assertRaises(ScanDejaEnCours) as capture:
            with Verrou(self.chemin):
                self.fail("le second scan n'aurait pas dû démarrer")
        self.assertIn("un scan tourne déjà", str(capture.exception))

    def test_le_refus_dit_depuis_combien_de_temps_l_autre_tourne(self):
        # Sans cette durée, la ligne ne distingue pas un scan lent d'un radar
        # qui se chevauche à chaque passage — et c'est toute la différence
        # entre « rien à faire » et « l'intervalle est trop court ». En
        # secondes sous la minute : « depuis 0 min » est le cas le plus
        # fréquent, et le plus mal écrit.
        self._tenant()
        with self.assertRaises(ScanDejaEnCours) as capture:
            with Verrou(self.chemin):
                pass
        self.assertRegex(str(capture.exception), r"depuis \d+ (s|min)")

    def test_un_processus_tue_libere_le_verrou(self):
        # La raison d'être d'un flock plutôt que d'un fichier témoin : après un
        # `kill -9` ou une coupure de courant, le noyau relâche, et personne
        # n'a de fichier à effacer à la main le matin où le radar s'est tu.
        processus = self._tenant()
        processus.kill()
        processus.wait()
        with Verrou(self.chemin):
            pass                        # le verrou se reprend sans intervention

    def test_le_fichier_porte_le_pid_du_tenant(self):
        with Verrou(self.chemin):
            morceaux = self.chemin.read_text(encoding="utf-8").split()
        self.assertEqual(int(morceaux[0]), os.getpid())
        self.assertLessEqual(abs(time.time() - float(morceaux[1])), 5)

    def test_un_fichier_illisible_ne_fait_pas_tomber_le_refus(self):
        # Le message doit sortir même si l'horodatage est absent ou corrompu :
        # une panne de diagnostic ne doit pas se transformer en trace d'erreur.
        self._tenant()
        self.chemin.write_text("n'importe quoi", encoding="utf-8")
        with self.assertRaises(ScanDejaEnCours) as capture:
            with Verrou(self.chemin):
                pass
        self.assertIn("depuis un moment", str(capture.exception))


if __name__ == "__main__":
    unittest.main()
