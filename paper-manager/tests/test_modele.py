#!/usr/bin/env python3
"""Ce que l'arithmétique des contrats doit tenir.

Tout est ici du calcul de dates : c'est la partie du projet qui décide si une
alerte tombe à temps, et la seule qu'on puisse vérifier sans rien autour.
"""

import sys
import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.modele import (  # noqa: E402
    Abonnement, Alerte, Engagement, Periodicite, StatutAlerte, TypeAlerte, ajouter_mois,
)


def contrat(**reglages) -> Abonnement:
    base = dict(id="c", libelle="Contrat", emetteur="Exemple", categorie="divers")
    return Abonnement(**{**base, **reglages})


class AjouterMois(unittest.TestCase):
    def test_un_mois_ordinaire_avance_du_meme_jour(self):
        self.assertEqual(ajouter_mois(date(2026, 3, 14), 1), date(2026, 4, 14))

    def test_le_31_janvier_plus_un_mois_tombe_en_fin_de_fevrier(self):
        self.assertEqual(ajouter_mois(date(2026, 1, 31), 1), date(2026, 2, 28))
        self.assertEqual(ajouter_mois(date(2024, 1, 31), 1), date(2024, 2, 29))

    def test_douze_mois_passent_a_l_annee_suivante(self):
        self.assertEqual(ajouter_mois(date(2026, 11, 1), 12), date(2027, 11, 1))

    def test_le_rabotage_ne_se_propage_pas_d_un_appel_a_l_autre(self):
        # Deux fois un mois depuis le 31 janvier n'est pas la même chose que deux
        # mois : c'est pourquoi l'échéance se recalcule toujours depuis l'origine.
        self.assertEqual(ajouter_mois(date(2026, 1, 31), 2), date(2026, 3, 31))


class ProchaineEcheance(unittest.TestCase):
    def test_un_contrat_sans_terme_n_a_pas_d_echeance(self):
        self.assertIsNone(contrat().prochaine_echeance(date(2026, 8, 25)))

    def test_un_contrat_a_terme_ferme_perd_son_echeance_une_fois_passee(self):
        echu = contrat(engagement=Engagement(fin=date(2026, 1, 1)), reconduction_tacite=False)
        self.assertIsNone(echu.prochaine_echeance(date(2026, 8, 25)))

    def test_une_reconduction_tacite_avance_l_echeance_sans_toucher_au_fichier(self):
        # Le cas qui justifie le calcul : une configuration saisie en 2021 doit
        # encore donner la bonne date cinq ans plus tard.
        assurance = contrat(
            engagement=Engagement(debut=date(2021, 11, 1), fin=date(2021, 11, 1), duree_mois=12),
            reconduction_tacite=True,
        )
        self.assertEqual(assurance.prochaine_echeance(date(2026, 8, 25)), date(2026, 11, 1))

    def test_l_echeance_du_jour_meme_reste_l_echeance(self):
        contrat_ = contrat(
            engagement=Engagement(fin=date(2026, 11, 1), duree_mois=12), reconduction_tacite=True
        )
        self.assertEqual(contrat_.prochaine_echeance(date(2026, 11, 1)), date(2026, 11, 1))


class DatesDAlerte(unittest.TestCase):
    def test_le_preavis_recule_l_echeance_du_nombre_de_jours_du_contrat(self):
        assurance = contrat(
            engagement=Engagement(fin=date(2026, 11, 1), duree_mois=12),
            reconduction_tacite=True, preavis_jours=60,
        )
        self.assertEqual(assurance.date_preavis(date(2026, 8, 25)), date(2026, 9, 2))

    def test_l_alerte_precede_le_preavis_et_non_l_echeance(self):
        assurance = contrat(
            engagement=Engagement(fin=date(2026, 11, 1), duree_mois=12),
            reconduction_tacite=True, preavis_jours=60, alerte_avant_jours=90,
        )
        self.assertEqual(assurance.date_alerte(date(2026, 1, 1), 45), date(2026, 6, 4))

    def test_sans_reglage_propre_l_avance_par_defaut_s_applique(self):
        contrat_ = contrat(
            engagement=Engagement(fin=date(2026, 11, 1), duree_mois=12),
            reconduction_tacite=True, preavis_jours=0,
        )
        self.assertEqual(contrat_.date_alerte(date(2026, 1, 1), 45), date(2026, 9, 17))


class CoutDuContrat(unittest.TestCase):
    def test_un_montant_annuel_se_ramene_au_mois(self):
        annuel = contrat(montant=Decimal("214.80"), periodicite=Periodicite.ANNUELLE)
        self.assertEqual(annuel.montant_mensuel, Decimal("17.90"))

    def test_un_paiement_unique_ne_pese_sur_aucun_mois(self):
        self.assertEqual(contrat(montant=Decimal("90"), periodicite=Periodicite.UNIQUE).montant_mensuel,
                         Decimal("0"))

    def test_le_total_reste_exact_au_centime(self):
        # Le motif du choix de Decimal : en float, ce total affiche 89.97000000000001.
        contrats = [contrat(montant=Decimal("29.99")) for _ in range(3)]
        self.assertEqual(sum(c.montant_mensuel for c in contrats), Decimal("89.97"))

    def test_les_mois_restants_chiffrent_ce_que_coute_un_depart(self):
        engagement = Engagement(debut=date(2026, 2, 2), fin=date(2027, 2, 2), duree_mois=12)
        self.assertEqual(engagement.mois_restants(date(2026, 8, 25)), 5)
        self.assertEqual(engagement.mois_restants(date(2027, 3, 1)), 0)


class VisibiliteDesAlertes(unittest.TestCase):
    def alerte(self, statut):
        return Alerte(
            id="a", type=TypeAlerte.PREAVIS, source="abonnement:c",
            echeance=date(2026, 9, 2), declenchement=date(2026, 8, 3), statut=statut,
        )

    def test_une_alerte_ouverte_apparait_a_son_declenchement(self):
        ouverte = self.alerte(StatutAlerte.OUVERTE)
        self.assertFalse(ouverte.visible(date(2026, 8, 2)))
        self.assertTrue(ouverte.visible(date(2026, 8, 3)))

    def test_une_alerte_traitee_ne_revient_jamais(self):
        self.assertFalse(self.alerte(StatutAlerte.TRAITEE).visible(date(2026, 12, 31)))

    def test_une_alerte_reportee_revient_a_son_echeance(self):
        reportee = self.alerte(StatutAlerte.REPORTEE)
        self.assertFalse(reportee.visible(date(2026, 8, 30)))
        self.assertTrue(reportee.visible(date(2026, 9, 2)))


if __name__ == "__main__":
    unittest.main()
