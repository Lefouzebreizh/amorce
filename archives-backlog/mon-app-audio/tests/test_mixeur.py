#!/usr/bin/env python3
"""Ce que le mixage doit tenir.

Le plan d'atténuation est vérifié seul, sans son : c'est là que se joue la
baisse du fond sous la voix, et c'est du calcul d'intervalles. Le reste du
module (recollage des tranches, normalisation) est vérifié sur un signal
synthétisé, sans jamais toucher au disque.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.mixeur import (  # noqa: E402
    Bruitage, Reglages, attenuer, caler, mixer, plan_attenuation,
)
from core.synchroniseur import Passage  # noqa: E402

from pydub import AudioSegment  # noqa: E402
from pydub.generators import Sine, WhiteNoise  # noqa: E402


def son(duree_ms: int, dbfs: float = -20.0) -> AudioSegment:
    return Sine(440).to_audio_segment(duration=duree_ms).set_channels(2).apply_gain(
        dbfs - Sine(440).to_audio_segment(duration=10).dBFS)


class TestPlanAttenuation(unittest.TestCase):
    def test_deux_passages_rapproches_ne_font_qu_un_intervalle(self):
        # Laisser la musique remonter entre deux phrases s'entend comme une pompe.
        plan = plan_attenuation([Passage(0, 1000), Passage(1200, 2000)], 5000, marge_ms=200)
        self.assertEqual(plan, [(0, 2200)])

    def test_deux_passages_eloignes_gardent_leur_intervalle(self):
        plan = plan_attenuation([Passage(0, 1000), Passage(4000, 5000)], 9000, marge_ms=200)
        self.assertEqual(plan, [(0, 1200), (3800, 5200)])

    def test_la_marge_reste_dans_les_bornes_du_fond(self):
        plan = plan_attenuation([Passage(100, 900)], 1000, marge_ms=500)
        self.assertEqual(plan, [(0, 1000)])

    def test_sans_passage_il_n_y_a_rien_a_baisser(self):
        self.assertEqual(plan_attenuation([], 5000), [])


class TestAttenuation(unittest.TestCase):
    def test_le_fond_baisse_pendant_la_parole_et_pas_ailleurs(self):
        fond = WhiteNoise().to_audio_segment(duration=6000).set_channels(2)
        baisse = attenuer(fond, [(2000, 4000)], -12.0, fondu_ms=150)

        self.assertEqual(len(baisse), len(fond))
        self.assertAlmostEqual(baisse[2500:3500].dBFS, fond[2500:3500].dBFS - 12, delta=0.5)
        self.assertAlmostEqual(baisse[:1500].dBFS, fond[:1500].dBFS, delta=0.5)
        self.assertAlmostEqual(baisse[5000:].dBFS, fond[5000:].dBFS, delta=0.5)

    def test_sans_intervalle_le_fond_ressort_intact(self):
        fond = WhiteNoise().to_audio_segment(duration=1000).set_channels(2)
        self.assertEqual(attenuer(fond, [], -12.0).raw_data, fond.raw_data)


class TestCalage(unittest.TestCase):
    def test_une_musique_trop_courte_est_bouclee(self):
        self.assertEqual(len(caler(son(500), 2000)), 2000)

    def test_une_musique_trop_longue_est_coupee_en_fondu(self):
        cale = caler(son(4000), 2000, fondu_ms=1000)
        self.assertEqual(len(cale), 2000)
        self.assertLess(cale[-100:].dBFS, cale[:100].dBFS - 10)


class TestMixage(unittest.TestCase):
    def test_la_voix_donne_la_duree_du_montage(self):
        mixage = mixer(son(3000), [Bruitage('clic', son(200), position_ms=500)])
        self.assertEqual(len(mixage), 3000)

    def test_un_bruitage_pose_sur_la_chute_allonge_le_montage(self):
        # Sinon le dernier impact, celui qui ferme la séquence, disparaîtrait.
        mixage = mixer(son(3000), [Bruitage('gong', son(1000), position_ms=2800)])
        self.assertEqual(len(mixage), 3800)

    def test_le_mixage_sort_sous_la_crete_visee(self):
        mixage = mixer(son(1000, dbfs=-3.0), musique=son(1000, dbfs=-3.0),
                       reglages=Reglages(crete_visee_dbfs=-1.0))
        self.assertLessEqual(mixage.max_dBFS, -0.9)


if __name__ == '__main__':
    unittest.main()
