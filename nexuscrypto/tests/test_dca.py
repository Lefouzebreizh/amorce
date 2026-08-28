#!/usr/bin/env python3
"""Le DCA dynamique : le calendrier d'un côté, le montant de l'autre.

Deux garde-fous sont gardés ici parce qu'ils coûtent cher quand ils sautent :
le multiplicateur est borné en haut — sans quoi un enchaînement favorable
dépense six semaines de budget avant le vrai creux — et zéro est une décision
qui se raconte, pas une panne silencieuse.
"""

import unittest
from dataclasses import replace
from datetime import datetime, timedelta, timezone

from aides import config, contexte

from src.core.modeles import Action, Score, Zone
from src.strategy import dca
from src.strategy.indicateurs import lire


def score(total: float) -> Score:
    return Score(total=total, technique=total, sentiment=total, onchain=total)


class TestCalendrier(unittest.TestCase):
    def test_premiere_fois_toujours_echue(self):
        self.assertTrue(dca.echeance_atteinte("hebdomadaire", None, datetime.now(timezone.utc)))

    def test_hebdomadaire_change_de_semaine_pas_de_sept_jours(self):
        """Un DCA hebdomadaire doit tomber le même jour de semaine même si une
        passe a été manquée. Une comptabilité en heures dérive d'un jour par
        mois, et la dérive fausse les comparaisons de performance."""

        vendredi = datetime(2026, 8, 21, 12, tzinfo=timezone.utc)
        samedi = vendredi + timedelta(days=1)
        lundi = datetime(2026, 8, 24, 9, tzinfo=timezone.utc)
        self.assertFalse(dca.echeance_atteinte("hebdomadaire", vendredi, samedi))
        self.assertTrue(dca.echeance_atteinte("hebdomadaire", vendredi, lundi))

    def test_quotidienne_et_mensuelle(self):
        hier = datetime(2026, 8, 24, 23, tzinfo=timezone.utc)
        aujourdhui = datetime(2026, 8, 25, 1, tzinfo=timezone.utc)
        self.assertTrue(dca.echeance_atteinte("quotidienne", hier, aujourdhui))
        self.assertFalse(dca.echeance_atteinte("mensuelle", hier, aujourdhui))
        self.assertTrue(
            dca.echeance_atteinte("mensuelle", hier, datetime(2026, 9, 1, tzinfo=timezone.utc))
        )

    def test_cadence_inconnue_leve(self):
        with self.assertRaises(ValueError):
            dca.echeance_atteinte("trimestrielle", None, datetime.now(timezone.utc))


class TestMultiplicateur(unittest.TestCase):
    def setUp(self):
        self.config = config().strategie.dca
        self.lecture = lire(contexte(nombre=260, pente=0.1).serie)

    def test_la_peur_achete_plus_que_l_avidite(self):
        peur, _ = dca.multiplicateur(Zone.PEUR_EXTREME, self.lecture, score(50), self.config)
        avidite, _ = dca.multiplicateur(Zone.AVIDITE, self.lecture, score(50), self.config)
        self.assertGreater(peur, avidite)

    def test_avidite_extreme_temporise(self):
        facteur, _ = dca.multiplicateur(
            Zone.AVIDITE_EXTREME, self.lecture, score(50), self.config
        )
        self.assertEqual(facteur, 0.0)

    def test_le_multiplicateur_est_plafonne(self):
        """Sans plafond, peur extrême + sous l'EMA 200 + score 100 dépense six
        semaines de budget juste avant le mois où la peur devient extrême."""

        baissiere = lire(contexte(nombre=260, depart=300.0, pente=-0.5).serie)
        facteur, _ = dca.multiplicateur(Zone.PEUR_EXTREME, baissiere, score(100), self.config)
        self.assertLessEqual(facteur, self.config.multiplicateur_max)

    def test_une_seule_prime_de_moyenne_mobile(self):
        """« Sous l'EMA 50 » et « sous l'EMA 200 » ne se cumulent pas : le second
        implique presque toujours le premier, les compter deux fois double la
        prime sur un seul fait."""

        baissiere = lire(contexte(nombre=260, depart=300.0, pente=-0.5).serie)
        _, raisons = dca.multiplicateur(Zone.NEUTRE, baissiere, score(50), self.config)
        primes = [r for r in raisons if "sous l'EMA" in r]
        self.assertEqual(len(primes), 1)

    def test_le_score_module_sans_dominer(self):
        haut, _ = dca.multiplicateur(Zone.NEUTRE, self.lecture, score(100), self.config)
        bas, _ = dca.multiplicateur(Zone.NEUTRE, self.lecture, score(0), self.config)
        peur, _ = dca.multiplicateur(Zone.PEUR_EXTREME, self.lecture, score(0), self.config)
        self.assertGreater(haut, bas)
        # Même avec le pire score, la peur extrême achète plus que le neutre au
        # meilleur score : la zone reste le signal dominant.
        self.assertGreater(peur, haut)


