#!/usr/bin/env python3
"""Ce que le courriel de fin doit dire.

Rien n'est envoyé : seule la mise en forme du bilan est vérifiable hors réseau,
et c'est elle qui décide si le message sera ouvert ou pas.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.alerte import rediger_bilan  # noqa: E402


class TestBilan(unittest.TestCase):
    def test_le_sujet_porte_le_nombre_de_commentaires_a_reprendre(self):
        # C'est le chiffre qui décide s'il faut ouvrir le message.
        sujet, _ = rediger_bilan([('Marie', 'Merci !')], [('Luc', 'un deuil')], [], True)
        self.assertIn('1 répondu,', sujet)
        self.assertIn('1 pour toi', sujet)

    def test_ce_qui_revient_a_l_humain_est_en_tete(self):
        _, corps = rediger_bilan([('Marie', 'Merci !')], [('Luc', 'un deuil')], [], True)
        self.assertLess(corps.index('Luc'), corps.index('Marie'))

    def test_la_simulation_se_dit_dans_le_sujet(self):
        sujet, corps = rediger_bilan([('Marie', 'Merci !')], [], [], False)
        self.assertIn('[simulation]', sujet)
        self.assertIn('simulation', corps)

    def test_un_echec_est_rapporte_avec_son_motif(self):
        _, corps = rediger_bilan([], [], [('Marie', 'envoi : jeton expiré')], True)
        self.assertIn('jeton expiré', corps)

    def test_une_execution_sans_rien_a_faire_le_dit(self):
        _, corps = rediger_bilan([], [], [], True)
        self.assertIn('Aucun nouveau commentaire', corps)


if __name__ == '__main__':
    unittest.main()
