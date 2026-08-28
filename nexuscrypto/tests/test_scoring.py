#!/usr/bin/env python3
"""L'indice de confiance.

Le test le plus important du fichier est `test_convention_contrarienne` : il
garde le fait que l'indice mesure une **opportunité d'achat**, pas une santé de
marché. Inverser cette convention donne un système qui achète les sommets, et
aucun autre test ne s'en apercevrait.
"""

import unittest

from aides import MAINTENANT, config, contexte

from src.core.modeles import Actualite, Gravite, MetriqueOnchain, SignalSentiment
from src.strategy import scoring
from src.strategy.indicateurs import lire


class TestNoteTechnique(unittest.TestCase):
    def setUp(self):
        self.config = config().strategie

    def test_convention_contrarienne(self):
        """Un marché effondré note mieux qu'un marché euphorique. C'est la
        convention du système, et elle décide de tous les signes."""

        effondre = lire(contexte(nombre=260, depart=300.0, pente=-0.6).serie)
        euphorique = lire(contexte(nombre=260, depart=100.0, pente=0.6).serie)
        note_basse, _ = scoring.note_technique(effondre, self.config)
        note_haute, _ = scoring.note_technique(euphorique, self.config)
        self.assertGreater(note_basse, note_haute)

    def test_serie_trop_courte_rend_none(self):
        lecture = lire(contexte(nombre=5).serie)
        note, raisons = scoring.note_technique(lecture, self.config)
        self.assertIsNone(note)
        self.assertTrue(raisons)

    def test_bornee_entre_zero_et_cent(self):
        for pente in (-2.0, -0.1, 0.0, 0.1, 2.0):
            lecture = lire(contexte(nombre=260, depart=500.0, pente=pente).serie)
            note, _ = scoring.note_technique(lecture, self.config)
            self.assertTrue(0.0 <= note <= 100.0, (pente, note))


class TestNoteSentiment(unittest.TestCase):
    def test_peur_extreme_note_haut(self):
        note, raisons = scoring.note_sentiment(SignalSentiment(fear_greed=10))
        self.assertAlmostEqual(note, 90.0)
        self.assertTrue(any("peur extrême" in r for r in raisons))

    def test_avidite_extreme_note_bas(self):
        note, _ = scoring.note_sentiment(SignalSentiment(fear_greed=90))
        self.assertAlmostEqual(note, 10.0)

    def test_le_social_est_suiveur_pas_contrarien(self):
        """Les deux sens coexistent volontairement : l'indice public mesure la
        foule, dont on fait l'inverse ; le social mesure l'intérêt, dont un
        regain est ce qu'on cherche."""

        positif, _ = scoring.note_sentiment(SignalSentiment(score_social=0.8))
        negatif, _ = scoring.note_sentiment(SignalSentiment(score_social=-0.8))
        self.assertGreater(positif, negatif)

    def test_absence_rend_none(self):
        self.assertEqual(scoring.note_sentiment(None), (None, []))
        self.assertEqual(scoring.note_sentiment(SignalSentiment())[0], None)


class TestNoteOnchain(unittest.TestCase):
    def test_sortie_des_plateformes_est_haussiere(self):
        """Le signe est contre-intuitif et a déjà été inversé une fois :
        négatif = les jetons quittent les plateformes = lecture haussière."""

        sortie = MetriqueOnchain("BTC/USDT", tvl_usd=1e9, flux_reserves_exchanges_usd=-5e7)
        entree = MetriqueOnchain("BTC/USDT", tvl_usd=1e9, flux_reserves_exchanges_usd=+5e7)
        self.assertGreater(
            scoring.note_onchain(sortie)[0], scoring.note_onchain(entree)[0]
        )

    def test_tvl_en_hausse_note_mieux(self):
        hausse = MetriqueOnchain("SOL/USDT", tvl_usd=1e9, variation_tvl_7j=0.15)
        baisse = MetriqueOnchain("SOL/USDT", tvl_usd=1e9, variation_tvl_7j=-0.15)
        self.assertGreater(scoring.note_onchain(hausse)[0], scoring.note_onchain(baisse)[0])

    def test_metrique_vide_rend_none(self):
        self.assertIsNone(scoring.note_onchain(MetriqueOnchain("X"))[0])


class TestCalculer(unittest.TestCase):
    def setUp(self):
        self.config = config().strategie

    def test_redistribution_des_poids_absents(self):
        """Une panne de DeFiLlama ne doit pas faire passer tous les scores sous
        le seuil d'achat : le poids absent est redistribué, pas compté à zéro."""

        ctx = contexte(nombre=260, fear_greed=20, onchain=None)
        score = scoring.calculer(ctx, lire(ctx.serie), self.config)
        self.assertEqual(set(score.poids_effectifs), {"technique", "sentiment"})
        self.assertAlmostEqual(sum(score.poids_effectifs.values()), 1.0, places=6)
        self.assertGreater(score.total, 0.0)

    def test_aucune_source_donne_zero_et_non_cinquante(self):
        """Un « neutre » à 50 serait lu comme une opinion, et le seuil d'achat
        pourrait être franchi par une absence totale d'information."""

        ctx = contexte(nombre=5, fear_greed=None)
        score = scoring.calculer(ctx, lire(ctx.serie), self.config)
        self.assertEqual(score.total, 0.0)
        self.assertIn("aucune source exploitable", score.raisons)

    def test_actualite_critique_plafonne_sans_soustraire(self):
        """Un plafond dit « on ne prend pas de risque » ; une soustraction
        dirait « le marché vaut moins », ce qui est une opinion qu'on n'a pas."""

        nouvelle = Actualite(
            "Exchange hack drains funds", "test", MAINTENANT, gravite=Gravite.CRITIQUE
        )
        ctx = contexte(nombre=260, depart=300.0, pente=-0.6, fear_greed=10,
                       actualites=(nouvelle,))
        score = scoring.calculer(ctx, lire(ctx.serie), self.config)
        self.assertLessEqual(score.total, 35.0)
        self.assertTrue(any("plafonné" in r for r in score.raisons))

    def test_les_sources_en_panne_sont_dites(self):
        from src.core.modeles import Contexte

        ctx = contexte(nombre=260)
        ctx = Contexte(
            actif=ctx.actif, releve_le=ctx.releve_le, serie=ctx.serie,
            carnet=ctx.carnet, sentiment=ctx.sentiment,
            sources_en_panne=("onchain", "carnet"),
        )
        score = scoring.calculer(ctx, lire(ctx.serie), self.config)
        self.assertTrue(any("en panne" in r for r in score.raisons))

    def test_total_toujours_borne(self):
        for depart, pente, peur in ((100.0, 0.5, 90), (300.0, -0.9, 5), (50.0, 0.0, 50)):
            ctx = contexte(nombre=260, depart=depart, pente=pente, fear_greed=peur)
            score = scoring.calculer(ctx, lire(ctx.serie), self.config)
            self.assertTrue(0.0 <= score.total <= 100.0)


if __name__ == "__main__":
    unittest.main()
