#!/usr/bin/env python3
"""Ce que le rapport dit, et surtout ce qu'il se refuse à dire.

Les trois tests qui comptent portent sur des **absences** : pas de conseil sur
un total partiel, pas de tableau d'apport quand il n'y a pas d'apport, et un
« ne rien faire » écrit en toutes lettres plutôt qu'un écran vide.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from aides import AUJOURDHUI, VIEUX, reglages  # noqa: E402
from analyse.redaction import euros, points, pourcent, rediger, rediger_sources  # noqa: E402
from rapport import assembler  # noqa: E402


def _rapport(regles, avec_conseil=True):
    bilan, notes = assembler(regles, AUJOURDHUI)
    return rediger(bilan, regles.profil, notes, avec_conseil=avec_conseil)


class TestEcritureDesNombres(unittest.TestCase):
    def test_les_montants_sont_ecrits_a_la_francaise(self):
        # Espace insécable en séparateur de milliers : un montant coupé en fin
        # de ligne entre ses milliers et ses centaines se relit comme deux
        # nombres, et sur un écran étroit ça arrive.
        self.assertEqual(euros(1234567.89, 2), "1\u00a0234\u00a0567,89\u00a0€")
        self.assertEqual(pourcent(12.34), "12,3\u00a0%")

    def test_un_ecart_se_compte_en_points_avec_son_signe(self):
        # Passer de 50 % à 55 %, c'est cinq points et dix pour cent : les
        # confondre fait raisonner sur des ordres de grandeur faux.
        self.assertEqual(points(-3.25), "-3,2\u00a0pts")
        self.assertEqual(points(3.25), "+3,2\u00a0pts")


class TestReserves(unittest.TestCase):
    def test_ce_qui_manque_se_lit_avant_le_tableau(self):
        # En tête, jamais en pied : un avertissement lu après le conseil arrive
        # quand la décision est déjà prise.
        regles = reglages(actifs={"bourse": [
            {"nom": "Monde", "ticker": "CW8.PA", "quantite": 10}]})
        texte = _rapport(regles)
        position_reserve = texte.index("Total partiel")
        self.assertLess(position_reserve, texte.index("## Positions"))

    def test_aucun_conseil_n_est_donne_sur_un_total_incomplet(self):
        regles = reglages(actifs={"bourse": [
            {"nom": "Monde", "ticker": "CW8.PA", "quantite": 10}]})
        texte = _rapport(regles)
        self.assertIn("Aucun conseil de rééquilibrage", texte)
        self.assertNotIn("Prochain apport", texte)
        self.assertNotIn("il resterait à alléger", texte)

    def test_un_cours_perime_suffit_a_faire_taire_le_conseil(self):
        # Le pendant du cours absent : là on refusait d'inventer un prix, ici
        # on refuse de faire passer celui de l'été dernier pour celui du matin.
        regles = reglages(actifs={"crypto": [{
            "nom": "Bitcoin", "symbole": "BTC", "quantite": 0.1,
            "prix_eur": 50000.0, "releve_le": VIEUX,
        }]})
        texte = _rapport(regles)
        self.assertIn("il y a 92 jours", texte)
        self.assertIn("Aucun conseil de rééquilibrage", texte)

    def test_la_ligne_sans_cours_est_marquee_dans_le_tableau(self):
        regles = reglages(actifs={"bourse": [
            {"nom": "Monde", "ticker": "CW8.PA", "quantite": 10}]})
        self.assertIn("cours absent", _rapport(regles))


class TestConseil(unittest.TestCase):
    def test_un_portefeuille_dans_la_bande_dit_de_ne_rien_faire(self):
        # 5 000 / 5 000 / 40 000 / 10 000 sur 60 000 : la bourse est très
        # au-dessous de sa cible, donc on fabrique ici un cas équilibré.
        regles = reglages(
            profil={"cibles_pct": {
                "bourse": 8, "crypto": 8, "immobilier": 67, "liquidites": 17}},
        )
        texte = _rapport(regles)
        self.assertIn("Ne rien faire est la bonne décision", texte)

    def test_un_ecart_hors_bande_est_nomme_avec_ses_deux_mesures(self):
        texte = _rapport(reglages())
        self.assertIn("Hors de la bande", texte)
        self.assertIn("pts", texte)          # l'écart en points
        self.assertIn("€", texte)            # et ce qu'il représente

    def test_bilan_ne_conseille_jamais_meme_quand_tout_est_vert(self):
        # On regarde parfois où l'on en est sans vouloir qu'on nous dise quoi
        # faire. C'est toute la raison d'être de deux commandes.
        texte = _rapport(reglages(), avec_conseil=False)
        self.assertIn("## Répartition", texte)
        self.assertNotIn("## Conseil", texte)

    def test_sans_apport_aucun_tableau_de_versement(self):
        texte = _rapport(reglages(profil={"apport_mensuel_eur": 0}))
        self.assertNotIn("Prochain apport", texte)


class TestMoteurs(unittest.TestCase):
    def test_les_moteurs_ont_leur_section_hors_des_tableaux(self):
        # Ce qui les tient hors du total : ils parlent après les chiffres, et
        # jamais dedans.
        regles = reglages(sources={"pepites": "/introuvable"})
        bilan, notes = assembler(regles, AUJOURDHUI)
        texte = rediger(bilan, regles.profil, notes)
        self.assertLess(texte.index("## Répartition"), texte.index("## Sources"))

    def test_la_vue_sources_dit_l_etat_de_chacune(self):
        bilan, notes = assembler(reglages(), AUJOURDHUI)
        texte = rediger_sources(bilan, notes)
        for nom in ("saisie", "nexuscrypto", "pepites", "banque"):
            self.assertIn(nom, texte)

    def test_la_banque_apparait_comme_non_branchee_et_non_en_panne(self):
        bilan, notes = assembler(reglages(), AUJOURDHUI)
        self.assertIn("non branchée", rediger_sources(bilan, notes))


if __name__ == "__main__":
    unittest.main()
