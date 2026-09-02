#!/usr/bin/env python3
"""Ce que le chargeur doit refuser.

Un fichier de patrimoine mal saisi ne produit pas d'erreur : il produit un
tableau plausible. C'est pourquoi la validation est stricte et pourquoi ces
tests portent presque tous sur des **refus** — chacun correspond à une saisie
qui, acceptée, aurait donné un chiffre faux que personne n'aurait vu.
"""

import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from aides import PROFIL, reglages  # noqa: E402
from core.modeles import Classe  # noqa: E402
from core.reglages import CHEMIN_EXEMPLE, ReglagesInvalides, charger, valider  # noqa: E402


class TestCibles(unittest.TestCase):
    def test_des_cibles_qui_ne_font_pas_cent_pour_cent_sont_refusees(self):
        with self.assertRaises(ReglagesInvalides) as capture:
            reglages(profil={"cibles_pct": {"bourse": 50, "crypto": 10, "immobilier": 30}})
        self.assertIn("90", str(capture.exception))

    def test_une_classe_inconnue_est_refusee(self):
        with self.assertRaises(ReglagesInvalides):
            reglages(profil={"cibles_pct": {
                "bourse": 50, "crypto": 10, "immobilier": 30, "obligations": 10}})

    def test_une_classe_absente_des_cibles_vaut_zero(self):
        # Un patrimoine sans immobilier est un cas normal : l'écrire « 0 »
        # serait une cérémonie. La somme, elle, reste vérifiée.
        regles = reglages(profil={"cibles_pct": {"bourse": 60, "crypto": 10, "immobilier": 30}})
        self.assertEqual(regles.profil.cibles_pct[Classe.LIQUIDITES], 0.0)


class TestActifs(unittest.TestCase):
    def test_une_ligne_boursiere_sans_ticker_est_refusee(self):
        with self.assertRaises(ReglagesInvalides):
            reglages(actifs={"bourse": [{"nom": "Monde", "quantite": 10}]})

    def test_une_quantite_negative_est_refusee(self):
        with self.assertRaises(ReglagesInvalides):
            reglages(actifs={"bourse": [
                {"nom": "Monde", "ticker": "CW8.PA", "quantite": -1}]})

    def test_un_credit_negatif_renvoie_vers_le_bon_champ(self):
        with self.assertRaises(ReglagesInvalides) as capture:
            reglages(actifs={"immobilier": [
                {"nom": "Studio", "valeur_estimee_eur": -1000}]})
        self.assertIn("capital_restant_du_eur", str(capture.exception))

    def test_une_quantite_booleenne_est_refusee(self):
        # `True` est un `int` en Python : sans test explicite, « quantite: true »
        # passerait pour la quantité 1 et personne ne verrait rien.
        with self.assertRaises(ReglagesInvalides):
            reglages(actifs={"bourse": [
                {"nom": "Monde", "ticker": "CW8.PA", "quantite": True}]})

    def test_une_classe_d_actifs_inconnue_est_refusee(self):
        with self.assertRaises(ReglagesInvalides):
            valider({"profil": PROFIL, "actifs": {"obligations": []}})


class TestDatesDeCours(unittest.TestCase):
    def test_un_prix_sans_sa_date_est_refuse(self):
        # C'est le refus propre à ce module : un cours dont on ignore l'âge
        # laisse croire que le patrimoine affiché est celui d'aujourd'hui.
        with self.assertRaises(ReglagesInvalides) as capture:
            reglages(actifs={"bourse": [
                {"nom": "Monde", "ticker": "CW8.PA", "quantite": 10, "prix_eur": 500.0}]})
        self.assertIn("releve_le", str(capture.exception))

    def test_une_date_entre_guillemets_est_acceptee(self):
        # YAML rend une date non quotée comme un objet `date` et la même valeur
        # quotée comme une chaîne. Refuser l'une ferait échouer un fichier
        # correct pour une paire de guillemets.
        regles = reglages(actifs={"bourse": [{
            "nom": "Monde", "ticker": "CW8.PA", "quantite": 10,
            "prix_eur": 500.0, "releve_le": "2026-08-31",
        }]})
        self.assertEqual(regles.actifs[Classe.BOURSE][0]["releve_le"], "2026-08-31")

    def test_une_date_illisible_est_refusee(self):
        with self.assertRaises(ReglagesInvalides) as capture:
            reglages(actifs={"bourse": [{
                "nom": "Monde", "ticker": "CW8.PA", "quantite": 10,
                "prix_eur": 500.0, "releve_le": "31/08/2026",
            }]})
        self.assertIn("date ISO", str(capture.exception))

    def test_une_ligne_sans_prix_n_a_pas_besoin_de_date(self):
        # L'inverse est toléré : dater une ligne sans cours ne trompe personne.
        regles = reglages(actifs={"bourse": [
            {"nom": "Monde", "ticker": "CW8.PA", "quantite": 10}]})
        self.assertIsNone(regles.actifs[Classe.BOURSE][0].get("prix_eur"))


class TestSources(unittest.TestCase):
    def test_une_source_inconnue_est_refusee(self):
        with self.assertRaises(ReglagesInvalides) as capture:
            reglages(sources={"binance": "../binance"})
        self.assertIn("binance", str(capture.exception))

    def test_les_chemins_sont_resolus_relativement_au_fichier(self):
        # Et non au répertoire courant : le conseiller se lance aussi bien
        # depuis la racine du dépôt que depuis son propre dossier.
        regles = valider(
            {"profil": PROFIL, "actifs": {}, "sources": {"pepites": "../pepites"}},
            base=Path("/depot/conseiller-patrimoine/config"),
        )
        self.assertEqual(regles.sources.pepites, Path("/depot/conseiller-patrimoine/pepites"))

    def test_une_source_absente_de_la_configuration_vaut_none(self):
        regles = reglages()
        self.assertIsNone(regles.sources.nexuscrypto)


class TestFichier(unittest.TestCase):
    def test_le_fichier_d_exemple_est_valide(self):
        # Il sert de modèle : livré cassé, il ferait perdre une heure au
        # premier essai, et c'est le premier essai qui décide si l'outil sert.
        regles = charger(CHEMIN_EXEMPLE)
        self.assertEqual(sum(regles.profil.cibles_pct.values()), 100.0)

    def test_le_fichier_d_exemple_porte_des_dates_de_cours_reelles(self):
        regles = charger(CHEMIN_EXEMPLE)
        for ligne in regles.actifs[Classe.BOURSE]:
            self.assertIsInstance(ligne["releve_le"], date)

    def test_un_fichier_absent_renvoie_vers_l_exemple(self):
        with self.assertRaises(ReglagesInvalides) as capture:
            charger(CHEMIN_EXEMPLE.parent / "patrimoine.introuvable.yaml")
        self.assertIn(CHEMIN_EXEMPLE.name, str(capture.exception))


if __name__ == "__main__":
    unittest.main()