class TestPlanifier(unittest.TestCase):
    def setUp(self):
        self.config = config().strategie.dca
        self.lecture = lire(contexte(nombre=260, pente=0.1).serie)

    def _planifier(self, **remplacements):
        arguments = dict(
            # 400 × 0,5 = 200 $ de nominal : le plancher de 15 % vaut 30 $,
            # au-dessus du minimum de 20 $. Avec 200 $ de nominal il vaudrait
            # 15 $ et toutes les branches de plancher retomberaient sur la
            # temporisation — le test passerait en ne mesurant rien.
            enveloppe_usd=400.0, poids_actif=0.5, zone=Zone.NEUTRE,
            lecture=self.lecture, score=score(70), config=self.config, echeance=True,
        )
        arguments.update(remplacements)
        return dca.planifier(**arguments)

    def test_achat_nominal(self):
        enveloppe = self._planifier()
        self.assertIs(enveloppe.action, Action.ACHETER)
        self.assertGreater(enveloppe.montant_usd, 0.0)

    def test_hors_echeance_on_attend(self):
        enveloppe = self._planifier(echeance=False)
        self.assertIs(enveloppe.action, Action.ATTENDRE)
        self.assertEqual(enveloppe.montant_usd, 0.0)

    def test_un_score_faible_reduit_l_achat_sans_l_annuler(self):
        """La correction du plancher change ce test, et c'est le but.

        Avant, un indice sous le seuil annulait l'achat. Le rejeu a montré que
        sur une tendance haussière la note reste durablement sous le seuil et
        que l'annulation dure alors toute la période. Un score faible **réduit**
        désormais l'achat au plancher de discipline au lieu de le supprimer.
        """

        faible = self._planifier(score=score(10))
        bon = self._planifier(score=score(70))
        self.assertIs(faible.action, Action.ACHETER)
        self.assertLess(faible.montant_usd, bon.montant_usd)

    def test_avidite_extreme_n_achete_plus_que_le_plancher(self):
        """Le comportement d'origine était de ne rien acheter du tout en avidité
        extrême. Le harnais de rejeu a montré ce qu'il coûte — zéro ordre sur
        398 échéances dans une hausse continue — et la stratégie y achète
        désormais le plancher de discipline, pas l'enveloppe pleine."""

        enveloppe = self._planifier(zone=Zone.AVIDITE_EXTREME, score=score(90))
        pleine = self._planifier(zone=Zone.NEUTRE, score=score(90))
        self.assertIs(enveloppe.action, Action.ACHETER)
        self.assertLess(enveloppe.montant_usd, pleine.montant_usd)
        self.assertTrue(any("plancher de discipline" in r for r in enveloppe.raisons))

    def test_le_plancher_achete_quand_le_score_dit_non(self):
        """Un DCA ne cesse jamais complètement d'acheter : c'est sa définition."""

        enveloppe = self._planifier(score=score(10))
        self.assertIs(enveloppe.action, Action.ACHETER)
        self.assertGreater(enveloppe.montant_usd, 0.0)
        self.assertTrue(any("plancher de discipline" in r for r in enveloppe.raisons))

    def test_le_plancher_achete_meme_en_avidite_extreme(self):
        """Le multiplicateur de zone y vaut zéro : c'est précisément le cas
        pour lequel le plancher existe."""

        enveloppe = self._planifier(zone=Zone.AVIDITE_EXTREME, score=score(90))
        self.assertIs(enveloppe.action, Action.ACHETER)
        self.assertGreater(enveloppe.montant_usd, 0.0)

    def test_le_plancher_ne_depend_pas_du_multiplicateur_de_zone(self):
        """L'y rapporter le ramènerait à zéro en avidité extrême, c'est-à-dire
        exactement là où on en a besoin. C'est un plancher, pas une réduction."""

        avidite = self._planifier(zone=Zone.AVIDITE_EXTREME, score=score(90))
        peur = self._planifier(zone=Zone.PEUR_EXTREME, score=score(10))
        self.assertAlmostEqual(avidite.montant_usd, peur.montant_usd)

    def test_un_plancher_nul_retablit_l_abstention(self):
        """Le comportement d'origine reste atteignable par la configuration."""

        sans = replace(self.config, plancher_enveloppe=0.0)
        enveloppe = self._planifier(score=score(10), config=sans)
        self.assertIs(enveloppe.action, Action.TEMPORISER)
        self.assertEqual(enveloppe.montant_usd, 0.0)

    def test_un_plancher_sous_le_minimum_temporise_et_le_dit(self):
        enveloppe = self._planifier(score=score(10), enveloppe_usd=30.0, poids_actif=0.1)
        self.assertIs(enveloppe.action, Action.TEMPORISER)
        self.assertTrue(any("plancher" in r and "minimum" in r for r in enveloppe.raisons))

    def test_montant_trop_petit_temporise(self):
        """Un achat de trois dollars coûte plus en frais qu'il n'apporte."""

        enveloppe = self._planifier(enveloppe_usd=10.0, poids_actif=0.05)
        self.assertIs(enveloppe.action, Action.TEMPORISER)
        self.assertTrue(any("minimum" in r for r in enveloppe.raisons))


if __name__ == "__main__":
    unittest.main()
