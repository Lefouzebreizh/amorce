#!/usr/bin/env python3
"""Gestion du risque : dimensionnement, stops, coupe-circuits, portefeuille.

C'est la partie du système dont la mission est de dire non. Chaque test ici
garde une phrase qui, si elle sautait, ne provoquerait aucune erreur — juste un
relevé de compte différent.
"""

import unittest
from datetime import timedelta

from aides import MAINTENANT, config, portefeuille, position

from src.core.modeles import (
    Execution, Gravite, Ordre, Sens, TypeOrdre,
)
from src.risk_management import coupe_circuit as cc
from src.risk_management import portefeuille as pf
from src.risk_management import stops
from src.risk_management.sizing import dimensionner


class TestPortefeuille(unittest.TestCase):
    def _execution(self, sens, quantite, prix, frais=0.0):
        return Execution(
            ordre=Ordre("x", "BTC/USDT", sens, TypeOrdre.MARCHE, quantite),
            prix_execute=prix, quantite_executee=quantite, frais_usd=frais,
            horodatage=MAINTENANT,
        )

    def test_achat_debite_la_tresorerie_frais_compris(self):
        avant = portefeuille(liquidites=1000.0)
        apres = pf.appliquer(avant, self._execution(Sens.ACHAT, 1.0, 100.0, frais=0.1))
        self.assertAlmostEqual(apres.liquidites_usd, 899.9)
        self.assertAlmostEqual(apres.positions["BTC/USDT"].prix_moyen, 100.0)

    def test_les_frais_ne_polluent_pas_le_prix_moyen(self):
        """Les intégrer donnerait un prix moyen qui ne correspond à aucun prix
        réel, et tous les stops, qui partent du prix moyen, seraient décalés."""

        apres = pf.appliquer(
            portefeuille(liquidites=1000.0), self._execution(Sens.ACHAT, 1.0, 100.0, frais=50.0)
        )
        self.assertAlmostEqual(apres.positions["BTC/USDT"].prix_moyen, 100.0)

    def test_achat_sans_tresorerie_leve_avant_d_agir(self):
        with self.assertRaises(pf.FondsInsuffisants):
            pf.appliquer(portefeuille(liquidites=10.0), self._execution(Sens.ACHAT, 1.0, 100.0))

    def test_vente_sans_position_leve(self):
        with self.assertRaises(pf.PositionIntrouvable):
            pf.appliquer(portefeuille(), self._execution(Sens.VENTE, 1.0, 100.0))

    def test_vente_totale_retire_la_ligne(self):
        avant = portefeuille(
            liquidites=0.0, positions={"BTC/USDT": position(quantite=1.0, prix_moyen=100.0)}
        )
        apres = pf.appliquer(avant, self._execution(Sens.VENTE, 1.0, 120.0, frais=1.0))
        self.assertNotIn("BTC/USDT", apres.positions)
        self.assertAlmostEqual(apres.liquidites_usd, 119.0)

    def test_derive_la_plus_sous_ponderee_en_tete(self):
        """Cet ordre décide qui est servi quand la trésorerie ne suffit pas :
        l'ordre du fichier servirait Bitcoin en premier tous les mois."""

        pfl = portefeuille(
            liquidites=5000.0,
            positions={"BTC/USDT": position(quantite=90.0, prix_moyen=100.0)},
        )
        prix = {s: 100.0 for s in config().portefeuille.symboles}
        derives = pf.derives(pfl, prix, config().portefeuille)
        self.assertLess(derives[0].ecart, 0)
        self.assertEqual(derives[-1].actif, "BTC/USDT")
        self.assertTrue(derives[-1].sur_pondere)

    def test_tolerance_de_derive(self):
        petite = pf.Derive("BTC/USDT", poids_reel=0.52, poids_cible=0.50)
        grande = pf.Derive("BTC/USDT", poids_reel=0.62, poids_cible=0.50)
        self.assertFalse(pf.doit_reequilibrer(petite, 0.05))
        self.assertTrue(pf.doit_reequilibrer(grande, 0.05))


