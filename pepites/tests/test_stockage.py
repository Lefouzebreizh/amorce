#!/usr/bin/env python3
"""La mémoire du radar.

Ce n'est pas un cache : c'est le seul endroit d'où peut venir la réponse à la
question que les API ne traitent pas — *la liquidité monte-t-elle pendant que le
volume accélère ?*
"""

import sys
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from aides import MAINTENANT, candidat  # noqa: E402
from core.stockage import Memoire  # noqa: E402
from skills.convergence import mesurer  # noqa: E402


class TestMemoire(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.memoire = Memoire(Path(self.dossier.name) / "essai.sqlite3")

    def tearDown(self):
        self.memoire.fermer()
        self.dossier.cleanup()

    def enregistrer(self, moment, note=70.0, **remplacements):
        c = candidat(**remplacements)
        self.memoire.enregistrer(c, mesurer(c), note, moment)
        return c

    def test_un_releve_se_relit_tel_qu_il_a_ete_ecrit(self):
        c = self.enregistrer(MAINTENANT, note=73.5)
        relu = self.memoire.dernier_releve(c.jeton.identite)
        self.assertEqual(relu.note, 73.5)
        self.assertEqual(relu.liquidite_usd, c.liquidite_usd)
        self.assertEqual(relu.vu_le, MAINTENANT)

    def test_le_releve_du_scan_en_cours_est_exclu_par_avant(self):
        # Sans cela, un signal se confirmerait tout seul, contre lui-même, à
        # chaque scan — et la persistance ne filtrerait plus rien.
        c = self.enregistrer(MAINTENANT - timedelta(minutes=20), note=60.0)
        self.enregistrer(MAINTENANT, note=80.0)
        precedent = self.memoire.dernier_releve(c.jeton.identite, avant=MAINTENANT)
        self.assertEqual(precedent.note, 60.0)

    def test_c_est_bien_le_plus_recent_qui_est_rendu(self):
        c = self.enregistrer(MAINTENANT - timedelta(hours=3), note=10.0)
        self.enregistrer(MAINTENANT - timedelta(minutes=12), note=64.0)
        self.assertEqual(self.memoire.dernier_releve(c.jeton.identite).note, 64.0)

    def test_un_jeton_jamais_vu_ne_rend_rien(self):
        self.assertIsNone(self.memoire.dernier_releve(("base", "0xinconnu")))

    def test_les_jetons_suivis_excluent_ceux_qui_notaient_trop_bas(self):
        # On re-relève ce qui vaut la peine d'être confirmé, pas tout ce qui a
        # traversé le radar une fois.
        self.enregistrer(MAINTENANT, note=80.0)
        suivis = self.memoire.jetons_suivis(minimum=55.0, maintenant=MAINTENANT)
        self.assertEqual(len(suivis), 1)
        self.assertEqual(
            self.memoire.jetons_suivis(minimum=90.0, maintenant=MAINTENANT), [])

    def test_la_fenetre_de_suivi_se_compte_depuis_le_scan_et_non_depuis_l_horloge(self):
        # Sans instant injecté, cette suite passait au vert le jour où elle a
        # été écrite puis au rouge quarante-huit heures plus tard, toute seule.
        # Un test qui dépend du jour où on le lance ne prouve rien deux fois.
        self.enregistrer(MAINTENANT, note=80.0)
        tard = MAINTENANT + timedelta(hours=47)
        self.assertEqual(len(self.memoire.jetons_suivis(maintenant=tard)), 1)
        trop_tard = MAINTENANT + timedelta(hours=49)
        self.assertEqual(self.memoire.jetons_suivis(maintenant=trop_tard), [])

    def test_la_purge_efface_les_vieux_releves_et_garde_les_recents(self):
        from datetime import datetime, timezone
        maintenant = datetime.now(timezone.utc)
        self.enregistrer(maintenant - timedelta(days=60))
        self.enregistrer(maintenant - timedelta(minutes=5), liquidite_usd=999)
        self.assertEqual(self.memoire.purger(garder_jours=30), 1)


class TestAlertesEtPortefeuilles(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.memoire = Memoire(Path(self.dossier.name) / "essai.sqlite3")

    def tearDown(self):
        self.memoire.fermer()
        self.dossier.cleanup()

    def test_la_derniere_alerte_tient_le_silence_par_jeton(self):
        identite = ("base", "0xpepite")
        self.assertIsNone(self.memoire.derniere_alerte(identite))
        self.memoire.noter_alerte(identite, "PEP", 78.0, MAINTENANT)
        moment, note = self.memoire.derniere_alerte(identite)
        self.assertEqual((moment, note), (MAINTENANT, 78.0))

    def test_un_portefeuille_vu_une_seule_fois_n_est_pas_rendu(self):
        # Sous le minimum, c'est une coïncidence : le suivre revient à suivre
        # les robots d'arbitrage, précoces sur absolument tout.
        self.memoire.enregistrer_acheteurs("base", "0xun", ["0xAlice", "0xBob"])
        self.memoire.enregistrer_acheteurs("base", "0xdeux", ["0xAlice"])
        self.memoire.enregistrer_acheteurs("base", "0xtrois", ["0xAlice"])
        apparitions = self.memoire.apparitions(["0xAlice", "0xBob"], minimum=3)
        self.assertEqual(apparitions, {"0xAlice": 3})

    def test_le_meme_acheteur_sur_le_meme_jeton_ne_compte_qu_une_fois(self):
        self.memoire.enregistrer_acheteurs("base", "0xun", ["0xAlice"])
        self.memoire.enregistrer_acheteurs("base", "0xun", ["0xAlice"])
        self.assertEqual(self.memoire.apparitions(["0xAlice"], minimum=1), {"0xAlice": 1})


if __name__ == "__main__":
    unittest.main()
