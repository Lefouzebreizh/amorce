#!/usr/bin/env python3
"""Ce que le tableau de bord et les alertes doivent tenir.

Deux enjeux : ne jamais alerter trop tard, et ne jamais effacer une décision
prise à la main.
"""

import sys
import unittest
from dataclasses import replace
from datetime import date
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.abonnements import alertes, euros, fusionner, tableau  # noqa: E402
from core.config import charger  # noqa: E402
from core.journal import Journal  # noqa: E402
from core.modele import (  # noqa: E402
    Alerte, Document, Periodicite, StatutAbonnement, StatutAlerte, TypeAlerte,
)

EXEMPLE = Path(__file__).resolve().parents[1] / "admin_config.exemple.json"
LE_JOUR = date(2026, 8, 25)


def configuration(**changements):
    """La configuration d'exemple, éventuellement retouchée pour un cas précis."""
    lue = charger(EXEMPLE)
    for identifiant, reglages in changements.items():
        for index, abonnement in enumerate(lue.abonnements):
            if abonnement.id == identifiant.replace("_", "-"):
                lue.abonnements[index] = replace(abonnement, **reglages)
    return lue


def par_id(liste):
    return {alerte.id: alerte for alerte in liste}


class TableauDeBord(unittest.TestCase):
    def test_le_total_mensuel_ramene_toutes_les_periodicites_au_mois(self):
        self.assertEqual(tableau(configuration(), LE_JOUR).total_mensuel, Decimal("176.21"))

    def test_l_annuel_est_douze_fois_le_mensuel(self):
        etat = tableau(configuration(), LE_JOUR)
        self.assertEqual(etat.total_annuel, Decimal("2114.52"))

    def test_un_contrat_resilie_sort_du_budget_mais_reste_au_fichier(self):
        # L'historique se garde ; le budget, lui, ne paie plus.
        lue = configuration(edf_domicile={"statut": StatutAbonnement.RESILIE})
        etat = tableau(lue, LE_JOUR)
        self.assertEqual(len(lue.abonnements), 4)
        self.assertEqual(len(etat.lignes), 3)
        self.assertEqual(etat.total_mensuel, Decimal("97.79"))

    def test_un_contrat_en_cours_de_resiliation_est_encore_preleve(self):
        lue = configuration(edf_domicile={"statut": StatutAbonnement.EN_RESILIATION})
        self.assertEqual(tableau(lue, LE_JOUR).total_mensuel, Decimal("176.21"))

    def test_les_categories_sortent_de_la_plus_chere_a_la_moins_chere(self):
        # C'est là qu'on cherche où couper.
        categories = list(tableau(configuration(), LE_JOUR).par_categorie)
        self.assertEqual(categories[0], "energie")
        self.assertEqual(categories[-1], "assurance")

    def test_les_lignes_sortent_par_urgence_de_preavis(self):
        lignes = tableau(configuration(), LE_JOUR).lignes
        self.assertEqual([ligne.abonnement.id for ligne in lignes][:3],
                         ["maif-habitation", "orange-fibre", "salle-sport"])

    def test_le_cout_d_un_depart_anticipe_est_chiffre(self):
        # Salle de sport : 29,90 € par mois, engagement jusqu'au 02/02/2027.
        lignes = {ligne.abonnement.id: ligne for ligne in tableau(configuration(), LE_JOUR).lignes}
        self.assertEqual(lignes["salle-sport"].mois_restants, 5)
        self.assertEqual(lignes["salle-sport"].cout_sortie, Decimal("149.50"))

    def test_un_contrat_sans_engagement_ne_coute_rien_a_quitter(self):
        lignes = {ligne.abonnement.id: ligne for ligne in tableau(configuration(), LE_JOUR).lignes}
        self.assertEqual(lignes["edf-domicile"].cout_sortie, Decimal("0"))

    def test_une_assurance_reconduite_depuis_des_annees_ne_coute_rien_non_plus(self):
        # Son engagement s'est terminé en 2022 ; seule sa date anniversaire tourne.
        lignes = {ligne.abonnement.id: ligne for ligne in tableau(configuration(), LE_JOUR).lignes}
        self.assertEqual(lignes["maif-habitation"].cout_sortie, Decimal("0"))
        self.assertEqual(lignes["maif-habitation"].preavis, date(2026, 9, 2))