class TestSizing(unittest.TestCase):
    def setUp(self):
        self.config = config()

    def _dimensionner(self, **remplacements):
        arguments = dict(
            montant_souhaite_usd=1000.0, prix=100.0, stop=90.0,
            portefeuille=portefeuille(liquidites=10_000.0), valeur_totale_usd=10_000.0,
            actif="BTC/USDT", config_risque=self.config.risque,
            config_portefeuille=self.config.portefeuille,
        )
        arguments.update(remplacements)
        return dimensionner(**arguments)

    def test_le_risque_borne_le_montant(self):
        """1 % de 10 000 $ risqué, stop 10 $ sous le prix → 10 unités, soit
        1 000 $. Le montant souhaité de 1 000 $ passe donc tout juste."""

        dimension = self._dimensionner(montant_souhaite_usd=5000.0)
        self.assertAlmostEqual(dimension.montant_usd, 1000.0, places=6)
        self.assertEqual(dimension.plafond_actif, "risque par position")

    def test_un_actif_volatil_recoit_une_position_plus_petite(self):
        """Automatiquement, sans table par actif à tenir à jour."""

        serre = self._dimensionner(montant_souhaite_usd=5000.0, stop=95.0)
        large = self._dimensionner(montant_souhaite_usd=5000.0, stop=70.0)
        self.assertGreater(serre.montant_usd, large.montant_usd)

    def test_sans_stop_le_plafond_de_risque_ne_s_applique_pas(self):
        dimension = self._dimensionner(stop=None)
        self.assertTrue(any("pas de stop" in d for d in dimension.detail))

    def test_la_tresorerie_est_le_plafond_dur(self):
        dimension = self._dimensionner(
            portefeuille=portefeuille(liquidites=42.0), stop=None
        )
        self.assertAlmostEqual(dimension.montant_usd, 42.0)
        self.assertEqual(dimension.plafond_actif, "trésorerie disponible")

    def test_exposition_maximale_par_actif(self):
        pfl = portefeuille(
            liquidites=10_000.0,
            positions={"BTC/USDT": position(quantite=54.0, prix_moyen=100.0)},
        )
        dimension = self._dimensionner(
            portefeuille=pfl, valeur_totale_usd=15_400.0, stop=None, montant_souhaite_usd=9000.0
        )
        self.assertEqual(dimension.plafond_actif, "exposition par actif")

    def test_plafond_du_jeton_decouvert(self):
        dimension = self._dimensionner(stop=None, plafond_specifique_usd=150.0)
        self.assertAlmostEqual(dimension.montant_usd, 150.0)
        self.assertEqual(dimension.plafond_actif, "plafond du jeton découvert")

    def test_prix_nul_leve(self):
        with self.assertRaises(ValueError):
            self._dimensionner(prix=0.0)


class TestStops(unittest.TestCase):
    def setUp(self):
        self.config = config().risque

    def test_stop_a_un_multiple_d_atr(self):
        self.assertAlmostEqual(
            stops.stop_initial(100.0, 4.0, self.config),
            100.0 - 4.0 * self.config.atr_multiple_stop,
        )

    def test_le_multiple_livre_est_celui_qui_a_ete_mesure(self):
        """4 × ATR, mesuré sur trois fenêtres de BTC + ETH + LINK réels.

        À 2,5, les stops liquidaient ETH et LINK dix-neuf fois en quatre ans et
        le portefeuille finissait concentré sur le seul actif interdit de
        vente. Le changer sans rejouer le harnais multi-actifs sur données
        réelles, c'est régler à l'aveugle.
        """

        self.assertAlmostEqual(self.config.atr_multiple_stop, 4.0)

    def test_sans_atr_pas_de_stop(self):
        """On préfère ne pas en poser qu'en poser un arbitraire : le
        dimensionnement lit ce nombre, et un stop inventé donne une taille
        inventée."""

        self.assertIsNone(stops.stop_initial(100.0, None, self.config))

    def test_le_stop_declenche(self):
        # Le prix d'épreuve se déduit du réglage : le coder en dur l'attachait
        # au multiplicateur du jour, et le test cassait au premier balayage.
        seuil = stops.stop_initial(100.0, 4.0, self.config)
        niveaux = stops.evaluer(position(prix_moyen=100.0), seuil - 1.0, 4.0, self.config)
        self.assertIs(niveaux.declencheur, stops.Declencheur.STOP)
        self.assertIn("stop touché", niveaux.raison)

    def test_le_trailing_prime_sur_le_stop(self):
        """Annoncer un stop-loss sur une position gagnante fausse toute lecture
        ultérieure des performances."""

        ligne = position(prix_moyen=100.0, plus_haut=200.0)
        niveaux = stops.evaluer(ligne, 150.0, 40.0, self.config)
        self.assertIs(niveaux.declencheur, stops.Declencheur.TRAILING)
        self.assertIn("bénéfice", niveaux.raison)

    def test_le_trailing_ne_s_arme_pas_sous_le_seuil(self):
        ligne = position(prix_moyen=100.0, plus_haut=110.0)
        niveaux = stops.evaluer(ligne, 105.0, 4.0, self.config)
        self.assertIsNone(niveaux.trailing)
        self.assertFalse(niveaux.doit_sortir)

    def test_rien_a_faire_en_croisiere(self):
        niveaux = stops.evaluer(position(prix_moyen=100.0), 105.0, 4.0, self.config)
        self.assertFalse(niveaux.doit_sortir)


