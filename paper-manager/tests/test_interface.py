#!/usr/bin/env python3
"""Ce que la mise en forme du tableau de bord doit tenir.

Ces tests ne touchent pas Streamlit — c'est tout l'intérêt de `interface/rendu.py`,
et la raison pour laquelle la CI reste à quinze secondes. Ce qui est vérifié ici
n'est jamais un calcul métier : les totaux, les dates de préavis et les alertes
sont vérifiés dans `test_abonnements.py`, et l'écran se contente de les afficher.

L'enjeu est ailleurs : un tableau de bord ne devrait jamais être le premier
programme à tomber en panne, et les deux façons dont celui-ci pourrait le faire
— une division par zéro au premier lancement, une barre qui déborde de sa piste
— ne se voient qu'en production.
"""

import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.config import charger  # noqa: E402
from core.modele import Alerte, StatutAlerte, TypeAlerte  # noqa: E402
from interface.rendu import barre, delai, fraction, libelles  # noqa: E402

EXEMPLE = Path(__file__).resolve().parents[1] / "admin_config.exemple.json"
LE_JOUR = date(2026, 8, 25)


def alerte(echeance: date) -> Alerte:
    return Alerte(
        id="essai", type=TypeAlerte.PREAVIS, source="abonnement:essai",
        echeance=echeance, declenchement=echeance, statut=StatutAlerte.OUVERTE,
    )


class TestFraction(unittest.TestCase):

    def test_une_barre_sans_denominateur_reste_vide_au_lieu_de_planter(self):
        # Le premier lancement sur une machine neuve : aucun contrat, aucune
        # alerte. C'est le seul moment où une pile d'appels serait illisible.
        self.assertEqual(fraction(0, 0), 0.0)

    def test_la_part_est_le_rapport_des_deux_nombres(self):
        self.assertEqual(fraction(1, 4), 0.25)


class TestBarre(unittest.TestCase):

    def test_la_largeur_est_le_pourcentage_de_la_part(self):
        self.assertIn('width:25.0%', barre("À faire", "1 sur 4", 0.25))

    def test_une_part_au_dela_de_un_ne_deborde_pas_de_sa_piste(self):
        # Au-delà de 100 %, le remplissage sort de l'écran par la droite et la
        # mesure devient illisible sur un téléphone.
        self.assertIn('width:100.0%', barre("Trop", "5 sur 4", 1.25))

    def test_une_part_negative_ne_remplit_pas_la_barre(self):
        # Le navigateur avale une largeur négative et rend la règle sans effet :
        # la barre s'afficherait pleine, c'est-à-dire exactement à l'envers.
        self.assertIn('width:0.0%', barre("Rien", "0", -0.4))

    def test_l_intitule_et_la_mesure_sont_tous_deux_affiches(self):
        rendue = barre("À faire aujourd'hui", "1 sur 4", 0.25)
        self.assertIn("À faire aujourd'hui", rendue)
        self.assertIn("1 sur 4", rendue)

    def test_une_barre_chaude_porte_sa_classe_et_une_barre_ordinaire_non(self):
        self.assertIn('pm-part pm-chaud', barre("Retard", "2", 0.5, chaud=True))
        self.assertNotIn('pm-chaud', barre("À venir", "2", 0.5))


class TestDelai(unittest.TestCase):

    def test_une_echeance_passee_se_dit_en_retard(self):
        self.assertEqual(delai(alerte(date(2026, 8, 13)), LE_JOUR), "en retard de 12 j")

    def test_une_echeance_du_jour_se_dit_aujourd_hui(self):
        # « dans 0 j » se lit comme une erreur d'affichage, et « en retard de
        # 0 jours » comme un reproche : le jour même mérite son mot.
        self.assertEqual(delai(alerte(LE_JOUR), LE_JOUR), "aujourd'hui")

    def test_une_echeance_a_venir_se_dit_en_jours_restants(self):
        self.assertEqual(delai(alerte(date(2026, 9, 4)), LE_JOUR), "dans 10 j")


class TestLibelles(unittest.TestCase):

    def test_la_categorie_s_affiche_avec_le_libelle_de_la_configuration(self):
        noms = libelles(charger(EXEMPLE))
        self.assertEqual(noms["energie"], "Énergie et eau")

    def test_une_categorie_sans_libelle_retombe_sur_sa_cle(self):
        # Un tableau de bord ne devrait jamais être le premier à tomber en
        # panne : une case vide vaut mieux qu'une ligne absente.
        lue = charger(EXEMPLE)
        from dataclasses import replace
        categories = dict(lue.classement.categories)
        categories["energie"] = replace(categories["energie"], libelle="")
        classement = replace(lue.classement, categories=categories)
        self.assertEqual(libelles(replace(lue, classement=classement))["energie"], "energie")


if __name__ == "__main__":
    unittest.main()
