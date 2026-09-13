"""La sortie redirigée d'une tâche Windows ne doit pas faire échouer le radar."""

import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


RACINE = Path(__file__).resolve().parents[1]


class ConsoleRedirigee(unittest.TestCase):
    def lancer(self, programme, encodage):
        environnement = dict(os.environ, PYTHONIOENCODING=encodage + ":strict")
        return subprocess.run(
            [sys.executable, "-c", programme], cwd=RACINE,
            env=environnement, capture_output=True, timeout=30,
        )

    def test_scan_reussi_malgre_les_symboles_non_representables(self):
        for encodage in ("cp1252", "ascii", "utf-8"):
            with self.subTest(encodage=encodage), tempfile.TemporaryDirectory() as dossier:
                programme = f'''
from types import SimpleNamespace
from unittest.mock import patch
import main
resultat = SimpleNamespace(
    bilan=SimpleNamespace(resume=lambda: "857 paires → 222 jetons 🦓"),
    secondes=1, retenues=[], alertes=[])
with patch.object(main.pipeline, "scanner", return_value=resultat), \\
     patch.object(main.rapport, "composer", return_value="rapport"), \\
     patch.object(main.rapport, "ecrire", return_value="rapport.md"):
    raise SystemExit(main.principal(["--base", {str(Path(dossier) / 'test.db')!r}, "scan"]))
'''
                resultat = self.lancer(programme, encodage)
                self.assertEqual(resultat.returncode, 0, resultat.stderr)
                sortie = resultat.stdout.decode(encodage)
                self.assertIn("Rapport : rapport.md", sortie)
                if encodage == "utf-8":
                    self.assertIn("857 paires → 222 jetons 🦓", sortie)

    def test_erreur_reseau_conserve_son_code_sur_console_ascii(self):
        resultat = self.lancer('''
from unittest.mock import patch
import main
with patch.object(main, "charger", side_effect=main.ReseauIndisponible("indisponible → réessayer")):
    raise SystemExit(main.principal(["sonde"]))
''', "ascii")
        self.assertEqual(resultat.returncode, 3, resultat.stderr)
        self.assertNotIn(b"UnicodeEncodeError", resultat.stderr)
        self.assertIn(b"indisponible", resultat.stderr)


if __name__ == "__main__":
    unittest.main()
