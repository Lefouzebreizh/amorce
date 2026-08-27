#!/usr/bin/env python3
"""Le traqueur de portefeuilles.

Ce skill ne vaut rien le premier jour : il fabrique sa propre base d'adresses,
scan après scan. Les deux tests qui comptent vérifient qu'il ne triche pas —
qu'un portefeuille vu une seule fois ne compte pas, et que le jeton examiné ne
figure pas dans ses propres apparitions.
"""

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from aides import candidat  # noqa: E402
from core.reglages import charger  # noqa: E402
from core.stockage import Memoire  # noqa: E402
from skills import smart_money  # noqa: E402
from sources.etherscan import NULLE  # noqa: E402

REGLAGES = charger().smart_money


class TestBonus(unittest.TestCase):
    def test_aucun_portefeuille_reconnu_ne_donne_aucun_bonus(self):
        self.assertEqual(smart_money.calculer_bonus({}, REGLAGES), 0.0)

    def test_le_bonus_plafonne(self):
        # Au-delà de trois portefeuilles, ce n'est plus un indice, c'est une
        # foule. Et un indice ne doit jamais rattraper une mauvaise note.
        foule = {f"0x{i}": 5 for i in range(20)}
        self.assertEqual(smart_money.calculer_bonus(foule, REGLAGES), REGLAGES.bonus_max)


class TestTraque(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.memoire = Memoire(Path(self.dossier.name) / "essai.sqlite3")
        self.portefeuilles = ["0xalice", "0xbob", "0xcarol"]
        # Le relevé est la seule partie qui touche au réseau : on le remplace,
        # et on le rend à la fin — sinon la substitution fuiterait sur les
        # autres suites du même processus.
        patch = mock.patch.object(
            smart_money, "_relever_portefeuilles",
            side_effect=lambda *_: list(self.portefeuilles),
        )
        self.addCleanup(patch.stop)
        patch.start()

    def tearDown(self):
        self.memoire.fermer()
        self.dossier.cleanup()

    def test_un_jeton_ne_compte_pas_dans_ses_propres_apparitions(self):
        # Sans la lecture avant écriture, chaque portefeuille paraîtrait
        # récurrent dès sa première rencontre.
        resultat = smart_money.traquer(None, candidat(), self.memoire, REGLAGES)
        self.assertEqual(resultat.portefeuilles, ())
        self.assertEqual(resultat.bonus, 0.0)

    def test_un_portefeuille_devient_interessant_apres_trois_jetons(self):
        for numero in range(REGLAGES.apparitions_min):
            self.memoire.enregistrer_acheteurs("base", f"0xjeton{numero}", ["0xalice"])
        resultat = smart_money.traquer(None, candidat(), self.memoire, REGLAGES)
        self.assertEqual(resultat.portefeuilles, ("0xalice",))
        self.assertGreater(resultat.bonus, 0.0)

    def test_les_portefeuilles_du_jeton_sont_rangés_pour_les_scans_suivants(self):
        smart_money.traquer(None, candidat(), self.memoire, REGLAGES)
        self.assertEqual(
            self.memoire.apparitions(self.portefeuilles, minimum=1),
            {"0xalice": 1, "0xbob": 1, "0xcarol": 1},
        )


class TestExclusions(unittest.TestCase):
    def test_l_adresse_nulle_est_bien_celle_des_frappes(self):
        # Sans l'écarter, le traqueur apprendrait qu'elle est précoce sur tout.
        self.assertEqual(NULLE, "0x" + "0" * 40)


if __name__ == "__main__":
    unittest.main()