class CalculDesAlertes(unittest.TestCase):
    def test_l_alerte_porte_la_date_du_preavis_et_non_celle_de_l_echeance(self):
        # Le cœur du module : l'assurance se termine le 01/11, mais après le
        # 02/09 il est trop tard.
        assurance = par_id(alertes(configuration(), LE_JOUR))["maif-habitation-preavis-2026-09-02"]
        self.assertEqual(assurance.echeance, date(2026, 9, 2))
        self.assertIn("01/11/2026", assurance.action)

    def test_l_alerte_dit_comment_resilier_et_pas_seulement_quand(self):
        calculees = par_id(alertes(configuration(), LE_JOUR))
        self.assertIn("Lettre recommandée", calculees["maif-habitation-preavis-2026-09-02"].action)
        self.assertIn("En ligne", calculees["orange-fibre-preavis-2026-09-15"].action)

    def test_un_contrat_sans_preavis_annonce_sa_reconduction_sans_urgence(self):
        lue = configuration(salle_sport={"preavis_jours": 0})
        alerte = [a for a in alertes(lue, LE_JOUR) if a.source.endswith("salle-sport")][0]
        self.assertIs(alerte.type, TypeAlerte.RENOUVELLEMENT)
        self.assertIn("se reconduit", alerte.action)

    def test_un_contrat_a_terme_ferme_annonce_sa_fin_et_non_sa_reconduction(self):
        lue = configuration(salle_sport={"reconduction_tacite": False, "preavis_jours": 0})
        alerte = [a for a in alertes(lue, LE_JOUR) if a.source.endswith("salle-sport")][0]
        self.assertIn("prend fin", alerte.action)

    def test_un_contrat_deja_resilie_n_alerte_plus_sur_son_preavis(self):
        # Et l'alerte déjà inscrite au fichier s'en va avec lui : elle n'a plus d'objet.
        lue = configuration(maif_habitation={"statut": StatutAbonnement.RESILIE})
        identifiants = par_id(alertes(lue, LE_JOUR))
        self.assertNotIn("maif-habitation-preavis-2026-09-02", identifiants)

    def test_un_prelevement_mensuel_ne_declenche_aucune_alerte_de_paiement(self):
        # Trente euros tous les mois ne surprennent personne : ce serait du bruit.
        paiements = [a for a in alertes(configuration(), LE_JOUR) if a.type is TypeAlerte.PAIEMENT]
        self.assertEqual([a.source for a in paiements], ["abonnement:maif-habitation"])

    def test_un_prelevement_annuel_previent_une_semaine_avant(self):
        paiement = par_id(alertes(configuration(), LE_JOUR))["maif-habitation-paiement-2026-11-01"]
        self.assertEqual(paiement.declenchement, date(2026, 10, 25))
        self.assertIn("214,80 €", paiement.action)

    def test_un_prelevement_trimestriel_compte_comme_une_surprise(self):
        lue = configuration(edf_domicile={"periodicite": Periodicite.TRIMESTRIELLE})
        paiements = [a for a in alertes(lue, LE_JOUR) if a.type is TypeAlerte.PAIEMENT]
        self.assertEqual(len(paiements), 2)

    def test_l_identifiant_porte_sa_date_donc_l_annee_suivante_est_une_autre_alerte(self):
        cette_annee = par_id(alertes(configuration(), LE_JOUR))
        annee_suivante = par_id(alertes(configuration(), date(2026, 12, 1)))
        self.assertIn("maif-habitation-preavis-2026-09-02", cette_annee)
        self.assertIn("maif-habitation-preavis-2027-09-02", annee_suivante)


