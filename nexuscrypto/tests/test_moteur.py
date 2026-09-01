#!/usr/bin/env python3
"""Le moteur de décision, et son invariant le plus coûteux.

`test_la_sortie_prime_sur_le_signal_d_achat` garde le cas qui se produit
exactement au pire moment : un actif qui s'effondre a un RSI en survente, donc
un excellent score d'achat, alors même que son stop vient d'être touché. Sans
cet ordre de priorité, le moteur renforcerait une position qu'il est en train
de devoir couper.
"""

import unittest
from datetime import timedelta

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

    def test_temporisation_en_avidite_extreme(self):
        ctx = contexte(actif="SOL/USDT", nombre=260, pente=0.3, fear_greed=92)
        analyse = self.moteur.analyser(ctx, portefeuille(), MAINTENANT)
        self.assertIs(analyse.decision.action, Action.TEMPORISER)
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

    def test_hors_echeance_on_attend(self):
        ctx = contexte(actif="SOL/USDT", nombre=260, depart=200.0, pente=-0.2, fear_greed=15)
        self.moteur.marquer_dca("SOL/USDT", MAINTENANT)
        analyse = self.moteur.analyser(ctx, portefeuille(), MAINTENANT + timedelta(hours=4))
        self.assertIs(analyse.decision.action, Action.ATTENDRE)

    def test_l_echeance_revient_la_semaine_suivante(self):
        ctx = contexte(actif="SOL/USDT", nombre=260, depart=200.0, pente=-0.2, fear_greed=15)
        self.moteur.marquer_dca("SOL/USDT", MAINTENANT)
        analyse = self.moteur.analyser(ctx, portefeuille(), MAINTENANT + timedelta(days=8))
        self.assertIs(analyse.decision.action, Action.ACHETER)

    def test_sans_sentiment_la_zone_est_neutre(self):
        ctx = contexte(actif="SOL/USDT", nombre=260, fear_greed=None)
        analyse = self.moteur.analyser(ctx, portefeuille(), MAINTENANT)
        self.assertTrue(any("neutre" in r for r in analyse.decision.raisons))

    def test_l_analyse_conserve_ses_raisons(self):
        """Une décision sans son analyse ne s'explique plus trois semaines
        après, et c'est la seule question qu'on se pose alors."""

        ctx = contexte(actif="SOL/USDT", nombre=260, depart=200.0, pente=-0.2, fear_greed=15)
        analyse = self.moteur.analyser(ctx, portefeuille(), MAINTENANT)
        self.assertTrue(analyse.decision.raisons)
        self.assertIsNotNone(analyse.lecture.rsi)

    def test_un_actif_hors_allocation_ne_recoit_rien(self):
        ctx = contexte(actif="DOGE/USDT", nombre=260, fear_greed=15)
        analyse = self.moteur.analyser(ctx, portefeuille(), MAINTENANT)
        self.assertEqual(analyse.decision.montant_usd, 0.0)


if __name__ == "__main__":
    unittest.main()
