#!/usr/bin/env python3
"""Ce que l'assistant doit tenir, sans réseau.

Tout ce qui est vérifié ici est du calcul : validation du fichier de
configuration, valorisation, écarts à la cible, répartition de l'apport. Les
cours sont injectés à la main — le seul moyen d'écrire un test qui donne le
même verdict demain qu'aujourd'hui, et le seul moyen de vérifier ce que
l'assistant affiche quand une source de prix ne répond pas.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from assistant import (  # noqa: E402
    ErreurConfiguration, affecter_apport, analyser, charger, euros, pourcent,
    points, rapport, rendement_net, totaux_par_classe, valider,
    valoriser, ventes_restantes,
)

RACINE = Path(__file__).resolve().parents[1]

BASE = {
    "profil": {
        "appetence_risque": "equilibre",
        "horizon_annees": 15,
        "apport_mensuel": 500,
        "cibles_pct": {"bourse": 50, "crypto": 10, "immobilier": 30, "liquidites": 10},
        "bande_tolerance_pct": 5,
    },
    "actifs": {
        "bourse": [{"nom": "Monde", "ticker": "CW8.PA", "quantite": 10, "pru": 400.0}],
        "crypto": [{"nom": "Bitcoin", "id_coingecko": "bitcoin", "quantite": 0.1, "pru": 30000.0}],
        "immobilier": [{
            "nom": "Studio",
            "valeur_estimee": 100000,
            "capital_restant_du": 60000,
            "loyer_mensuel_brut": 500,
            "charges_annuelles": 1200,
        }],
        "liquidites": [{"nom": "Livret A", "montant": 10000, "taux_annuel_pct": 1.7}],
    },
}

COURS_ACTIONS = {"CW8.PA": 500.0}     # 10 × 500 = 5 000 €
COURS_CRYPTOS = {"bitcoin": 50000.0}  # 0,1 × 50 000 = 5 000 €


def configuration(profil: dict | None = None, actifs: dict | None = None):
    brut = {
        "profil": {**BASE["profil"], **(profil or {})},
        "actifs": {**BASE["actifs"], **(actifs or {})},
    }
    return valider(brut)


class TestValidation(unittest.TestCase):
    def test_des_cibles_qui_ne_font_pas_cent_pour_cent_sont_refusees(self):
        with self.assertRaises(ErreurConfiguration) as capture:
            configuration(profil={"cibles_pct": {"bourse": 50, "crypto": 10, "immobilier": 30}})
        self.assertIn("90", str(capture.exception))

    def test_une_classe_inconnue_est_refusee(self):
        with self.assertRaises(ErreurConfiguration):
            configuration(profil={"cibles_pct": {
                "bourse": 50, "crypto": 10, "immobilier": 30, "obligations": 10}})

    def test_une_classe_absente_des_cibles_vaut_zero(self):
        config = configuration(profil={"cibles_pct": {"bourse": 60, "crypto": 10, "immobilier": 30}})
        self.assertEqual(config.profil.cibles_pct["liquidites"], 0.0)

    def test_une_ligne_boursiere_sans_ticker_est_refusee(self):
        with self.assertRaises(ErreurConfiguration):
            configuration(actifs={"bourse": [{"nom": "Monde", "quantite": 10}]})

    def test_une_quantite_negative_est_refusee(self):
        with self.assertRaises(ErreurConfiguration):
            configuration(actifs={"bourse": [
                {"nom": "Monde", "ticker": "CW8.PA", "quantite": -1}]})

    def test_le_fichier_d_exemple_est_valide(self):
        # Il sert de modèle : livré cassé, il ferait perdre une heure au premier essai.
        self.assertIsNotNone(charger(RACINE / "config.example.json"))

    def test_un_fichier_absent_renvoie_vers_l_exemple(self):
        with self.assertRaises(ErreurConfiguration) as capture:
            charger(RACINE / "config.introuvable.json")
        self.assertIn("config.example.json", str(capture.exception))


class TestValorisation(unittest.TestCase):
    def test_un_bien_compte_pour_sa_valeur_nette_de_credit(self):
        lignes = valoriser(configuration(), COURS_ACTIONS, COURS_CRYPTOS)
        bien = next(ligne for ligne in lignes if ligne.classe == "immobilier")
        self.assertEqual(bien.valeur, 40000.0)

    def test_le_rendement_se_calcule_sur_la_valeur_du_bien_pas_sur_l_apport(self):
        # 500 × 12 − 1 200 = 4 800, sur 100 000 et non sur les 40 000 non financés.
        self.assertAlmostEqual(rendement_net(BASE["actifs"]["immobilier"][0]), 4.8)

    def test_la_plus_value_latente_suit_le_prix_de_revient(self):
        lignes = valoriser(configuration(), COURS_ACTIONS, COURS_CRYPTOS)
        action = next(ligne for ligne in lignes if ligne.classe == "bourse")
        self.assertEqual(action.plus_value, 1000.0)    # (500 − 400) × 10

    def test_un_cours_manquant_laisse_la_ligne_sans_valeur(self):
        lignes = valoriser(configuration(), {}, COURS_CRYPTOS)
        action = next(ligne for ligne in lignes if ligne.classe == "bourse")
        self.assertIsNone(action.valeur)
        self.assertIsNone(action.plus_value)

    def test_un_cours_manquant_ne_compte_pas_pour_zero_dans_le_total(self):
        # Compter zéro afficherait un patrimoine faux sans le dire ; la classe
        # est simplement absente du total, que le rapport annonce partiel.
        totaux = totaux_par_classe(valoriser(configuration(), {}, COURS_CRYPTOS))
        self.assertEqual(totaux["bourse"], 0.0)
        self.assertEqual(totaux["crypto"], 5000.0)


class TestEcarts(unittest.TestCase):
    def ecarts(self, **totaux):
        complet = {"bourse": 0.0, "crypto": 0.0, "immobilier": 0.0, "liquidites": 0.0}
        complet.update(totaux)
        return {e.classe: e for e in analyser(complet, configuration().profil)}

    def test_la_part_se_calcule_sur_le_total_net(self):
        ecarts = self.ecarts(bourse=5000, crypto=5000, immobilier=40000, liquidites=10000)
        self.assertAlmostEqual(ecarts["immobilier"].part_pct, 66.6666, places=3)

    def test_un_ecart_sous_la_bande_ne_declenche_rien(self):
        # 52 % pour une cible de 50 avec une bande de 5 points : on ne touche à rien.
        ecarts = self.ecarts(bourse=52000, crypto=10000, immobilier=28000, liquidites=10000)
        self.assertFalse(ecarts["bourse"].hors_bande)

    def test_un_ecart_egal_a_la_bande_declenche(self):
        ecarts = self.ecarts(bourse=55000, crypto=10000, immobilier=25000, liquidites=10000)
        self.assertTrue(ecarts["bourse"].hors_bande)

    def test_l_ecart_en_euros_dit_combien_il_manque(self):
        ecarts = self.ecarts(bourse=5000, crypto=5000, immobilier=40000, liquidites=10000)
        self.assertAlmostEqual(ecarts["bourse"].ecart_eur, 5000 - 30000)   # 50 % de 60 000

    def test_un_patrimoine_vide_ne_divise_pas_par_zero(self):
        ecarts = self.ecarts()
        self.assertEqual(ecarts["bourse"].part_pct, 0.0)


class TestApport(unittest.TestCase):
    def test_l_apport_va_d_abord_a_ce_qui_manque_le_plus(self):
        totaux = {"bourse": 5000, "crypto": 5000, "immobilier": 40000, "liquidites": 10000}
        config = configuration()
        affectation = affecter_apport(
            500, analyser(totaux, config.profil))
        # Manques : bourse 25 000, crypto 1 000, liquidités 4 000 ; immobilier sur-pondéré.
        self.assertEqual(affectation["immobilier"], 0.0)
        self.assertGreater(affectation["bourse"], affectation["liquidites"])
        self.assertAlmostEqual(sum(affectation.values()), 500)

    def test_un_portefeuille_a_la_cible_recoit_l_apport_selon_les_cibles(self):
        totaux = {"bourse": 50000, "crypto": 10000, "immobilier": 30000, "liquidites": 10000}
        config = configuration()
        affectation = affecter_apport(
            500, analyser(totaux, config.profil))
        self.assertAlmostEqual(affectation["bourse"], 250)
        self.assertAlmostEqual(affectation["crypto"], 50)

    def test_un_apport_plus_gros_que_les_manques_ne_recree_pas_d_ecart(self):
        totaux = {"bourse": 4900, "crypto": 1000, "immobilier": 3000, "liquidites": 1000}
        config = configuration()
        ecarts = analyser(totaux, config.profil)
        affectation = affecter_apport(100000, ecarts)
        self.assertAlmostEqual(sum(affectation.values()), 100000)
        apres = {c: totaux[c] + affectation[c] for c in totaux}
        total = sum(apres.values())
        for classe, cible in config.profil.cibles_pct.items():
            self.assertAlmostEqual(apres[classe] / total * 100, cible, places=6)

    def test_un_apport_nul_n_affecte_rien(self):
        config = configuration()
        ecarts = analyser({c: 100.0 for c in config.profil.cibles_pct}, config.profil)
        self.assertEqual(set(affecter_apport(0, ecarts).values()), {0.0})


class TestVentes(unittest.TestCase):
    def profil_et_ecarts(self, totaux):
        config = configuration()
        return config.profil, analyser(totaux, config.profil)

    def test_rien_a_vendre_si_l_apport_rattrape_dans_l_annee(self):
        # Immobilier à 40 % pour 30 % de cible, mais 6 000 € d'apport annuel
        # sur un patrimoine de 25 000 € suffisent à le diluer sous la bande.
        profil, ecarts = self.profil_et_ecarts(
            {"bourse": 10000, "crypto": 2500, "immobilier": 10000, "liquidites": 2500})
        affectation = affecter_apport(500, ecarts)
        self.assertEqual(ventes_restantes(ecarts, affectation, profil.bande_pct), {})

    def test_un_ecart_que_l_apport_ne_rattrape_pas_reste_a_vendre(self):
        profil, ecarts = self.profil_et_ecarts(
            {"bourse": 100000, "crypto": 100000, "immobilier": 100000, "liquidites": 100000})
        affectation = affecter_apport(500, ecarts)
        self.assertIn("crypto", ventes_restantes(ecarts, affectation, profil.bande_pct))


class TestAffichage(unittest.TestCase):
    def test_les_montants_sont_ecrits_a_la_francaise(self):
        self.assertEqual(euros(1234567.89, 2), "1\u00a0234\u00a0567,89 €")
        self.assertEqual(pourcent(12.34), "12,3 %")
        # Un écart entre deux pourcentages se compte en points, avec son signe.
        self.assertEqual(points(-3.25), "-3,2 pts")

    def test_un_cours_manquant_se_lit_avant_le_tableau(self):
        config = configuration()
        texte = rapport(config, valoriser(config, {}, COURS_CRYPTOS),
                        ["cours introuvable pour CW8.PA"])
        self.assertIn("prix indisponible", texte)
        # En tête, pas en pied : une alerte lue après le conseil arrive trop tard.
        self.assertTrue(texte.startswith("Total partiel"))

    def test_aucun_conseil_n_est_donne_sur_un_total_incomplet(self):
        config = configuration()
        texte = rapport(config, valoriser(config, {}, COURS_CRYPTOS),
                        ["cours introuvable pour CW8.PA"])
        self.assertIn("Aucun conseil de rééquilibrage", texte)
        self.assertNotIn("Prochain apport", texte)
        self.assertNotIn("il resterait à alléger", texte)

    def test_un_portefeuille_a_la_cible_dit_de_ne_rien_faire(self):
        config = configuration()
        lignes = valoriser(config, {"CW8.PA": 6666.67}, {"bitcoin": 133333.0})
        # 66 667 bourse, 13 333 crypto, 40 000 immobilier, 10 000 liquidités :
        # 51 / 10 / 31 / 8 %, les quatre dans la bande de ±5 points.
        texte = rapport(config, lignes, [])
        self.assertIn("Ne rien faire", texte)


if __name__ == "__main__":
    unittest.main()
