#!/usr/bin/env python3
"""Une passe complète, de bout en bout, sans réseau.

C'est le test qui dit si les six modules s'emboîtent. Les tests unitaires
gardent chacun sa règle ; celui-ci garde qu'une décision devient un ordre, que
l'ordre devient une position, et que la position redescend dans le
récapitulatif. Une seule pièce mal branchée et rien de tout cela n'arrive —
sans qu'aucun test unitaire ne rougisse.
"""

import io
import unittest
from contextlib import redirect_stdout
from datetime import timedelta

from aides import MAINTENANT, carnet, config, serie
from test_ingestion import MarcheFactice

from src.core.modeles import Mode
from src.data_engine.agregateur import Agregateur
from src.execution.courtier import CourtierPapier
from src.notifications.canaux import CanalConsole, Notificateur
from src.orchestrateur import Orchestrateur


class TestPasseComplete(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.config = config()
        # Une tendance longuement baissière puis un marché en peur : le cas où
        # le DCA dynamique doit acheter, et acheter plus que d'habitude.
        marches = {
            plateforme: MarcheFactice(
                serie(nombre=260, depart=300.0, pente=-0.4), carnet(milieu=196.0, taille=50.0)
            )
            for plateforme in ("binance", "bybit", "hyperliquid")
        }
        self.orchestrateur = Orchestrateur(
            self.config,
            agregateur=Agregateur(marches=marches, marche_defaut="binance"),
            courtier=CourtierPapier(self.config.execution, horloge=lambda: MAINTENANT),
            notificateur=Notificateur(canaux=[CanalConsole()]),
        )

    async def _passe(self, quand=None):
        with redirect_stdout(io.StringIO()) as sortie:
            analyses = await self.orchestrateur.une_passe(quand or MAINTENANT)
        return analyses, sortie.getvalue()

    async def test_la_passe_couvre_tous_les_actifs(self):
        analyses, _ = await self._passe()
        self.assertEqual(
            {a.decision.actif for a in analyses}, set(self.config.portefeuille.symboles)
        )

    async def test_une_decision_devient_une_position(self):
        await self._passe()
        etat = self.orchestrateur.etat
        self.assertTrue(etat.portefeuille.positions)
        self.assertLess(
            etat.portefeuille.liquidites_usd, self.config.portefeuille.capital_initial_usd
        )

    async def test_la_tresorerie_et_les_positions_restent_coherentes(self):
        """La valeur totale ne peut varier que des frais et du glissement — un
        écart plus grand veut dire qu'une exécution a été comptée deux fois."""

        await self._passe()
        etat = self.orchestrateur.etat
        prix = {
            actif: position.prix_moyen
            for actif, position in etat.portefeuille.positions.items()
        }
        valeur = etat.portefeuille.valeur_totale(prix)
        depart = self.config.portefeuille.capital_initial_usd
        self.assertLess(abs(valeur - depart), depart * 0.02)

    async def test_le_calendrier_bloque_la_passe_suivante(self):
        """Deux passes le même jour ne doivent pas déclencher deux DCA."""

        await self._passe()
        premiere = len(self.orchestrateur.gestionnaire.executions)
        await self._passe(MAINTENANT + timedelta(hours=4))
        self.assertEqual(len(self.orchestrateur.gestionnaire.executions), premiere)

    async def test_l_echeance_revient_la_semaine_suivante(self):
        await self._passe()
        premiere = len(self.orchestrateur.gestionnaire.executions)
        await self._passe(MAINTENANT + timedelta(days=8))
        self.assertGreater(len(self.orchestrateur.gestionnaire.executions), premiere)

    async def test_le_coupe_circuit_arrete_les_achats(self):
        # Deux relevés le même jour : le premier pose la référence
        # journalière, le second constate la chute. Un seul relevé ne
        # déclencherait rien — la référence se remet à la valeur observée au
        # premier passage de la journée, ce qui est exactement le
        # comportement voulu après un redémarrage.
        depart = self.config.portefeuille.capital_initial_usd
        self.orchestrateur.coupe_circuit.observer(
            maintenant=MAINTENANT, valeur_portefeuille=depart
        )
        self.orchestrateur.coupe_circuit.observer(
            maintenant=MAINTENANT, valeur_portefeuille=depart * 0.9
        )
        self.assertFalse(self.orchestrateur.coupe_circuit.passe)
        await self._passe()
        self.assertEqual(self.orchestrateur.gestionnaire.executions, [])

    async def test_le_recapitulatif_ne_part_qu_une_fois_par_jour(self):
        soir = MAINTENANT.replace(hour=19)
        _, premiere = await self._passe(soir)
        _, seconde = await self._passe(soir + timedelta(hours=1))
        self.assertIn("Récapitulatif", premiere)
        self.assertNotIn("Récapitulatif", seconde)

    async def test_une_passe_sans_donnees_ne_leve_pas(self):
        """Une passe ratée n'arrête pas la boucle — c'est la seule façon
        d'obtenir un processus qui tient des semaines sans surveillance."""

        vides = {
            plateforme: MarcheFactice(None, None, echoue=("ohlcv",))
            for plateforme in ("binance", "bybit", "hyperliquid")
        }
        self.orchestrateur.agregateur = Agregateur(marches=vides, marche_defaut="binance")
        analyses, _ = await self._passe()
        self.assertEqual(analyses, [])
        self.assertGreater(self.orchestrateur.coupe_circuit.echecs_reseau, 0)

    async def test_la_boucle_s_arrete_au_nombre_de_passes_demande(self):
        with redirect_stdout(io.StringIO()):
            await self.orchestrateur.boucler(passes_max=1)
        self.assertTrue(self.orchestrateur.etat.portefeuille.positions)

    async def test_le_mode_par_defaut_est_la_simulation(self):
        """Le défaut n'est pas négociable : un `config.yaml` mal recopié ne doit
        pas pouvoir engager d'argent."""

        self.assertIs(self.config.mode, Mode.SIMULATION)
        for execution in self.orchestrateur.gestionnaire.executions:
            self.assertTrue(execution.simule)

    async def test_la_fermeture_ferme_tout_ce_qui_tient_une_connexion(self):
        """CCXT écrit un paragraphe sur la sortie d'erreur quand on l'oublie,
        `aiohttp` un « Unclosed client session » qui arrive après la trace
        utile — et un processus qui redémarre en boucle épuise ses
        descripteurs."""

        fermees: list[str] = []

        class SourceFermable(MarcheFactice):
            async def fermer(self):
                fermees.append("marche")

        class CourtierFermable(CourtierPapier):
            async def fermer(self):
                fermees.append("courtier")

        class ClientFermable:
            async def fermer(self):
                fermees.append("client")

        self.orchestrateur.agregateur.marches["binance"] = SourceFermable(None, None)
        self.orchestrateur.gestionnaire.courtier = CourtierFermable(self.config.execution)
        self.orchestrateur.client = ClientFermable()
        await self.orchestrateur.fermer()
        self.assertEqual(set(fermees), {"marche", "courtier", "client"})

    async def test_une_fermeture_ratee_n_empeche_pas_les_autres(self):
        class SourceCassee(MarcheFactice):
            async def fermer(self):
                raise RuntimeError("boum")

        fermees: list[str] = []

        class ClientFermable:
            async def fermer(self):
                fermees.append("client")

        self.orchestrateur.agregateur.marches["binance"] = SourceCassee(None, None)
        self.orchestrateur.client = ClientFermable()
        await self.orchestrateur.fermer()
        self.assertEqual(fermees, ["client"])

    async def test_l_ordre_de_service_comble_le_plus_grand_trou(self):
        """Quand la trésorerie ne suffit pas pour tout, servir dans l'ordre du
        fichier laisserait la ligne la plus en retard toujours en retard."""

        await self._passe()
        ordre = self.orchestrateur._ordre_de_service(
            {s: 100.0 for s in self.config.portefeuille.symboles}
        )
        self.assertEqual(len(ordre), len(self.config.portefeuille.symboles))


if __name__ == "__main__":
    unittest.main()
