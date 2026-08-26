#!/usr/bin/env python3
"""Ce que la notification doit dire, et surtout ce qu'elle ne doit pas dire.

Rien n'est envoyé : seule la mise en forme du bilan est vérifiable hors réseau,
et c'est elle qui décide si la notification sera ouverte — ou si elle exposera
quelque chose sur un écran de verrouillage.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.alerte import Sonnette, rediger_bilan  # noqa: E402


class TestBilan(unittest.TestCase):
    def test_le_titre_porte_ce_qui_attend_une_reponse(self):
        # C'est le seul chiffre qui décide si on ouvre la notification.
        titre, _, _ = rediger_bilan([('Marie', 'Merci !')], ['Ana'],
                                    [('Luc', 'un deuil')], [], True)
        self.assertIn('1 commentaire t’attend', titre)

    def test_sans_rien_pour_toi_le_titre_le_dit(self):
        titre, _, prioritaire = rediger_bilan([('Marie', 'Merci !')], [], [], [], True)
        self.assertIn('Rien pour toi', titre)
        self.assertFalse(prioritaire)

    def test_ce_qui_t_attend_passe_en_priorite_haute(self):
        # La priorité haute perce le mode silencieux : elle est réservée à ça,
        # sinon elle ne veut plus rien dire.
        _, _, prioritaire = rediger_bilan([], [], [('Luc', 'un deuil')], [], True)
        self.assertTrue(prioritaire)

    def test_la_raison_ne_sort_jamais_dans_la_notification(self):
        # Une notification s'affiche sur un écran verrouillé, dans le métro.
        # Le prénom suffit à savoir qu'il y a à faire ; le reste attend l'écran.
        titre, corps, _ = rediger_bilan([], [], [('Luc', 'sa mère est décédée')], [], True)
        self.assertIn('Luc', corps)
        self.assertNotIn('décédée', corps + titre)

    def test_le_texte_des_reponses_ne_sort_pas_non_plus(self):
        _, corps, _ = rediger_bilan([('Marie', 'Merci Marie, ça me touche !')],
                                    [], [], [], True)
        self.assertNotIn('ça me touche', corps)
        self.assertIn('1 réponse', corps)

    def test_les_reactions_sont_comptees_et_non_listees(self):
        # C'est le cas courant : une notification qui déroule vingt prénoms ne
        # se lit plus, et ces vingt-là n'appellent aucune action.
        _, corps, _ = rediger_bilan([], ['Ana', 'Bob', 'Chloé'], [], [], True)
        self.assertIn('3 réactions', corps)
        self.assertNotIn('Chloé', corps)

    def test_les_deux_gestes_se_lisent_sur_une_ligne(self):
        _, corps, _ = rediger_bilan([('Marie', 'Merci !')], ['Ana', 'Bob'], [], [], True)
        self.assertIn('2 réactions, 1 réponse', corps)

    def test_la_simulation_se_dit(self):
        titre, corps, _ = rediger_bilan([('Marie', 'Merci !')], [], [], [], False)
        self.assertIn('simulation', titre)
        self.assertIn('rien n’a été envoyé', corps)

    def test_un_echec_renvoie_au_journal(self):
        _, corps, _ = rediger_bilan([], [], [], [('Marie', 'jeton expiré')], True)
        self.assertIn('1 échec', corps)


class TestSonnette(unittest.TestCase):
    def test_sans_sujet_configure_il_n_y_a_pas_de_sonnette(self):
        # L'alerte est facultative : le script doit tourner sans.
        self.assertIsNone(Sonnette.depuis_environnement())

    def test_le_serveur_par_defaut_est_le_service_public(self):
        self.assertEqual(Sonnette(sujet='x').serveur, 'https://ntfy.sh')


if __name__ == '__main__':
    unittest.main()
