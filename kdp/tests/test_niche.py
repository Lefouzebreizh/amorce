#!/usr/bin/env python3
"""Ce que le validateur de niche doit tenir, sans réseau ni boutique.

Tout ici est du calcul. Deux choses sont vérifiées, et elles n'ont pas le même
statut :

**Les règles de verdict** sont la décision de l'utilisateur. Un test qui échoue
ici signale une régression, jamais un seuil à rediscuter.

**Le barème de la note** est le nôtre, et il se recalibre. On ne vérifie donc pas
des valeurs exactes — elles bougeront — mais les propriétés qui doivent survivre
à un recalibrage : la note reste dans ses bornes, elle monte quand la niche
s'améliore, et aucune saisie ne reste sans verdict.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from kdp_niche_validator import (  # noqa: E402
    AVIS_FAIBLE_CONCURRENCE, BSR_DEMANDE_MORTE, BSR_FORTE_DEMANDE,
    POIDS_CONCURRENCE, POIDS_DEMANDE, POIDS_RENTABILITE,
    rediger_rapport, score_niche,
)

EXCELLENTE = 'Excellente (Forte demande, faible concurrence)'
MORTE = 'Trop faible demande'


class ReglesDeVerdict(unittest.TestCase):
    """Les deux règles fournies, et les trois cas qu'elles ne couvrent pas."""

    def test_bsr_bas_et_peu_davis_donnent_une_niche_excellente(self):
        self.assertEqual(score_niche(30_000, 120, 12.99).verdict, EXCELLENTE)

    def test_un_bsr_trop_haut_disqualifie_la_niche(self):
        niche = score_niche(200_000, 12, 14.99)
        self.assertEqual(niche.verdict, MORTE)
        self.assertFalse(niche.viable)

    def test_le_bsr_prime_sur_labsence_de_concurrence(self):
        """Zéro avis sur une niche morte, c'est un désert, pas une opportunité."""
        self.assertEqual(score_niche(400_000, 0, 19.99).verdict, MORTE)

    def test_les_seuils_sont_stricts_et_non_inclusifs(self):
        """Pile sur un seuil, on ne bascule pas : la règle dit « inférieur à »."""
        self.assertNotEqual(score_niche(BSR_FORTE_DEMANDE, 10, 9.99).verdict, EXCELLENTE)
        self.assertNotEqual(
            score_niche(10_000, AVIS_FAIBLE_CONCURRENCE, 9.99).verdict, EXCELLENTE)
        self.assertNotEqual(score_niche(BSR_DEMANDE_MORTE, 10, 9.99).verdict, MORTE)

    def test_une_forte_demande_deja_servie_reste_viable(self):
        niche = score_niche(20_000, 900, 14.99)
        self.assertNotIn(niche.verdict, (EXCELLENTE, MORTE))
        self.assertTrue(niche.viable)

    def test_aucune_saisie_ne_reste_sans_verdict(self):
        """Le maillage des cinq branches doit être complet, seuils compris."""
        for bsr in (1, 4_999, BSR_FORTE_DEMANDE - 1, BSR_FORTE_DEMANDE,
                    100_000, BSR_DEMANDE_MORTE, BSR_DEMANDE_MORTE + 1, 900_000):
            for avis in (0, 1, AVIS_FAIBLE_CONCURRENCE - 1,
                         AVIS_FAIBLE_CONCURRENCE, 5_000):
                with self.subTest(bsr=bsr, avis=avis):
                    niche = score_niche(bsr, avis, 11.99)
                    self.assertTrue(niche.verdict)
                    self.assertTrue(niche.explication)
                    self.assertEqual(niche.viable, niche.verdict != MORTE)


