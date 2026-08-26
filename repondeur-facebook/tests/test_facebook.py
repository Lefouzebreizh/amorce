#!/usr/bin/env python3
"""Ce que le dépouillement d'une réponse de l'API Graph doit tenir.

Rien ici ne touche au réseau : c'est la forme de la charge utile qui change
d'une version d'API à l'autre, et c'est elle qu'on vérifie.
"""

import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.facebook import (  # noqa: E402
    ErreurGraph, ErreurQuota, Graph, extraire_commentaires,
)

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


def reponse_factice(charge, entetes=None, code=200):
    return SimpleNamespace(json=lambda: charge, headers=entetes or {},
                           status_code=code, ok=code < 400)


class TestDepouillement(unittest.TestCase):
    def setUp(self):
        self.graph = Graph('jeton', '42')

    def test_un_depassement_de_quota_est_une_erreur_a_part(self):
        # Les codes 4, 17, 32 et 613 veulent dire « stop », pas « réessaie » :
        # insister transforme une pause de minutes en blocage d'heures.
        for code in (4, 17, 32, 613):
            with self.subTest(code=code):
                charge = {'error': {'message': 'trop de requêtes', 'code': code}}
                with self.assertRaises(ErreurQuota):
                    self.graph._depouiller(reponse_factice(charge))

    def test_une_erreur_ordinaire_reste_ordinaire(self):
        charge = {'error': {'message': 'jeton expiré', 'code': 190}}
        with self.assertRaises(ErreurGraph) as capture:
            self.graph._depouiller(reponse_factice(charge))
        self.assertNotIsInstance(capture.exception, ErreurQuota)

    def test_le_quota_annonce_est_retenu_au_plus_haut(self):
        # Il sert à s'arrêter avant le mur, donc il ne redescend pas en cours
        # d'exécution : c'est le pire moment vu qui compte.
        self.graph._depouiller(reponse_factice({}, {'X-App-Usage': '{"call_count": 60}'}))
        self.graph._depouiller(reponse_factice({}, {'X-App-Usage': '{"call_count": 10}'}))
        self.assertEqual(self.graph.quota, 60.0)

    def test_une_page_html_le_dit_plutot_que_de_parler_de_jeton(self):
        # L'erreur classique : viser facebook.com au lieu de graph.facebook.com.
        illisible = SimpleNamespace(
            json=lambda: (_ for _ in ()).throw(ValueError()),
            headers={}, status_code=200, ok=True)
        with self.assertRaises(ErreurGraph) as capture:
            self.graph._depouiller(illisible)
        self.assertIn('API Graph', str(capture.exception))


if __name__ == '__main__':
    unittest.main()