class FusionAvecLeFichier(unittest.TestCase):
    def alerte(self, identifiant, statut=StatutAlerte.OUVERTE, echeance=date(2026, 9, 2)):
        return Alerte(id=identifiant, type=TypeAlerte.PREAVIS, source="abonnement:maif-habitation",
                      echeance=echeance, declenchement=echeance, statut=statut, action="ancienne")

    def test_le_statut_decide_a_la_main_survit_au_recalcul(self):
        ancienne = self.alerte("a", StatutAlerte.REPORTEE)
        fondues = par_id(fusionner([ancienne], [replace(ancienne, statut=StatutAlerte.OUVERTE,
                                                        action="recalculée")], LE_JOUR))
        self.assertIs(fondues["a"].statut, StatutAlerte.REPORTEE)
        self.assertEqual(fondues["a"].action, "recalculée")  # le texte, lui, se rafraîchit

    def test_une_alerte_venue_d_un_document_n_est_pas_emportee_par_le_recalcul(self):
        document = replace(self.alerte("doc-1"), source="document:2026-08-14_EDF_facture")
        fondues = par_id(fusionner([document], [], LE_JOUR))
        self.assertIn("doc-1", fondues)

    def test_une_echeance_ratee_reste_visible_tant_qu_elle_n_est_pas_traitee(self):
        # La faire disparaître, ce serait décider à la place de l'utilisateur.
        ratee = self.alerte("preavis-2025", echeance=date(2025, 9, 2))
        self.assertIn("preavis-2025", par_id(fusionner([ratee], [], LE_JOUR)))

    def test_une_alerte_traitee_et_perimee_quitte_le_fichier(self):
        traitee = self.alerte("preavis-2025", StatutAlerte.TRAITEE, echeance=date(2025, 9, 2))
        self.assertEqual(fusionner([traitee], [], LE_JOUR), [])

    def test_les_alertes_sortent_dans_l_ordre_des_echeances(self):
        tard = replace(self.alerte("b", echeance=date(2026, 12, 1)), source="document:x")
        tot = replace(self.alerte("a", echeance=date(2026, 9, 2)), source="document:y")
        self.assertEqual([a.id for a in fusionner([tard, tot], [], LE_JOUR)], ["a", "b"])

    def test_le_recalcul_est_stable_d_un_passage_a_l_autre(self):
        # Deux exécutions de suite ne doivent pas empiler de doublons.
        lue = configuration()
        premier = alertes(lue, LE_JOUR)
        lue.alertes = premier
        self.assertEqual([a.id for a in alertes(lue, LE_JOUR)], [a.id for a in premier])


class MiseEnForme(unittest.TestCase):
    def test_un_montant_s_ecrit_a_la_francaise(self):
        self.assertEqual(euros(Decimal("214.8")), "214,80 €")

    def test_les_milliers_sont_separes_sinon_le_total_se_relit_deux_fois(self):
        self.assertEqual(euros(Decimal("2114.52")), "2\u202f114,52 €")


if __name__ == "__main__":
    unittest.main()