class TestCoupeCircuit(unittest.TestCase):
    def setUp(self):
        self.config = config().risque.coupe_circuit
        self.disjoncteur = cc.depuis_config(self.config, 10_000.0, MAINTENANT)

    def test_drawdown_journalier(self):
        declenchement = self.disjoncteur.observer(
            maintenant=MAINTENANT, valeur_portefeuille=9_200.0
        )
        self.assertIsNotNone(declenchement)
        self.assertIs(declenchement.motif, cc.Motif.DRAWDOWN_JOURNALIER)
        self.assertFalse(self.disjoncteur.passe)

    def test_chute_d_un_actif_sur_une_heure(self):
        declenchement = self.disjoncteur.observer(
            maintenant=MAINTENANT, valeur_portefeuille=10_000.0,
            variations_1h={"SOL/USDT": -0.15},
        )
        self.assertIs(declenchement.motif, cc.Motif.CHUTE_MARCHE)
        self.assertEqual(declenchement.actif, "SOL/USDT")

    def test_actualite_critique_suspend(self):
        declenchement = self.disjoncteur.observer(
            maintenant=MAINTENANT, valeur_portefeuille=10_000.0,
            gravite_macro=Gravite.CRITIQUE,
        )
        self.assertIs(declenchement.motif, cc.Motif.ACTUALITE_CRITIQUE)

    def test_echecs_reseau_consecutifs(self):
        """Acheter à l'aveugle est pire que ne pas acheter."""

        for _ in range(5):
            self.disjoncteur.signaler_echec_reseau()
        declenchement = self.disjoncteur.observer(
            maintenant=MAINTENANT, valeur_portefeuille=10_000.0
        )
        self.assertIs(declenchement.motif, cc.Motif.RESEAU)

    def test_un_succes_reseau_remet_le_compteur_a_zero(self):
        for _ in range(4):
            self.disjoncteur.signaler_echec_reseau()
        self.disjoncteur.signaler_succes_reseau()
        self.assertIsNone(
            self.disjoncteur.observer(maintenant=MAINTENANT, valeur_portefeuille=10_000.0)
        )

    def test_rearmement_automatique_apres_refroidissement(self):
        self.disjoncteur.observer(maintenant=MAINTENANT, valeur_portefeuille=9_200.0)
        self.assertFalse(self.disjoncteur.passe)
        plus_tard = MAINTENANT + timedelta(minutes=self.config.refroidissement_minutes + 1)
        self.disjoncteur.observer(maintenant=plus_tard, valeur_portefeuille=9_900.0)
        self.assertTrue(self.disjoncteur.passe)

    def test_le_drawdown_total_ne_se_rearme_pas_seul(self):
        """Un système qui se coupe définitivement à la première secousse ne sert
        à rien ; un système qui se réarme après une perte de 25 % non plus."""

        # Une érosion lente : chaque jour ouvre sur une nouvelle référence
        # journalière, donc le seuil du jour n'est jamais franchi — c'est
        # exactement le cas que le drawdown total existe pour attraper.
        for jour, valeur in enumerate((9_400.0, 8_800.0, 8_200.0, 7_400.0), start=1):
            self.disjoncteur.observer(
                maintenant=MAINTENANT + timedelta(days=jour), valeur_portefeuille=valeur
            )
        self.assertIs(self.disjoncteur.declenchement.motif, cc.Motif.DRAWDOWN_TOTAL)
        tres_plus_tard = MAINTENANT + timedelta(days=8)
        self.disjoncteur.observer(maintenant=tres_plus_tard, valeur_portefeuille=7_000.0)
        self.assertFalse(self.disjoncteur.passe)
        self.assertFalse(self.disjoncteur.rearmer())
        self.assertTrue(self.disjoncteur.rearmer(force=True))

    def test_un_seul_declenchement_par_cause(self):
        """Une notification par déclenchement, pas une par passe."""

        premier = self.disjoncteur.observer(maintenant=MAINTENANT, valeur_portefeuille=9_200.0)
        second = self.disjoncteur.observer(maintenant=MAINTENANT, valeur_portefeuille=9_100.0)
        self.assertIsNotNone(premier)
        self.assertIsNone(second)

    def test_changement_de_jour_remet_la_reference(self):
        demain = MAINTENANT + timedelta(days=1)
        self.disjoncteur.observer(maintenant=demain, valeur_portefeuille=9_500.0)
        self.assertAlmostEqual(self.disjoncteur.reference_journaliere, 9_500.0)
        self.assertTrue(self.disjoncteur.passe)


if __name__ == "__main__":
    unittest.main()
