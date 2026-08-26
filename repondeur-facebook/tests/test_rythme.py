#!/usr/bin/env python3
"""Ce que le rythme doit tenir.

Le vrai risque du projet n'est pas le bannissement mais la mise en pause par
Facebook, et le signalement pour spam par les membres. Ces quatre fonctions
sont ce qui sépare une aide d'un robot ; elles sont pures, donc vérifiables.
"""

import sys
import unittest
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core import rythme  # noqa: E402


class TestPause(unittest.TestCase):
    def test_la_pause_est_tiree_au_hasard_dans_ses_bornes(self):
        # Un délai fixe produit des horodatages espacés à la milliseconde près :
        # une signature aussi nette qu'une empreinte.
        tirages = {round(rythme.pause(), 6) for _ in range(50)}
        self.assertGreater(len(tirages), 40)
        for valeur in tirages:
            self.assertGreaterEqual(valeur, rythme.PAUSE_MIN_S)
            self.assertLessEqual(valeur, rythme.PAUSE_MAX_S)


class TestHeures(unittest.TestCase):
    def test_l_apres_midi_est_une_heure_humaine(self):
        self.assertTrue(rythme.heure_ouvrable(datetime(2026, 8, 26, 15, 0)))

    def test_quatre_heures_du_matin_n_en_est_pas_une(self):
        # Un compte qui répond à 4 h tous les jours ne dort jamais.
        self.assertFalse(rythme.heure_ouvrable(datetime(2026, 8, 26, 4, 0)))

    def test_les_bornes_sont_le_reveil_et_le_coucher(self):
        self.assertTrue(rythme.heure_ouvrable(datetime(2026, 8, 26, rythme.HEURE_REVEIL, 0)))
        self.assertFalse(rythme.heure_ouvrable(datetime(2026, 8, 26, rythme.HEURE_COUCHER, 0)))


class TestPlafonds(unittest.TestCase):
    def test_le_plafond_d_execution_s_applique_quand_la_journee_est_vide(self):
        self.assertEqual(rythme.reste_a_faire(5, 0), 5)

    def test_le_plafond_du_jour_l_emporte_en_fin_de_journee(self):
        # Sans ce second plafond, trois lancements dans la même heure font
        # sauter le premier.
        self.assertEqual(rythme.reste_a_faire(5, rythme.PLAFOND_JOUR - 2), 2)

    def test_un_plafond_deja_depasse_ne_rend_pas_un_nombre_negatif(self):
        self.assertEqual(rythme.reste_a_faire(5, rythme.PLAFOND_JOUR + 10), 0)


class TestQuota(unittest.TestCase):
    def test_le_pire_des_trois_compteurs_decide(self):
        # C'est celui-là qui touchera le plafond en premier.
        entetes = {'X-App-Usage': '{"call_count": 12, "total_time": 80, "total_cputime": 5}'}
        self.assertEqual(rythme.quota_consomme(entetes), 80.0)

    def test_un_en_tete_absent_ne_declenche_pas_d_arret(self):
        # Ne pas savoir n'est pas une raison de s'arrêter, seulement de ne pas
        # se croire renseigné.
        self.assertEqual(rythme.quota_consomme({}), 0.0)

    def test_un_en_tete_illisible_est_ignore(self):
        self.assertEqual(rythme.quota_consomme({'X-App-Usage': 'pas du json'}), 0.0)

    def test_la_casse_de_l_en_tete_n_a_pas_d_importance(self):
        self.assertEqual(rythme.quota_consomme({'x-app-usage': '{"call_count": 42}'}), 42.0)


if __name__ == '__main__':
    unittest.main()
