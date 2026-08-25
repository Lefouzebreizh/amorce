#!/usr/bin/env python3
"""Ce que la configuration doit refuser.

Chacune de ces erreurs a la même signature à l'usage — le radar ne trouve plus
rien, et l'on cherche du côté de l'API pendant une heure. D'où des tests sur
les refus plutôt que sur les acceptations.
"""

import copy
import sys
import unittest
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.reglages import (  # noqa: E402
    DOSSIER_CONFIG, ReglagesInvalides, charger, lire_chaines, lire_reglages,
)


def config_brute() -> dict:
    return yaml.safe_load((DOSSIER_CONFIG / "reglages.yaml").read_text("utf-8"))


def chaines_brutes() -> dict:
    return yaml.safe_load((DOSSIER_CONFIG / "chaines.yaml").read_text("utf-8"))


class TestConfigurationLivree(unittest.TestCase):
    """La configuration du dépôt doit se charger telle quelle."""

    def setUp(self):
        self.reglages = charger()

    def test_les_huit_chaines_majeures_sont_couvertes(self):
        for chaine in ("solana", "base", "ethereum", "bsc", "arbitrum", "avalanche"):
            self.assertIn(chaine, self.reglages.chaines)

    def test_chaque_chaine_declare_au_moins_un_jeton_de_cotation(self):
        for cle, chaine in self.reglages.chaines.items():
            self.assertTrue(chaine.quotes, f"{cle} n'accepterait aucune paire")

    def test_les_adresses_evm_sont_rangees_en_minuscules(self):
        # La comparaison se fait des milliers de fois par scan : la casse est
        # normalisée une fois au chargement, pas à chaque paire.
        for chaine in self.reglages.chaines.values():
            if chaine.est_evm:
                self.assertTrue(all(q == q.lower() for q in chaine.quotes))

    def test_les_ponderations_font_cent(self):
        self.assertAlmostEqual(sum(c.poids for c in self.reglages.convergence.criteres), 100.0)

    def test_le_bouclier_analyse_plus_bas_que_le_seuil_d_alerte(self):
        self.assertLessEqual(
            self.reglages.bouclier.note_minimale_pour_analyser,
            self.reglages.alertes.note_minimale,
        )


class TestRefus(unittest.TestCase):
    def charger_modifie(self, modifier):
        donnees = config_brute()
        modifier(donnees)
        return lire_reglages(donnees, lire_chaines(chaines_brutes()))

    def test_des_ponderations_qui_ne_font_pas_cent_sont_refusees(self):
        # Sinon la note maximale atteignable glisse, et le seuil d'alerte à 70
        # change de sens sans que rien ne le dise.
        def retirer_un_critere(donnees):
            del donnees["convergence"]["criteres"]["rotation"]
        with self.assertRaises(ReglagesInvalides):
            self.charger_modifie(retirer_un_critere)

    def test_un_trapeze_decroissant_est_refuse(self):
        def casser(donnees):
            donnees["convergence"]["criteres"]["pression"]["trapeze"] = [0.6, 0.25, 0.05, 0.02]
        with self.assertRaises(ReglagesInvalides):
            self.charger_modifie(casser)

    def test_un_poids_a_zero_est_refuse(self):
        def annuler(donnees):
            donnees["convergence"]["criteres"]["age"]["poids"] = 0
        with self.assertRaises(ReglagesInvalides):
            self.charger_modifie(annuler)

    def test_un_bouclier_plus_exigeant_que_l_alerte_est_refuse(self):
        # Des jetons seraient alertés sans avoir été contrôlés : le contraire
        # exact de ce que fait cet outil.
        def inverser(donnees):
            donnees["bouclier"]["note_minimale_pour_analyser"] = 90
            donnees["alertes"]["note_minimale"] = 70
        with self.assertRaises(ReglagesInvalides):
            self.charger_modifie(inverser)

    def test_une_bande_de_capitalisation_vide_est_refusee(self):
        def inverser(donnees):
            donnees["filtres"]["market_cap_min_usd"] = 30_000_000
            donnees["filtres"]["market_cap_max_usd"] = 100_000
        with self.assertRaises(ReglagesInvalides):
            self.charger_modifie(inverser)

    def test_une_chaine_sans_jeton_de_cotation_est_refusee(self):
        brutes = copy.deepcopy(chaines_brutes())
        brutes["base"]["quotes"] = []
        with self.assertRaises(ReglagesInvalides):
            lire_chaines(brutes)

    def test_honeypot_is_declare_sur_une_chaine_non_evm_est_refuse(self):
        brutes = copy.deepcopy(chaines_brutes())
        brutes["solana"]["honeypot_is"] = 101
        with self.assertRaises(ReglagesInvalides):
            lire_chaines(brutes)


if __name__ == "__main__":
    unittest.main()
