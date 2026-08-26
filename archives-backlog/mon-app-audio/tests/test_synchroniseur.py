#!/usr/bin/env python3
"""Ce que l'alignement doit tenir, vérifié sans décoder le moindre fichier.

Les tests travaillent sur des enveloppes de niveaux fabriquées à la main : c'est
exactement ce que voit `detecter_passages`, et cela rend la suite exécutable sur
une machine sans ffmpeg.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.synchroniseur import (  # noqa: E402
    Mot, Passage, aligner, detecter_passages, lire_script, mots_depuis_resultat,
    passages_depuis_mots, repartir, seuil_relatif, vers_srt,
)

PARLE, SILENCE = -12.0, -60.0


def enveloppe(*tranches: tuple[float, int]) -> list[float]:
    """Fabrique une enveloppe : (niveau, nombre de trames de 20 ms)."""
    niveaux: list[float] = []
    for niveau, trames in tranches:
        niveaux += [niveau] * trames
    return niveaux


class TestLectureDuScript(unittest.TestCase):
    def test_un_srt_perd_ses_minutages_et_garde_son_texte(self):
        srt = ('1\n00:00:01,000 --> 00:00:03,000\nPremière réplique.\n\n'
               '2\n00:00:03,000 --> 00:00:05,000\nSeconde réplique.\n')
        self.assertEqual(lire_script(srt), ['Première réplique.', 'Seconde réplique.'])

    def test_un_texte_suivi_se_coupe_aux_fins_de_phrase(self):
        self.assertEqual(
            lire_script('Il fait nuit. Personne ne bouge ! Et puis ?'),
            ['Il fait nuit.', 'Personne ne bouge !', 'Et puis ?'],
        )

    def test_une_phrase_trop_longue_se_coupe_a_un_espace(self):
        morceaux = lire_script('mot ' * 40)
        self.assertGreater(len(morceaux), 1)
        for morceau in morceaux:
            self.assertLessEqual(len(morceau), 90)


class TestDetectionDesPassages(unittest.TestCase):
    def test_une_pause_courte_ne_coupe_pas_la_replique(self):
        # 200 ms de silence au milieu : une respiration, pas une coupure.
        passages = detecter_passages(
            enveloppe((PARLE, 25), (SILENCE, 10), (PARLE, 25)), marge_ms=0)
        self.assertEqual(len(passages), 1)

    def test_un_vrai_silence_separe_deux_passages(self):
        passages = detecter_passages(
            enveloppe((PARLE, 25), (SILENCE, 40), (PARLE, 25)), marge_ms=0)
        self.assertEqual([(p.debut_ms, p.fin_ms) for p in passages],
                         [(0, 500), (1300, 1800)])

    def test_un_claquement_isole_ne_fait_pas_un_passage(self):
        passages = detecter_passages(
            enveloppe((PARLE, 2), (SILENCE, 40), (PARLE, 25)), marge_ms=0)
        self.assertEqual(len(passages), 1)
        self.assertEqual(passages[0].debut_ms, 840)

    def test_la_marge_ne_deborde_pas_du_fichier(self):
        passages = detecter_passages(enveloppe((PARLE, 10)), marge_ms=500)
        self.assertEqual((passages[0].debut_ms, passages[0].fin_ms), (0, 200))

    def test_le_seuil_suit_le_niveau_de_l_enregistrement(self):
        # Une voix qui crête à -30 dBFS : un seuil absolu à -38 dB la manquerait
        # entièrement, le seuil relatif la trouve.
        faible = enveloppe((-30.0, 25), (-70.0, 40), (-30.0, 25))
        self.assertEqual(len(detecter_passages(faible, marge_ms=0)), 2)
        self.assertAlmostEqual(seuil_relatif(faible), -56.0)


class TestRepartition(unittest.TestCase):
    def test_le_texte_se_repartit_au_prorata_des_caracteres(self):
        repliques = repartir([Passage(0, 1000)], ['aa', 'aaaa', 'aa'])
        self.assertEqual([(r.debut_ms, r.fin_ms) for r in repliques],
                         [(0, 250), (250, 750), (750, 1000)])

    def test_les_silences_ne_consomment_pas_de_texte(self):
        # Deux passages séparés par cinq secondes de silence : la seconde
        # réplique commence à la reprise de la voix, pas dans le blanc.
        repliques = repartir([Passage(0, 1000), Passage(6000, 7000)], ['aa', 'aa'])
        self.assertEqual([(r.debut_ms, r.fin_ms) for r in repliques],
                         [(0, 1000), (6000, 7000)])

    def test_plus_de_repliques_que_de_passages(self):
        repliques = repartir([Passage(0, 1000)], ['a', 'b', 'c', 'd'])
        self.assertEqual(len(repliques), 4)
        self.assertEqual(repliques[-1].fin_ms, 1000)

    def test_sans_passage_parle_il_n_y_a_rien_a_caler(self):
        self.assertEqual(repartir([], ['a']), [])
        self.assertEqual(repartir([Passage(0, 10)], []), [])


def dire(*mots: tuple[str, int, int]) -> list[Mot]:
    """Fabrique une transcription : (texte, début, fin) en millisecondes."""
    return [Mot(texte, debut, fin) for texte, debut, fin in mots]


class TestAlignementParLesMots(unittest.TestCase):
    def test_le_script_prend_le_minutage_des_mots_reconnus(self):
        repliques = aligner(
            ['Il fait nuit.', 'Personne ne bouge.'],
            dire(('Il', 0, 200), ('fait', 200, 500), ('nuit', 500, 900),
                 ('Personne', 2000, 2400), ('ne', 2400, 2600), ('bouge', 2600, 3000)),
        )
        self.assertEqual([(r.debut_ms, r.fin_ms) for r in repliques],
                         [(0, 900), (2000, 3000)])
        self.assertTrue(all(r.cale for r in repliques))

    def test_le_texte_affiche_reste_celui_du_script(self):
        # Whisper francise, invente une liaison, se trompe de nom propre : on ne
        # retient de la transcription que le temps.
        repliques = aligner(['L’Hermine appareille.'],
                            dire(('la', 0, 200), ('mine', 200, 600), ('appareille', 600, 1200)))
        self.assertEqual(repliques[0].texte, 'L’Hermine appareille.')
        self.assertTrue(repliques[0].cale)

    def test_une_elision_s_apparie_malgre_l_apostrophe(self):
        repliques = aligner(['L’hermine file.'], dire(("L'hermine", 0, 700), ('file', 700, 1000)))
        self.assertEqual((repliques[0].debut_ms, repliques[0].fin_ms), (0, 1000))

    def test_un_mot_manque_dans_la_transcription_ne_decale_pas_la_suite(self):
        repliques = aligner(
            ['Il fait nuit.', 'Personne ne bouge.'],
            dire(('Il', 0, 200), ('nuit', 500, 900),            # « fait » sauté
                 ('Personne', 2000, 2400), ('bouge', 2600, 3000)),
        )
        self.assertEqual([(r.debut_ms, r.fin_ms) for r in repliques],
                         [(0, 900), (2000, 3000)])

    def test_une_replique_jamais_reconnue_est_interpolee_et_signalee(self):
        repliques = aligner(
            ['Bonjour.', 'Inaudible.', 'Au revoir.'],
            dire(('Bonjour', 0, 500), ('Au', 3000, 3200), ('revoir', 3200, 3600)),
        )
        self.assertEqual([r.cale for r in repliques], [True, False, True])
        self.assertEqual((repliques[1].debut_ms, repliques[1].fin_ms), (500, 3000))

    def test_sans_transcription_il_n_y_a_pas_d_alignement(self):
        self.assertEqual(aligner(['Bonjour.'], []), [])
        self.assertEqual(aligner([], dire(('Bonjour', 0, 500))), [])


class TestPassagesDepuisMots(unittest.TestCase):
    def test_les_mots_enchaines_forment_un_seul_passage(self):
        passages = passages_depuis_mots(
            dire(('un', 1000, 1200), ('deux', 1250, 1500)), marge_ms=0)
        self.assertEqual([(p.debut_ms, p.fin_ms) for p in passages], [(1000, 1500)])

    def test_un_silence_franc_ouvre_un_passage(self):
        passages = passages_depuis_mots(
            dire(('un', 0, 200), ('deux', 4000, 4300)), marge_ms=0)
        self.assertEqual([(p.debut_ms, p.fin_ms) for p in passages], [(0, 200), (4000, 4300)])


class TestSortieWhisper(unittest.TestCase):
    def test_les_secondes_de_whisper_deviennent_des_millisecondes(self):
        resultat = {'segments': [
            {'words': [{'word': ' Il', 'start': 0.32, 'end': 0.58},
                       {'word': ' fait', 'start': 0.58, 'end': 0.91}]},
            {'words': [{'word': ' nuit.', 'start': 1.2, 'end': 1.64}]},
        ]}
        self.assertEqual(mots_depuis_resultat(resultat),
                         dire(('Il', 320, 580), ('fait', 580, 910), ('nuit.', 1200, 1640)))

    def test_un_segment_sans_minutage_de_mots_est_ignore(self):
        self.assertEqual(mots_depuis_resultat({'segments': [{'text': 'Il fait nuit.'}]}), [])


class TestEcritureSrt(unittest.TestCase):
    def test_le_srt_sort_au_format_attendu(self):
        srt = vers_srt(repartir([Passage(0, 3_661_000)], ['Bonjour']))
        self.assertEqual(srt.splitlines()[:3],
                         ['1', '00:00:00,000 --> 01:01:01,000', 'Bonjour'])


if __name__ == '__main__':
    unittest.main()
