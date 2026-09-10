#!/usr/bin/env python3
"""L'état de validation avant argent réel.

**Un garde-fou d'argent ne compte comme vérifié que si un test l'a vu se
déclencher pour de vrai** (CLAUDE.md, §4, posé le 10/09/2026). Cette suite
fait donc refuser la production sur chacun des quatre manques possibles, pas
seulement sur le cas nominal.
"""

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import yaml

from aides import RACINE

from src.core.validation import EtatValidation, charger, pret_pour_production


def _ecrire(dossier: Path, contenu: dict) -> Path:
    chemin = dossier / "validation.yaml"
    chemin.write_text(yaml.safe_dump(contenu, allow_unicode=True), encoding="utf-8")
    return chemin


ETAT_COMPLET = {
    "backtest_multi_regimes_fait": True,
    "backtest_note": "six profils fabriqués + BTC réel 2018-2024, voir rapport.md",
    "paper_trading_jours": 21,
    "paper_trading_concluant": True,
    "paper_trading_note": "coupe-circuit journalier déclenché une fois, comme prévu",
    "valide_par": "Erwann",
    "valide_le": "2026-09-24",
}


class TestChargement(unittest.TestCase):
    def test_fichier_absent_vaut_rien_valide(self):
        etat = charger(RACINE / "config" / "n-existe-pas.yaml")
        self.assertEqual(etat, EtatValidation())

    def test_le_fichier_livre_est_le_defaut_prudent(self):
        """Le fichier versionné doit démarrer entièrement à `false` — c'est la
        seule garantie qu'un clone neuf ne peut pas partir en réel par accident."""

        etat = charger(RACINE / "config" / "validation.yaml")
        self.assertFalse(etat.backtest_multi_regimes_fait)
        self.assertFalse(etat.paper_trading_concluant)
        self.assertEqual(etat.paper_trading_jours, 0.0)

    def test_lecture_dun_etat_complet(self):
        with TemporaryDirectory() as dossier:
            chemin = _ecrire(Path(dossier), ETAT_COMPLET)
            etat = charger(chemin)
        self.assertTrue(etat.backtest_multi_regimes_fait)
        self.assertEqual(etat.paper_trading_jours, 21.0)
        self.assertTrue(etat.paper_trading_concluant)
        self.assertEqual(etat.valide_par, "Erwann")


class TestPretPourProduction(unittest.TestCase):
    def test_letat_par_defaut_refuse(self):
        """Le cas qui compte le plus : un fichier jamais rempli bloque tout."""

        pret, manques = pret_pour_production(EtatValidation())
        self.assertFalse(pret)
        self.assertGreaterEqual(len(manques), 3)

    def test_letat_complet_autorise(self):
        with TemporaryDirectory() as dossier:
            chemin = _ecrire(Path(dossier), ETAT_COMPLET)
            etat = charger(chemin)
        pret, manques = pret_pour_production(etat)
        self.assertTrue(pret)
        self.assertEqual(manques, [])

    def test_backtest_manquant_refuse_seul(self):
        etat = EtatValidation(
            backtest_multi_regimes_fait=False,
            paper_trading_jours=21.0,
            paper_trading_concluant=True,
            valide_par="Erwann",
        )
        pret, manques = pret_pour_production(etat)
        self.assertFalse(pret)
        self.assertTrue(any("backtest" in m for m in manques))
        self.assertEqual(len(manques), 1)

    def test_paper_trading_trop_court_refuse(self):
        etat = EtatValidation(
            backtest_multi_regimes_fait=True,
            paper_trading_jours=3.0,
            paper_trading_concluant=True,
            valide_par="Erwann",
        )
        pret, manques = pret_pour_production(etat)
        self.assertFalse(pret)
        self.assertTrue(any("plancher" in m for m in manques))

    def test_paper_trading_non_concluant_refuse(self):
        etat = EtatValidation(
            backtest_multi_regimes_fait=True,
            paper_trading_jours=21.0,
            paper_trading_concluant=False,
            valide_par="Erwann",
        )
        pret, manques = pret_pour_production(etat)
        self.assertFalse(pret)
        self.assertTrue(any("concluant" in m for m in manques))

    def test_signature_absente_refuse(self):
        etat = EtatValidation(
            backtest_multi_regimes_fait=True,
            paper_trading_jours=21.0,
            paper_trading_concluant=True,
            valide_par="",
        )
        pret, manques = pret_pour_production(etat)
        self.assertFalse(pret)
        self.assertTrue(any("signé" in m for m in manques))

    def test_plancher_personnalisable(self):
        etat = EtatValidation(
            backtest_multi_regimes_fait=True,
            paper_trading_jours=5.0,
            paper_trading_concluant=True,
            valide_par="Erwann",
        )
        pret, _ = pret_pour_production(etat, jours_minimum=3.0)
        self.assertTrue(pret)


if __name__ == "__main__":
    unittest.main()
