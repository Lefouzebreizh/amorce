#!/usr/bin/env python3
"""Le chargement de la configuration.

Ce fichier garde deux choses : que la configuration **livrée** est valide — un
`config.yaml` dont les poids ne somment pas à 100 casserait le démarrage sans
qu'aucun autre test ne le voie — et que le chargeur refuse de démarrer plutôt
que de démarrer de travers.
"""

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import yaml

from aides import RACINE, config

from src.core.config import ConfigurationInvalide, Secrets, charger
from src.core.modeles import Mode


def _ecrire(dossier: Path, contenu: dict) -> Path:
    chemin = dossier / "config.yaml"
    chemin.write_text(yaml.safe_dump(contenu, allow_unicode=True), encoding="utf-8")
    return chemin


def _base() -> dict:
    return yaml.safe_load((RACINE / "config" / "config.yaml").read_text(encoding="utf-8"))


class TestConfigurationLivree(unittest.TestCase):
    def test_le_fichier_livre_est_valide(self):
        charge = config()
        self.assertIs(charge.mode, Mode.SIMULATION)
        self.assertEqual(len(charge.portefeuille.allocation), 5)

    def test_l_allocation_livree_somme_a_cent(self):
        """L'allocation cible du projet : 50 BTC, 20 SOL, 10 ETH, 20 pépites."""

        charge = config()
        somme = sum(l.poids for l in charge.portefeuille.allocation.values())
        somme += charge.portefeuille.reserve_decouverte_poids
        self.assertAlmostEqual(somme, 100.0)
        self.assertAlmostEqual(charge.portefeuille.poids_de("BTC/USDT"), 0.50)
        self.assertAlmostEqual(charge.portefeuille.poids_de("SOL/USDT"), 0.20)
        self.assertAlmostEqual(charge.portefeuille.poids_de("ETH/USDT"), 0.10)

    def test_le_socle_ne_se_vend_pas_sur_signal(self):
        self.assertFalse(config().portefeuille.allocation["BTC/USDT"].vente_sur_signal)


class TestRefus(unittest.TestCase):
    def _charger(self, mutation, **arguments):
        contenu = _base()
        mutation(contenu)
        with TemporaryDirectory() as dossier:
            chemin = _ecrire(Path(dossier), contenu)
            return charger(chemin, chemin_env=Path(dossier) / "absent.env", **arguments)

    def test_allocation_qui_ne_somme_pas_a_cent(self):
        def mutation(contenu):
            contenu["portefeuille"]["allocation"]["BTC/USDT"]["poids"] = 40
        with self.assertRaises(ConfigurationInvalide) as capture:
            self._charger(mutation)
        self.assertTrue(any("somme à" in d for d in capture.exception.defauts))

    def test_poids_de_score_qui_ne_somment_pas_a_un(self):
        def mutation(contenu):
            contenu["strategie"]["poids"]["technique"] = 0.9
        with self.assertRaises(ConfigurationInvalide):
            self._charger(mutation)

    def test_influence_du_score_trop_forte(self):
        """Au-delà d'un tiers, le score domine la zone de valorisation."""

        def mutation(contenu):
            contenu["strategie"]["dca"]["influence_score"] = 0.6
        with self.assertRaises(ConfigurationInvalide) as capture:
            self._charger(mutation)
        self.assertTrue(any("influence_score" in d for d in capture.exception.defauts))

    def test_plancher_hors_bornes(self):
        def mutation(contenu):
            contenu["strategie"]["dca"]["plancher_enveloppe"] = 1.8
        with self.assertRaises(ConfigurationInvalide) as capture:
            self._charger(mutation)
        self.assertTrue(any("plancher_enveloppe" in d for d in capture.exception.defauts))

    def test_ema_non_croissantes(self):
        def mutation(contenu):
            contenu["strategie"]["technique"]["ema_longue"] = 10
        with self.assertRaises(ConfigurationInvalide):
            self._charger(mutation)

    def test_risque_par_position_demesure(self):
        def mutation(contenu):
            contenu["risque"]["risque_par_position"] = 0.5
        with self.assertRaises(ConfigurationInvalide) as capture:
            self._charger(mutation)
        self.assertTrue(any("cinq pertes" in d for d in capture.exception.defauts))

    def test_mode_reel_sans_cle_refuse(self):
        """Sans cette vérification, l'absence de clé ne lève qu'au premier
        ordre — c'est-à-dire après que la stratégie a déjà décidé."""

        with self.assertRaises(ConfigurationInvalide) as capture:
            self._charger(lambda contenu: None, mode=Mode.REEL)
        self.assertTrue(any("Mode réel" in d for d in capture.exception.defauts))

    def test_canal_telegram_sans_jeton_refuse(self):
        def mutation(contenu):
            contenu["notifications"]["canaux"] = ["console", "telegram"]
        with self.assertRaises(ConfigurationInvalide):
            self._charger(mutation)

    def test_canal_inconnu_refuse(self):
        def mutation(contenu):
            contenu["notifications"]["canaux"] = ["pigeon"]
        with self.assertRaises(ConfigurationInvalide):
            self._charger(mutation)

    def test_tous_les_defauts_sont_rendus_ensemble(self):
        """Corriger un fichier en cinq relances parce qu'il ne signale qu'une
        erreur à la fois se paie à chaque installation."""

        def mutation(contenu):
            contenu["portefeuille"]["allocation"]["BTC/USDT"]["poids"] = 40
            contenu["strategie"]["poids"]["technique"] = 0.9
            contenu["portefeuille"]["cadence_dca"] = "trimestrielle"
        with self.assertRaises(ConfigurationInvalide) as capture:
            self._charger(mutation)
        self.assertGreaterEqual(len(capture.exception.defauts), 3)

    def test_fichier_absent(self):
        with self.assertRaises(ConfigurationInvalide):
            charger(RACINE / "config" / "inexistant.yaml")


class TestSecrets(unittest.TestCase):
    def test_le_repr_ne_fuite_rien(self):
        """Un `logger.debug(config)` bien intentionné a déjà suffi, ailleurs, à
        publier un jeton dans un fichier de journal ensuite envoyé en pièce
        jointe."""

        secrets = Secrets({"TELEGRAM_BOT_TOKEN": "123456:AAdécouvertBienCaché"})
        self.assertNotIn("AAdécouvert", repr(secrets))
        self.assertIn("masqué", repr(secrets))

    def test_lecture_du_env(self):
        with TemporaryDirectory() as dossier:
            env = Path(dossier) / ".env"
            env.write_text(
                "# commentaire\nBINANCE_API_KEY=\"abc\"\nBINANCE_API_SECRET='def'\n"
                "LIGNE_SANS_EGAL\n",
                encoding="utf-8",
            )
            charge = charger(RACINE / "config" / "config.yaml", chemin_env=env)
            self.assertEqual(charge.secrets.get("BINANCE_API_KEY"), "abc")
            self.assertEqual(charge.secrets.get("BINANCE_API_SECRET"), "def")
            self.assertIsNone(charge.secrets.get("ABSENT"))


if __name__ == "__main__":
    unittest.main()