class DocumentManquant(unittest.TestCase):
    """La facture attendue qui n'arrive pas — l'alerte que le journal débloque."""

    def journal_avec(self, *dates_emission, emetteur="EDF", categorie="energie"):
        registre = Journal(chemin=Path("x"))
        for numero, jour in enumerate(dates_emission):
            registre.inscrire(Document(
                id=f"d{numero}", chemin="x", emetteur=emetteur, categorie=categorie,
                date_emission=jour, empreinte=f"e{numero}"))
        return registre

    def manquants(self, registre, le=LE_JOUR):
        return [a for a in alertes(configuration(), le, journal=registre)
                if a.type is TypeAlerte.DOCUMENT_MANQUANT]

    def test_une_facture_mensuelle_en_retard_declenche_l_alerte(self):
        # Dernière facture le 14/05, période de 31 jours, grâce de 15 : au 25/08
        # il en manque largement une.
        alerte = self.manquants(self.journal_avec(date(2026, 5, 14)))
        self.assertEqual(len(alerte), 1)
        self.assertIn("14/05/2026", alerte[0].action)
        self.assertIn("chaque mois", alerte[0].action)

    def test_le_delai_de_grace_evite_de_crier_au_loup_chaque_mois(self):
        # Une facture mensuelle n'arrive pas le même jour : au trente-cinquième
        # jour, il n'y a encore rien à signaler.
        registre = self.journal_avec(date(2026, 7, 24))
        self.assertEqual(self.manquants(registre, date(2026, 8, 28)), [])

    def test_sans_aucun_document_connu_l_assistant_se_tait(self):
        # Il ne saurait pas distinguer une facture manquante d'un coffre qu'on
        # vient d'ouvrir — et c'est le faux signal qui fait ignorer les vrais.
        self.assertEqual(self.manquants(Journal(chemin=Path("x"))), [])

    def test_un_contrat_qui_n_attend_aucun_document_ne_declenche_rien(self):
        # La salle de sport n'envoie rien : `documents_attendus` y vaut null.
        registre = self.journal_avec(date(2026, 1, 5), emetteur="Fitness Exemple",
                                     categorie="abonnement")
        self.assertEqual(self.manquants(registre), [])

    def test_sans_journal_l_alerte_n_est_ni_calculee_ni_niee(self):
        calculees = [a for a in alertes(configuration(), LE_JOUR)
                     if a.type is TypeAlerte.DOCUMENT_MANQUANT]
        self.assertEqual(calculees, [])


class Conservation(unittest.TestCase):
    """Ce qu'on a le droit de jeter — groupé, et jamais supprimé."""

    def journal_de(self, categorie, annee, combien=3):
        registre = Journal(chemin=Path("x"))
        for mois in range(1, combien + 1):
            registre.inscrire(Document(
                id=f"{categorie}-{annee}-{mois}", chemin="x", emetteur="Orange",
                categorie=categorie, date_emission=date(annee, mois, 5),
                empreinte=f"{categorie}{annee}{mois}"))
        return registre

    def conservations(self, registre, le=LE_JOUR):
        return [a for a in alertes(configuration(), le, journal=registre)
                if a.type is TypeAlerte.CONSERVATION]

    def test_une_annee_perimee_donne_une_seule_alerte_pour_tout_le_groupe(self):
        # Cinq ans de factures font soixante documents : une alerte par document
        # noierait tout le reste.
        trouvees = self.conservations(self.journal_de("telecom", 2020))
        self.assertEqual(len(trouvees), 1)
        self.assertIn("3 document(s)", trouvees[0].action)
        self.assertIn("2020", trouvees[0].action)

    def test_le_groupe_n_expire_qu_avec_son_document_le_plus_recent(self):
        # Mieux vaut garder un an de trop que jeter un justificatif encore utile.
        registre = self.journal_de("telecom", 2025, combien=2)   # conservation : 1 an
        self.assertEqual(self.conservations(registre, date(2026, 2, 1)), [])
        self.assertEqual(len(self.conservations(registre, date(2026, 3, 1))), 1)

    def test_une_categorie_a_garder_a_vie_ne_propose_jamais_de_jeter(self):
        # `travail` porte conservation_annees à null : un bulletin de paie.
        self.assertEqual(self.conservations(self.journal_de("travail", 1995)), [])

    def test_l_alerte_dit_que_rien_n_a_ete_supprime(self):
        trouvees = self.conservations(self.journal_de("telecom", 2020))
        self.assertIn("Rien n'a été supprimé", trouvees[0].action)

    def test_deux_categories_donnent_deux_alertes_distinctes(self):
        registre = self.journal_de("telecom", 2020)
        for mois in (1, 2):
            registre.inscrire(Document(id=f"e{mois}", chemin="x", emetteur="EDF",
                categorie="energie", date_emission=date(2018, mois, 5), empreinte=f"x{mois}"))
        self.assertEqual(len(self.conservations(registre)), 2)

    def test_sans_journal_aucune_conservation_n_est_proposee(self):
        self.assertEqual([a for a in alertes(configuration(), LE_JOUR)
                          if a.type is TypeAlerte.CONSERVATION], [])
