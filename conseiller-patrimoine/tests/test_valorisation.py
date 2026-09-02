#!/usr/bin/env python3
"""La valorisation, et les trois refus qui l'empêchent de mentir.

Les cours sont injectés par le fichier de réglages, jamais relevés : c'est ce
qui rend ces tests reproductibles, et c'est aussi la seule façon de vérifier ce
que le conseiller affiche quand un cours manque.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from aides import ACTIFS, AUJOURDHUI, HIER, VIEUX, reglages  # noqa: E402
from analyse.valorisation import (  # noqa: E402
    lignes_perimees, lignes_sans_prix, rendement_net, totaux_par_classe, valoriser,
)
from core.modeles import Classe  # noqa: E402


def _ligne(lignes, classe):
    return next(ligne for ligne in lignes if ligne.classe is classe)


class TestImmobilier(unittest.TestCase):
    def test_un_bien_compte_pour_sa_valeur_nette_de_credit(self):
        bien = _ligne(valoriser(reglages()), Classe.IMMOBILIER)
        self.assertEqual(bien.valeur_eur, 40000.0)   # 100 000 − 60 000

    def test_le_credit_reste_visible_a_cote_de_l_estimation(self):
        # Pour ne pas perdre l'effet de levier de vue : la valeur nette seule
        # ferait disparaître un bien de 148 000 € derrière 71 500 €.
        bien = _ligne(valoriser(reglages()), Classe.IMMOBILIER)
        self.assertIn("crédit", bien.detail)

    def test_le_rendement_se_calcule_sur_la_valeur_du_bien_pas_sur_l_apport(self):
        # 500 × 12 − 1 200 = 4 800, sur 100 000 et non sur les 40 000 non financés.
        self.assertAlmostEqual(rendement_net(ACTIFS["immobilier"][0]), 4.8)

    def test_un_bien_sans_valeur_ne_divise_pas_par_zero(self):
        self.assertIsNone(rendement_net({"valeur_estimee_eur": 0}))


class TestLignesCotees(unittest.TestCase):
    def test_la_plus_value_latente_suit_le_prix_de_revient(self):
        action = _ligne(valoriser(reglages()), Classe.BOURSE)
        self.assertEqual(action.plus_value_eur, 1000.0)      # (500 − 400) × 10

    def test_la_crypto_recoit_le_meme_traitement_que_la_bourse(self):
        # Les deux passent par la même fabrique : c'est ce qui empêche la
        # plus-value d'être calculée d'un côté et oubliée de l'autre.
        crypto = _ligne(valoriser(reglages()), Classe.CRYPTO)
        self.assertEqual(crypto.valeur_eur, 5000.0)
        self.assertAlmostEqual(crypto.plus_value_eur, 2000.0)  # (50 000 − 30 000) × 0,1

    def test_un_cours_manquant_laisse_la_ligne_sans_valeur(self):
        regles = reglages(actifs={"bourse": [
            {"nom": "Monde", "ticker": "CW8.PA", "quantite": 10, "pru_eur": 400.0}]})
        action = _ligne(valoriser(regles), Classe.BOURSE)
        self.assertIsNone(action.valeur_eur)
        self.assertIsNone(action.plus_value_eur)


class TestTotaux(unittest.TestCase):
    def test_un_cours_manquant_ne_compte_pas_pour_zero(self):
        # C'est la décision la plus importante du module : compter zéro
        # afficherait un patrimoine faux avec l'aplomb d'un patrimoine juste.
        regles = reglages(actifs={"bourse": [
            {"nom": "Monde", "ticker": "CW8.PA", "quantite": 10}]})
        totaux = totaux_par_classe(valoriser(regles))
        self.assertEqual(totaux[Classe.BOURSE], 0.0)
        self.assertEqual(totaux[Classe.CRYPTO], 5000.0)

    def test_une_ligne_sans_prix_est_signalee_nommement(self):
        regles = reglages(actifs={"bourse": [
            {"nom": "Monde", "ticker": "CW8.PA", "quantite": 10}]})
        sans_prix = lignes_sans_prix(valoriser(regles))
        self.assertEqual([ligne.nom for ligne in sans_prix], ["Monde"])

    def test_le_patrimoine_d_exemple_tombe_sur_ses_nombres_ronds(self):
        totaux = totaux_par_classe(valoriser(reglages()))
        self.assertEqual(totaux[Classe.BOURSE], 5000.0)
        self.assertEqual(totaux[Classe.IMMOBILIER], 40000.0)
        self.assertEqual(totaux[Classe.LIQUIDITES], 10000.0)


class TestFraicheur(unittest.TestCase):
    def test_un_cours_du_jour_n_est_pas_perime(self):
        vieilles = lignes_perimees(valoriser(reglages()), AUJOURDHUI, 30)
        self.assertEqual(vieilles, ())

    def test_un_cours_trop_vieux_est_releve_avec_son_age(self):
        # L'âge accompagne la ligne : « Bitcoin daté » ne dit pas s'il faut
        # ressaisir maintenant ou si c'était hier soir.
        regles = reglages(actifs={"crypto": [{
            "nom": "Bitcoin", "symbole": "BTC", "quantite": 0.1,
            "prix_eur": 50000.0, "releve_le": VIEUX,
        }]})
        vieilles = lignes_perimees(valoriser(regles), AUJOURDHUI, 30)
        self.assertEqual(len(vieilles), 1)
        ligne, age = vieilles[0]
        self.assertEqual(ligne.nom, "Bitcoin")
        self.assertEqual(age, 92)

    def test_un_cours_perime_garde_sa_valeur(self):
        # Il est daté, pas faux : le retirer du total inventerait un patrimoine
        # plus petit. C'est le bilan qui bascule en partiel, pas la ligne.
        regles = reglages(actifs={"crypto": [{
            "nom": "Bitcoin", "symbole": "BTC", "quantite": 0.1,
            "prix_eur": 50000.0, "releve_le": VIEUX,
        }]})
        crypto = _ligne(valoriser(regles), Classe.CRYPTO)
        self.assertEqual(crypto.valeur_eur, 5000.0)

    def test_une_ligne_sans_date_ne_perime_jamais(self):
        # Un livret ou un bien immobilier ne se périment pas comme un cours.
        liquidites = _ligne(valoriser(reglages()), Classe.LIQUIDITES)
        self.assertIsNone(liquidites.age_jours(AUJOURDHUI))
        self.assertEqual(lignes_perimees((liquidites,), AUJOURDHUI, 0), ())

    def test_l_age_se_compte_depuis_la_date_de_releve(self):
        action = _ligne(valoriser(reglages()), Classe.BOURSE)
        self.assertEqual(action.age_jours(AUJOURDHUI), (AUJOURDHUI - HIER).days)


if __name__ == "__main__":
    unittest.main()
