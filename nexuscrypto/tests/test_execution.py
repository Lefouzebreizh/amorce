#!/usr/bin/env python3
"""Le courtier papier et le gestionnaire d'ordres.

Le cœur du fichier est la **fidélité de la simulation**. Un simulateur qui
exécute au prix affiché, sans frais ni glissement, produit une courbe qui sert
ensuite à régler des seuils — et ces seuils sont alors réglés sur une fiction.
Les trois tests de glissement, de frais et d'exécution partielle gardent
exactement ça.
"""

import unittest

from aides import MAINTENANT, carnet, config, portefeuille, position

from src.core.modeles import (
    Action, Decision, Ordre, Score, Sens, TypeOrdre,
)
from src.execution.courtier import CourtierPapier, OrdreRefuse
from src.execution.gestionnaire import Gestionnaire
from src.risk_management import coupe_circuit as cc


def decision(action=Action.ACHETER, montant=1000.0, prix=100.0, actif="BTC/USDT"):
    return Decision(
        actif=actif, action=action, montant_usd=montant,
        score=Score(total=70.0, technique=70.0, sentiment=70.0, onchain=70.0),
        prix_reference=prix, raisons=("test",),
    )


class TestCourtierPapier(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.config = config().execution
        self.courtier = CourtierPapier(self.config, horloge=lambda: MAINTENANT)

    def _ordre(self, sens=Sens.ACHAT, quantite=1.0, type_ordre=TypeOrdre.MARCHE, limite=None):
        return Ordre("id", "BTC/USDT", sens, type_ordre, quantite, prix_limite=limite)

    async def test_les_frais_sont_preleves(self):
        execution = await self.courtier.passer(self._ordre(), prix_reference=100.0)
        self.assertGreater(execution.frais_usd, 0.0)
        self.assertAlmostEqual(
            execution.frais_usd,
            execution.montant_usd * self.config.simulation.frais_taker,
            places=8,
        )

    async def test_un_achat_paie_plus_cher_que_le_prix_affiche(self):
        execution = await self.courtier.passer(self._ordre(), prix_reference=100.0)
        self.assertGreater(execution.prix_execute, 100.0)
        self.assertGreater(execution.glissement, 0.0)

    async def test_une_vente_encaisse_moins_que_le_prix_affiche(self):
        execution = await self.courtier.passer(
            self._ordre(sens=Sens.VENTE), prix_reference=100.0
        )
        self.assertLess(execution.prix_execute, 100.0)
        # Le glissement est signé « défavorable » dans les deux sens : positif
        # veut toujours dire « moins bien que prévu ».
        self.assertGreater(execution.glissement, 0.0)

    async def test_le_carnet_est_parcouru_ligne_par_ligne(self):
        """Un ordre qui dépasse la première ligne paie la deuxième."""

        livre = carnet(milieu=100.0, taille=1.0, lignes=5, pas=0.01)
        petit = await self.courtier.passer(
            self._ordre(quantite=0.5), prix_reference=100.0, carnet=livre
        )
        gros = await self.courtier.passer(
            self._ordre(quantite=0.5), prix_reference=100.0, carnet=livre
        )
        self.assertAlmostEqual(petit.prix_execute, 101.0, places=6)
        self.assertAlmostEqual(gros.prix_execute, 101.0, places=6)

    async def test_execution_partielle_au_dela_de_la_part_du_carnet(self):
        """Sur une pépite, un ordre de 500 $ peut ne se remplir qu'à moitié —
        et une simulation qui l'ignore promet des positions qu'on ne pourra pas
        prendre."""

        livre = carnet(milieu=100.0, taille=1.0, lignes=5, pas=0.001)
        execution = await self.courtier.passer(
            self._ordre(quantite=4.0), prix_reference=100.0, carnet=livre
        )
        self.assertLess(execution.quantite_executee, 4.0)
        self.assertAlmostEqual(execution.quantite_executee, 0.5, places=6)

    async def test_glissement_excessif_annule_l_ordre(self):
        """Mieux vaut ne pas passer que passer à n'importe quel prix."""

        livre = carnet(milieu=100.0, taille=100.0, lignes=2, pas=0.05)
        with self.assertRaises(OrdreRefuse):
            await self.courtier.passer(
                self._ordre(quantite=1.0), prix_reference=100.0, carnet=livre
            )

    async def test_ordre_limite_refuse_au_dela_de_sa_limite(self):
        with self.assertRaises(OrdreRefuse):
            await self.courtier.passer(
                self._ordre(type_ordre=TypeOrdre.LIMITE, limite=99.0), prix_reference=100.0
            )

    async def test_carnet_vide_du_bon_cote(self):
        from src.core.modeles import CarnetOrdres

        vide = CarnetOrdres("BTC/USDT", ((99.0, 1.0),), (), MAINTENANT)
        with self.assertRaises(OrdreRefuse):
            await self.courtier.passer(self._ordre(), prix_reference=100.0, carnet=vide)

    async def test_prix_de_reference_invalide(self):
        with self.assertRaises(OrdreRefuse):
            await self.courtier.passer(self._ordre(), prix_reference=0.0)


class TestGestionnaire(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.config = config()
        self.courtier = CourtierPapier(self.config.execution, horloge=lambda: MAINTENANT)
        self.disjoncteur = cc.depuis_config(
            self.config.risque.coupe_circuit, 10_000.0, MAINTENANT
        )
        self.gestionnaire = Gestionnaire(self.config, self.courtier, self.disjoncteur)
        self.prix = {"BTC/USDT": 100.0}

    async def test_achat_nominal(self):
        resultat = await self.gestionnaire.acheter(
            decision(), portefeuille(liquidites=10_000.0), prix=self.prix, stop=90.0
        )
        self.assertTrue(resultat.accepte)
        self.assertIn("BTC/USDT", resultat.portefeuille.positions)
        self.assertLess(resultat.portefeuille.liquidites_usd, 10_000.0)

    async def test_le_coupe_circuit_bloque_les_achats(self):
        self.disjoncteur.observer(maintenant=MAINTENANT, valeur_portefeuille=9_000.0)
        resultat = await self.gestionnaire.acheter(
            decision(), portefeuille(liquidites=10_000.0), prix=self.prix, stop=90.0
        )
        self.assertFalse(resultat.accepte)
        self.assertIn("coupe-circuit", resultat.motif)

    async def test_le_coupe_circuit_ne_bloque_jamais_une_vente(self):
        """Une sortie de secours verrouillée est un piège."""

        self.disjoncteur.observer(maintenant=MAINTENANT, valeur_portefeuille=9_000.0)
        pfl = portefeuille(
            liquidites=0.0, positions={"BTC/USDT": position(quantite=1.0, prix_moyen=100.0)}
        )
        resultat = await self.gestionnaire.vendre(
            "BTC/USDT", 1.0, pfl, prix_reference=100.0, motif="stop touché"
        )
        self.assertTrue(resultat.accepte)
        self.assertNotIn("BTC/USDT", resultat.portefeuille.positions)

    async def test_un_refus_n_est_pas_une_exception(self):
        """Les faire remonter en exceptions obligerait chaque appelant à les
        rattraper pour continuer la boucle, et l'un d'eux ne le ferait pas."""

        resultat = await self.gestionnaire.acheter(
            decision(montant=5.0), portefeuille(liquidites=10.0), prix=self.prix, stop=None
        )
        self.assertFalse(resultat.accepte)
        self.assertIsNone(resultat.execution)
        self.assertEqual(resultat.portefeuille.liquidites_usd, 10.0)

    async def test_une_action_qui_n_achete_pas_est_ecartee(self):
        resultat = await self.gestionnaire.acheter(
            decision(action=Action.TEMPORISER), portefeuille(), prix=self.prix
        )
        self.assertFalse(resultat.accepte)

    async def test_les_executions_sont_conservees(self):
        pfl = portefeuille(liquidites=10_000.0)
        for _ in range(3):
            resultat = await self.gestionnaire.acheter(
                decision(montant=200.0), pfl, prix=self.prix, stop=90.0
            )
            pfl = resultat.portefeuille
        self.assertEqual(len(self.gestionnaire.executions), 3)
        self.assertAlmostEqual(pfl.positions["BTC/USDT"].quantite, 6.0, places=1)


if __name__ == "__main__":
    unittest.main()