class Bareme(unittest.TestCase):
    """Les propriétés qui doivent survivre à un recalibrage des seuils."""

    def test_la_note_reste_dans_ses_bornes(self):
        for bsr, avis, prix in ((1, 0, 14.99), (5_000_000, 90_000, 0.0),
                                (75_000, 300, 9.99)):
            with self.subTest(bsr=bsr, avis=avis, prix=prix):
                niche = score_niche(bsr, avis, prix)
                self.assertGreaterEqual(niche.note, 0.0)
                self.assertLessEqual(niche.note, POIDS_DEMANDE + POIDS_CONCURRENCE
                                     + POIDS_RENTABILITE)

    def test_un_meilleur_rang_ne_note_jamais_moins_bien(self):
        rangs = [1_000, 5_000, 20_000, 50_000, 150_000, 300_000, 800_000]
        notes = [score_niche(rang, 100, 12.99).note_demande for rang in rangs]
        self.assertEqual(notes, sorted(notes, reverse=True))

    def test_plus_davis_ne_note_jamais_mieux(self):
        comptes = [0, 20, 100, 300, 1_000, 4_000]
        notes = [score_niche(30_000, avis, 12.99).note_concurrence for avis in comptes]
        self.assertEqual(notes, sorted(notes, reverse=True))

    def test_le_prix_a_un_palier_confortable_et_deux_versants(self):
        """Trop bas la marge manque, trop haut la conversion s'effondre."""
        palier = score_niche(30_000, 50, 12.99).note_rentabilite
        self.assertEqual(palier, POIDS_RENTABILITE)
        self.assertLess(score_niche(30_000, 50, 3.99).note_rentabilite, palier)
        self.assertLess(score_niche(30_000, 50, 39.99).note_rentabilite, palier)

    def test_les_notes_extremes_sont_bien_atteintes(self):
        pleine = score_niche(1_000, 5, 12.99)
        self.assertEqual(pleine.note_demande, POIDS_DEMANDE)
        self.assertEqual(pleine.note_concurrence, POIDS_CONCURRENCE)
        nulle = score_niche(900_000, 50_000, 0.0)
        self.assertEqual(nulle.note_demande, 0.0)
        self.assertEqual(nulle.note_concurrence, 0.0)
        self.assertEqual(nulle.note_rentabilite, 0.0)

    def test_zero_avis_et_un_avis_se_valent(self):
        """Personne n'a parlé : le logarithme n'a pas à trancher entre les deux."""
        self.assertEqual(score_niche(30_000, 0, 9.99).note_concurrence,
                         score_niche(30_000, 1, 9.99).note_concurrence)


class SaisiesInvalides(unittest.TestCase):
    def test_un_rang_nul_ou_negatif_est_refuse(self):
        for bsr in (0, -1):
            with self.subTest(bsr=bsr), self.assertRaises(ValueError):
                score_niche(bsr, 10, 9.99)

    def test_des_avis_ou_un_prix_negatifs_sont_refuses(self):
        with self.assertRaises(ValueError):
            score_niche(30_000, -1, 9.99)
        with self.assertRaises(ValueError):
            score_niche(30_000, 10, -0.01)


class Rapport(unittest.TestCase):
    def test_le_rapport_porte_le_verdict_le_mot_cle_et_les_chiffres(self):
        niche = score_niche(38_000, 120, 12.99)
        texte = rediger_rapport(niche, 'carnet de gratitude', jour='2026-01-01')
        self.assertIn('carnet de gratitude', texte)
        self.assertIn(EXCELLENTE, texte)
        self.assertIn('12,99', texte)
        self.assertIn('2026-01-01', texte)
        for conseil in niche.recommandations:
            self.assertIn(conseil, texte)

    def test_le_rapport_dit_ce_quil_ne_couvre_pas(self):
        """Un rapport qui se présenterait comme suffisant serait un piège."""
        texte = rediger_rapport(score_niche(30_000, 50, 9.99), 'essai',
                                jour='2026-01-01')
        self.assertIn('Ce que ce rapport ne dit pas', texte)
        self.assertIn('saisonnalité', texte.lower())

    def test_le_rapport_est_le_meme_a_saisie_egale(self):
        niche = score_niche(30_000, 50, 9.99)
        self.assertEqual(rediger_rapport(niche, 'essai', jour='2026-01-01'),
                         rediger_rapport(niche, 'essai', jour='2026-01-01'))

    def test_la_devise_traverse_le_rapport(self):
        texte = rediger_rapport(score_niche(30_000, 50, 9.99), 'essai',
                                devise='$', jour='2026-01-01')
        self.assertIn('$', texte)
        self.assertNotIn('€', texte)


if __name__ == '__main__':
    unittest.main()
