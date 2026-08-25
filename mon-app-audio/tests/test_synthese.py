#!/usr/bin/env python3
"""Ce que la voix de synthèse doit tenir sans réseau.

La fabrication elle-même demande le service de Microsoft : elle ne se vérifie
pas hors ligne. Ce qui se vérifie, c'est la conversion des minutages — les
offsets arrivent en unités de 100 nanosecondes, et se tromper d'un facteur dix
mille décalerait tout l'alignement sans rien casser de visible.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.synchroniseur import Mot  # noqa: E402
from core.synthese import mot_depuis_bloc  # noqa: E402


class TestFrontieresDeMots(unittest.TestCase):
    def test_les_unites_de_cent_nanosecondes_deviennent_des_millisecondes(self):
        bloc = {'type': 'WordBoundary', 'offset': 12_500_000, 'duration': 3_750_000,
                'text': 'Bonjour'}
        self.assertEqual(mot_depuis_bloc(bloc), Mot('Bonjour', 1250, 375 + 1250))


if __name__ == '__main__':
    unittest.main()
