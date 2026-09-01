#!/usr/bin/env python3
"""Le versement d'abord, l'arbitrage ensuite.

C'est la règle qui vaut le plus d'argent du module, et celle qui se casse le
plus discrètement : une répartition d'apport qui laisse un résidu, ou une vente
proposée pour un écart que douze mois de discipline auraient effacé.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from aides import reglages  # noqa: E402
from analyse.conseil import MOIS_DE_PATIENCE, affecter_apport, ventes_restantes  # noqa: E402
from analyse.ecarts import analyser  # noqa: E402
from core.modeles import Classe  # noqa: E402


def _ecarts(totaux):
    profil = reglages().profil
    complet = {classe: 0.0 for classe in Classe}
    complet.update({Classe(nom): float(v) for nom, v in totaux.items()})
    return profil, analyser(complet, profil)


class TestApport(unittest.TestCase):
    def test_l_apport_va_d_abord_a_ce_qui_manque_le_plus(self):
        # Manques : bourse 25 000, crypto 1 000, liquidités 4 000 ;
        # l'immobilier est sur-pondéré et ne reçoit rien — c'est la dilution,
        # qui corrige sans vendre, donc sans impôt.
        _, ecarts = _ecarts(
            {"bourse": 5000, "crypto": 5000, "immobilier": 40000, "liquidites": 10000})
        affectation = affecter_apport(500, ecarts)
        self.assertEqual(affectation[Classe.IMMOBILIER], 0.0)
        self.assertGreater(affectation[Classe.BOURSE], affectation[Classe.LIQUIDITES])
        self.assertAlmostEqual(sum(affectation.values()), 500)

    def test_un_portefeuille_a_la_cible_recoit_l_apport_selon_les_cibles(self):
        _, ecarts = _ecarts(
            {"bourse": 50000, "crypto": 10000, "immobilier": 30000, "liquidites": 10000})
        affectation = affecter_apport(500, ecarts)
        self.assertAlmostEqual(affectation[Classe.BOURSE], 250)
        self.assertAlmostEqual(affectation[Classe.CRYPTO], 50)

    def test_un_apport_plus_gros_que_les_manques_ne_recree_pas_d_ecart(self):
        # Le manque se mesure sur le patrimoine *après* versement. Mesuré
        # avant, cent mille euros retombaient à 49,98 % au lieu de 50.
        totaux = {"bourse": 4900, "crypto": 1000, "immobilier": 3000, "liquidites": 1000}
        profil, ecarts = _ecarts(totaux)
        affectation = affecter_apport(100000, ecarts)
        self.assertAlmostEqual(sum(affectation.values()), 100000)
        apres = {Classe(c): totaux[c] + affectation[Classe(c)] for c in totaux}
        total = sum(apres.values())
        for classe, cible in profil.cibles_pct.items():
            self.assertAlmostEqual(apres[classe] / total * 100, cible, places=6)

    def test_un_apport_nul_n_affecte_rien(self):
        _, ecarts = _ecarts({c.value: 100.0 for c in Classe})
        self.assertEqual(set(affecter_apport(0, ecarts).values()), {0.0})

    def test_un_patrimoine_vide_recoit_l_apport_selon_les_cibles(self):
        # Aucun manque calculable sur un total nul : sans ce cas, la division
        # par la somme des besoins lèverait au tout premier lancement.
        _, ecarts = _ecarts({})
        affectation = affecter_apport(1000, ecarts)
        self.assertAlmostEqual(affectation[Classe.BOURSE], 500)
        self.assertAlmostEqual(sum(affectation.values()), 1000)


class TestVentes(unittest.TestCase):
    def test_rien_a_vendre_si_l_apport_rattrape_dans_l_annee(self):
        # Immobilier à 40 % pour 30 % de cible, mais 6 000 € d'apport annuel
        # sur 25 000 € suffisent à le diluer sous la bande. Proposer une vente
        # ici coûterait un impôt pour rien.
        profil, ecarts = _ecarts(
            {"bourse": 10000, "crypto": 2500, "immobilier": 10000, "liquidites": 2500})
        affectation = affecter_apport(500, ecarts)
        self.assertEqual(ventes_restantes(ecarts, affectation, profil.bande_pct), {})

    def test_un_ecart_que_l_apport_ne_rattrape_pas_reste_a_vendre(self):
        profil, ecarts = _ecarts(
            {"bourse": 100000, "crypto": 100000, "immobilier": 100000, "liquidites": 100000})
        affectation = affecter_apport(500, ecarts)
        self.assertIn(Classe.CRYPTO, ventes_restantes(ecarts, affectation, profil.bande_pct))

    def test_la_patience_est_de_douze_mois(self):
        # La constante est lue par la rédaction pour écrire sa phrase : les
        # deux doivent dire le même nombre.
        self.assertEqual(MOIS_DE_PATIENCE, 12)


if __name__ == "__main__":
    unittest.main()
