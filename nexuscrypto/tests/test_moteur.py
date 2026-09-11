#!/usr/bin/env python3
"""Le moteur de décision, et son invariant le plus coûteux.

`test_la_sortie_prime_sur_le_signal_d_achat` garde le cas qui se produit
exactement au pire moment : un actif qui s'effondre a un RSI en survente, donc
un excellent score d'achat, alors même que son stop vient d'être touché. Sans
cet ordre de priorité, le moteur renforcerait une position qu'il est en train
de devoir couper.

Retiré le 10/09/2026, avec le calendrier DCA : tout ce qui dépendait d'une
échéance (`marquer_dca`, « hors échéance on attend »). Le moteur ne connaît
plus que le score contre un seuil — voir `strategy/moteur.py`.
"""

import unittest
from dataclasses import replace

from aides import MAINTENANT, config, contexte, portefeuille, position

from src.core.modeles import Action
from src.strategy.moteur import Moteur


class TestMoteur(unittest.TestCase):
    def setUp(self):
        self.config = config()
        self.moteur = Moteur(self.config)

    def test_achat_en_zone_de_peur(self):
        ctx = contexte(actif="SOL/USDT", nombre=260, depart=200.0, pente=-0.2, fear_greed=15)
        analyse = self.moteur.analyser(ctx, portefeuille(), MAINTENANT)
        self.assertIs(analyse.decision.action, Action.ACHETER)
        self.assertGreater(analyse.decision.montant_usd, 0.0)

    def test_attente_en_avidite_extreme(self):
        ctx = contexte(actif="SOL/USDT", nombre=260, pente=0.3, fear_greed=92)
        analyse = self.moteur.analyser(ctx, portefeuille(), MAINTENANT)
        self.assertIs(analyse.decision.action, Action.ATTENDRE)
        self.assertEqual(analyse.decision.montant_usd, 0.0)

    def test_un_achat_sur_position_existante_devient_un_renforcement(self):
        ctx = contexte(actif="SOL/USDT", nombre=260, depart=200.0, pente=-0.2, fear_greed=15)
        pfl = portefeuille(
            positions={"SOL/USDT": position(actif="SOL/USDT", quantite=0.1, prix_moyen=100.0)}
        )
        analyse = self.moteur.analyser(ctx, pfl, MAINTENANT)
        self.assertIs(analyse.decision.action, Action.RENFORCER)

    def test_la_sortie_prime_sur_le_signal_d_achat(self):
        """Un actif qui s'effondre a un RSI en survente, donc un excellent score
        d'achat, au moment même où son stop est touché."""

        ctx = contexte(actif="SOL/USDT", nombre=260, depart=300.0, pente=-1.0, fear_greed=10)
        pfl = portefeuille(
            positions={
                "SOL/USDT": position(actif="SOL/USDT", quantite=1.0, prix_moyen=300.0)
            }
        )
        analyse = self.moteur.analyser(ctx, pfl, MAINTENANT)
        self.assertIs(analyse.decision.action, Action.SORTIR)
        self.assertTrue(analyse.sortie.doit_sortir)

    def test_le_socle_ne_sort_pas_sur_signal(self):
        """Vendre la réserve au premier stop revient à faire du trading avec ce
        qui devait ne pas bouger."""

        ctx = contexte(actif="BTC/USDT", nombre=260, depart=300.0, pente=-1.0, fear_greed=10)
        pfl = portefeuille(
            positions={"BTC/USDT": position(actif="BTC/USDT", quantite=1.0, prix_moyen=300.0)}
        )
        analyse = self.moteur.analyser(ctx, pfl, MAINTENANT)
        self.assertIsNot(analyse.decision.action, Action.SORTIR)

    def test_le_seuil_d_achat_est_configurable(self):
        """Le seul signal d'entrée depuis le retrait du DCA : relever le seuil
        au-delà d'un score qui achetait auparavant doit renverser la décision."""

        ctx = contexte(actif="SOL/USDT", nombre=260, depart=200.0, pente=-0.2, fear_greed=15)
        favorable = self.moteur.analyser(ctx, portefeuille(), MAINTENANT)
        self.assertIs(favorable.decision.action, Action.ACHETER)

        exigeant = replace(
            self.config, strategie=replace(self.config.strategie, seuil_achat=99.0)
        )
        analyse = Moteur(exigeant).analyser(ctx, portefeuille(), MAINTENANT)
        self.assertIs(analyse.decision.action, Action.ATTENDRE)

    def test_sans_sentiment_la_famille_est_dite_absente(self):
        ctx = contexte(actif="SOL/USDT", nombre=260, fear_greed=None)
        analyse = self.moteur.analyser(ctx, portefeuille(), MAINTENANT)
        self.assertTrue(any("sentiment" in r and "absente" in r for r in analyse.decision.raisons))

    def test_l_analyse_conserve_ses_raisons(self):
        """Une décision sans son analyse ne s'explique plus trois semaines
        après, et c'est la seule question qu'on se pose alors."""

        ctx = contexte(actif="SOL/USDT", nombre=260, depart=200.0, pente=-0.2, fear_greed=15)
        analyse = self.moteur.analyser(ctx, portefeuille(), MAINTENANT)
        self.assertTrue(analyse.decision.raisons)
        self.assertIsNotNone(analyse.lecture.rsi)

    def test_un_actif_hors_watchlist_est_quand_meme_analyse(self):
        """Le score décide, jamais la présence dans la watchlist : c'est ce qui
        permettra un jour à une pépite découverte par le scanner, hors
        watchlist, de recevoir exactement le même traitement qu'une ligne
        connue d'avance."""

        ctx = contexte(actif="DOGE/USDT", nombre=260, depart=200.0, pente=-0.2, fear_greed=15)
        analyse = self.moteur.analyser(ctx, portefeuille(), MAINTENANT)
        self.assertIs(analyse.decision.action, Action.ACHETER)


if __name__ == "__main__":
    unittest.main()
