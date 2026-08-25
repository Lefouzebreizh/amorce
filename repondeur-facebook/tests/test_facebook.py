#!/usr/bin/env python3
"""Ce que le dépouillement d'une réponse de l'API Graph doit tenir.

Rien ici ne touche au réseau : c'est la forme de la charge utile qui change
d'une version d'API à l'autre, et c'est elle qu'on vérifie.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.facebook import extraire_commentaires  # noqa: E402

NOUS = '100'


def charge(*commentaires):
    return {'data': [{'id': 'p1', 'comments': {'data': list(commentaires)}}]}


def commentaire(id_, texte='Bravo pour ce partage', auteur_id='200',
                nom='Marie', reponses=()):
    return {
        'id': id_,
        'message': texte,
        'created_time': '2026-08-20T10:00:00+0000',
        'from': {'id': auteur_id, 'name': nom},
        'comments': {'data': [{'from': {'id': r}} for r in reponses]},
    }


class TestExtraction(unittest.TestCase):
    def test_un_commentaire_de_membre_ressort_avec_son_auteur(self):
        [c] = extraire_commentaires(charge(commentaire('c1')), NOUS)
        self.assertEqual((c.id, c.auteur, c.texte), ('c1', 'Marie', 'Bravo pour ce partage'))
        self.assertFalse(c.de_nous)
        self.assertFalse(c.deja_repondu)

    def test_un_commentaire_sans_texte_est_ignore(self):
        # Un autocollant ou une photo seuls : il n'y a rien à quoi répondre.
        sans_texte = {'id': 'c2', 'from': {'id': '200', 'name': 'Marie'}}
        self.assertEqual(extraire_commentaires(charge(sans_texte), NOUS), [])

    def test_notre_propre_commentaire_est_reconnu(self):
        [c] = extraire_commentaires(charge(commentaire('c3', auteur_id=NOUS)), NOUS)
        self.assertTrue(c.de_nous)

    def test_un_commentaire_deja_repondu_par_nous_est_marque(self):
        # Sans cela, la première exécution répondrait à tout l'historique déjà
        # traité à la main : le journal local est vide, mais Facebook se souvient.
        [c] = extraire_commentaires(charge(commentaire('c4', reponses=[NOUS])), NOUS)
        self.assertTrue(c.deja_repondu)

    def test_une_reponse_d_un_autre_membre_ne_compte_pas(self):
        [c] = extraire_commentaires(charge(commentaire('c5', reponses=['999'])), NOUS)
        self.assertFalse(c.deja_repondu)

    def test_sans_identite_connue_rien_n_est_ecarte_a_tort(self):
        # Identité introuvable : on préfère un doublon signalé à un commentaire
        # écarté sur une comparaison avec None.
        [c] = extraire_commentaires(charge(commentaire('c6', reponses=[NOUS])), None)
        self.assertFalse(c.de_nous)
        self.assertFalse(c.deja_repondu)

    def test_un_auteur_masque_ne_fait_pas_tomber_l_extraction(self):
        # L'API masque l'auteur quand la permission manque : le commentaire
        # existe quand même, et mérite une réponse.
        anonyme = {'id': 'c7', 'message': 'Merci !', 'created_time': '2026-08-20T10:00:00+0000'}
        [c] = extraire_commentaires(charge(anonyme), NOUS)
        self.assertEqual(c.auteur, 'Anonyme')


if __name__ == '__main__':
    unittest.main()
