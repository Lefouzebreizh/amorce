#!/usr/bin/env python3
"""Le client HTTP : reprise, limiteur, typage des erreurs.

Aucun de ces tests n'ouvre une connexion. Ils éprouvent la logique de reprise et
le limiteur de débit avec une fonction de sommeil injectée — c'est aussi la
raison pour laquelle `dormir` est un paramètre du constructeur plutôt qu'un
appel direct à `asyncio.sleep`.
"""

import unittest

from aides import config

from src.core.reseau import (
    ClientHTTP, ErreurDebit, ErreurPermanente, ErreurTemporaire, Limiteur, rassembler,
)


class TestErreurs(unittest.TestCase):
    def test_hierarchie(self):
        """Un `except ErreurTemporaire` doit attraper un dépassement de débit :
        c'est le seul moyen d'écrire une reprise qui les traite ensemble."""

        self.assertTrue(issubclass(ErreurDebit, ErreurTemporaire))
        self.assertFalse(issubclass(ErreurPermanente, ErreurTemporaire))

    def test_le_debit_porte_l_attente_imposee(self):
        """Un serveur qui dit « reviens dans 30 s » et qu'on rappelle à 2 s
        bannit l'adresse."""

        self.assertEqual(ErreurDebit("trop vite", 30.0).attendre_secondes, 30.0)


class TestLimiteur(unittest.IsolatedAsyncioTestCase):
    async def test_il_attend_quand_le_seau_est_vide(self):
        sommeils: list[float] = []

        async def dormir(secondes):
            sommeils.append(secondes)
            # Vider le seau simule l'écoulement de la fenêtre d'une minute.
            limiteur._horodatages.clear()

        limiteur = Limiteur(requetes_par_minute=2)
        for _ in range(3):
            await limiteur.attendre_son_tour(dormir)
        self.assertEqual(len(sommeils), 1)


class ClientSansReseau(ClientHTTP):
    """Un client dont seul l'appel élémentaire est remplacé : toute la logique
    de reprise, de repli exponentiel et de comptage d'échecs reste celle de
    production."""

    def __init__(self, reponses, **arguments):
        super().__init__(**arguments)
        self.reponses = list(reponses)
        self.appels = 0

    async def ouvrir(self):
        return None

    async def _une_fois(self, url, params, entetes, corps, format):
        self.appels += 1
        reponse = self.reponses.pop(0)
        if isinstance(reponse, Exception):
            raise reponse
        return reponse


class TestReprise(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.sommeils: list[float] = []

        async def dormir(secondes):
            self.sommeils.append(secondes)

        self.dormir = dormir
        self.config = config().reseau

    async def test_une_erreur_temporaire_est_reessayee(self):
        client = ClientSansReseau(
            [ErreurTemporaire("503"), {"ok": True}],
            config=self.config, dormir=self.dormir,
        )
        self.assertEqual(await client.json("https://x"), {"ok": True})
        self.assertEqual(client.appels, 2)
        self.assertEqual(client.echecs_consecutifs, 0)

    async def test_une_erreur_permanente_n_est_pas_reessayee(self):
        """Réessayer un 404 ne fait que brûler du quota et retarder le moment où
        l'on saura que la source est perdue."""

        client = ClientSansReseau(
            [ErreurPermanente("404"), {"ok": True}],
            config=self.config, dormir=self.dormir,
        )
        with self.assertRaises(ErreurPermanente):
            await client.json("https://x")
        self.assertEqual(client.appels, 1)

    async def test_le_repli_est_exponentiel(self):
        client = ClientSansReseau(
            [ErreurTemporaire("1"), ErreurTemporaire("2"), {"ok": True}],
            config=self.config, dormir=self.dormir,
        )
        await client.json("https://x")
        self.assertEqual(len(self.sommeils), 2)
        self.assertGreater(self.sommeils[1], self.sommeils[0])

    async def test_l_attente_imposee_par_le_serveur_prime(self):
        client = ClientSansReseau(
            [ErreurDebit("429", 30.0), {"ok": True}],
            config=self.config, dormir=self.dormir,
        )
        await client.json("https://x")
        self.assertEqual(self.sommeils, [30.0])

    async def test_epuisement_des_tentatives(self):
        client = ClientSansReseau(
            [ErreurTemporaire("boum")] * self.config.tentatives,
            config=self.config, dormir=self.dormir,
        )
        with self.assertRaises(ErreurTemporaire):
            await client.json("https://x")
        self.assertEqual(client.appels, self.config.tentatives)
        self.assertEqual(client.echecs_consecutifs, 1)


class TestRassembler(unittest.IsolatedAsyncioTestCase):
    async def test_une_panne_n_annule_pas_les_autres(self):
        """Sans `return_exceptions`, la première source morte annule les quatre
        autres, déjà à moitié téléchargées."""

        async def reussir():
            return 42

        async def echouer():
            raise ErreurTemporaire("morte")

        reussites, pannes = await rassembler({"a": reussir(), "b": echouer()})
        self.assertEqual(reussites, {"a": 42})
        self.assertIn("b", pannes)


if __name__ == "__main__":
    unittest.main()
