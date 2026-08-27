#!/usr/bin/env python3
"""Le comportement du client HTTP face aux pannes.

Un appel raté doit rendre `None` sans lever : si RugCheck tombe, on perd un
second avis, pas les quatre-vingt-dix autres candidats du tour. Mais quand
*plus rien* ne répond, il faut s'arrêter franchement — sinon un scan hors ligne
rend un rapport vide, qui se lit comme un marché calme.
"""

import logging
import sys
import unittest
from pathlib import Path
from unittest import mock

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.reseau import ClientHttp, ReseauIndisponible  # noqa: E402


class Reponse:
    def __init__(self, code=200, charge=None, entetes=None):
        self.status_code = code
        self._charge = charge
        self.headers = entetes or {}

    def json(self):
        if self._charge is None:
            raise ValueError("pas du JSON")
        return self._charge


def client(reponses, essais=2):
    """Client dont la session rend les réponses fournies, sans jamais dormir."""
    outil = ClientHttp({"essai": 6000.0}, essais=essais)
    outil.session = mock.Mock()
    outil.session.get.side_effect = reponses
    return outil


class TestClientHttp(unittest.TestCase):
    def setUp(self):
        patch = mock.patch("core.reseau.time.sleep")
        self.addCleanup(patch.stop)
        patch.start()
        # Ces tests provoquent exprès des pannes : leur journal n'apprendrait
        # rien et noierait la sortie de la suite.
        logging.disable(logging.CRITICAL)
        self.addCleanup(logging.disable, logging.NOTSET)

    def test_une_reponse_valide_est_rendue(self):
        outil = client([Reponse(200, {"pairs": []})])
        self.assertEqual(outil.json("essai", "https://exemple"), {"pairs": []})

    def test_un_refus_4xx_ne_est_pas_reessaye(self):
        # 404 sur un jeton inconnu est une réponse, pas une panne.
        outil = client([Reponse(404)])
        self.assertIsNone(outil.json("essai", "https://exemple"))
        self.assertEqual(outil.session.get.call_count, 1)

    def test_une_erreur_5xx_est_reessayee_puis_abandonnee(self):
        outil = client([Reponse(503), Reponse(503)])
        self.assertIsNone(outil.json("essai", "https://exemple"))
        self.assertEqual(outil.session.get.call_count, 2)

    def test_un_debit_depasse_est_reessaye_apres_la_pause_demandee(self):
        outil = client([Reponse(429, entetes={"Retry-After": "1"}), Reponse(200, {"ok": 1})])
        self.assertEqual(outil.json("essai", "https://exemple"), {"ok": 1})

    def test_une_panne_reseau_ne_leve_pas_pour_un_seul_appel(self):
        outil = client([requests.ConnectionError("coupure"), requests.ConnectionError("coupure")])
        self.assertIsNone(outil.json("essai", "https://exemple"))

    def test_cinq_points_d_entree_muets_d_affilee_arretent_le_tour(self):
        outil = client([requests.ConnectionError("coupure")] * 20)
        for _ in range(4):
            outil.json("essai", "https://exemple")
        with self.assertRaises(ReseauIndisponible):
            outil.json("essai", "https://exemple")

    def test_une_reponse_valide_remet_le_compteur_a_zero(self):
        # Un service qui hoquette n'est pas une connexion coupée.
        outil = client(
            [requests.ConnectionError("x")] * 8 + [Reponse(200, {"ok": 1})]
            + [requests.ConnectionError("x")] * 8
        )
        for _ in range(4):
            outil.json("essai", "https://exemple")
        self.assertEqual(outil.json("essai", "https://exemple"), {"ok": 1})
        for _ in range(4):
            outil.json("essai", "https://exemple")   # ne doit pas lever


if __name__ == "__main__":
    unittest.main()
