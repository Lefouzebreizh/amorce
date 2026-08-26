#!/usr/bin/env python3
"""Ce que le courrier de résiliation doit tenir.

Deux enjeux : que la lettre porte les mentions sans lesquelles elle se fait
classer sans suite, et qu'elle n'affirme rien de faux — ni une date d'effet que
son texte contredit, ni un courrier reçu qui n'est pas arrivé.
"""

import sys
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from datetime import date

import pymupdf

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.config import charger  # noqa: E402
from core.resiliation import (  # noqa: E402
    ErreurCourrier, avis_tardif, choisir_gabarit, composer, controler,
    date_effet, fondement, part_au_terme, rendre_pdf,
)

EXEMPLE = Path(__file__).resolve().parents[1] / "admin_config.exemple.json"
LE_JOUR = date(2026, 8, 26)


def lu():
    return charger(EXEMPLE)


def contrat(identifiant="maif-habitation", **changements):
    abonnement = lu().abonnement(identifiant)
    return replace(abonnement, **changements) if changements else abonnement


class DateDEffet(unittest.TestCase):
    def test_tant_que_le_preavis_tient_on_part_au_terme(self):
        # C'est la voie qui ne coûte ni mois supplémentaire ni pénalité.
        self.assertTrue(part_au_terme(contrat(), LE_JOUR))
        self.assertEqual(date_effet(contrat(), LE_JOUR), date(2026, 11, 1))

    def test_le_preavis_passe_l_effet_est_a_un_mois(self):
        apres = date(2026, 9, 10)
        self.assertFalse(part_au_terme(contrat(), apres))
        self.assertEqual(date_effet(contrat(), apres), date(2026, 10, 10))

    def test_un_contrat_sans_terme_part_a_un_mois(self):
        self.assertEqual(date_effet(contrat("edf-domicile"), LE_JOUR), date(2026, 9, 26))


class AvisDEcheance(unittest.TestCase):
    def test_un_avis_annonce_pour_plus_tard_ne_fonde_aucun_droit(self):
        # Sans ce contrôle, la lettre affirme avoir reçu un courrier qui n'est
        # pas arrivé — de quoi la faire écarter d'un revers.
        self.assertFalse(avis_tardif(contrat(date_avis_echeance=date(2026, 9, 20)), LE_JOUR))

    def test_un_avis_recu_trop_tard_rouvre_le_droit(self):
        # Préavis au 02/09 : un avis reçu le 25/08 laisse huit jours, moins que
        # les quinze exigés.
        tardif = contrat(date_avis_echeance=date(2026, 8, 25))
        self.assertTrue(avis_tardif(tardif, LE_JOUR))

    def test_un_avis_recu_en_temps_utile_ne_change_rien(self):
        self.assertFalse(avis_tardif(contrat(date_avis_echeance=date(2026, 6, 1)), LE_JOUR))

    def test_sans_avis_note_la_question_ne_se_pose_pas(self):
        self.assertFalse(avis_tardif(contrat(date_avis_echeance=None), LE_JOUR))


class ChoixDuGabarit(unittest.TestCase):
    def test_un_avis_tardif_prime_sur_tout_le_reste(self):
        tardif = contrat(date_avis_echeance=date(2026, 8, 25))
        self.assertEqual(choisir_gabarit(tardif, LE_JOUR), "resiliation_avis_tardif")

    def test_tant_que_le_preavis_tient_on_ecrit_a_l_echeance(self):
        self.assertEqual(choisir_gabarit(contrat(), LE_JOUR), "resiliation_echeance")

    def test_une_assurance_hors_delai_passe_a_la_resiliation_infra_annuelle(self):
        self.assertEqual(choisir_gabarit(contrat(), date(2026, 9, 10)),
                         "resiliation_infra_annuelle")

    def test_un_contrat_sans_preavis_prend_le_texte_neutre(self):
        self.assertEqual(choisir_gabarit(contrat("edf-domicile"), LE_JOUR), "resiliation_simple")

    def test_le_texte_invoque_depend_de_qui_est_en_face(self):
        # Citer le code des assurances à une salle de sport affaiblit
        # précisément la lettre qu'on voulait rendre opposable.
        self.assertIn("code des assurances",
                      fondement(contrat(), "resiliation_avis_tardif"))
        self.assertIn("code de la consommation",
                      fondement(contrat("salle-sport"), "resiliation_avis_tardif"))
        self.assertIn("sécurité sociale",
                      fondement(contrat(categorie="sante"), "resiliation_infra_annuelle"))


class MentionsObligatoires(unittest.TestCase):
    def test_le_courrier_produit_les_porte_toutes(self):
        courrier = composer(lu(), contrat(), LE_JOUR)
        self.assertEqual(controler(courrier, contrat()), [])

    def test_une_reference_client_absente_arrete_la_production(self):
        # Une lettre sans référence client se fait classer sans suite.
        sans = contrat(reference_client="")
        with self.assertRaises(ErreurCourrier) as leve:
            composer(lu(), sans, LE_JOUR)
        self.assertIn("la référence client", str(leve.exception))

    def test_un_gabarit_inconnu_dit_lesquels_existent(self):
        with self.assertRaises(ErreurCourrier) as leve:
            composer(lu(), contrat(), LE_JOUR, gabarit="resiliation_inventee")
        self.assertIn("resiliation_simple", str(leve.exception))


class CoherenceDesTextes(unittest.TestCase):
    def test_chaque_contrat_et_chaque_date_donnent_un_courrier_complet(self):
        # Le contrôle des mentions lève si le gabarit choisi contredit la date
        # d'effet calculée : ce balayage est la garde contre cette incohérence.
        configuration = lu()
        for jour in (date(2026, 8, 26), date(2026, 9, 10), date(2026, 12, 1), date(2027, 2, 1)):
            for abonnement in configuration.abonnements:
                with self.subTest(contrat=abonnement.id, jour=jour):
                    courrier = composer(configuration, abonnement, jour)
                    self.assertIn(f"{courrier.date_effet:%d/%m/%Y}",
                                  f"{courrier.objet}\n{courrier.corps}")

    def test_le_motif_donne_remplace_la_formule_par_defaut(self):
        courrier = composer(lu(), contrat("edf-domicile"), LE_JOUR, motif="un déménagement")
        self.assertNotIn("{motif}", courrier.corps)


class MiseEnPage(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.addCleanup(self.dossier.cleanup)
        self.chemin = Path(self.dossier.name) / "lettre.pdf"

    def texte(self, courrier=None, identite=None):
        configuration = lu()
        courrier = courrier or composer(configuration, contrat(), LE_JOUR)
        rendre_pdf(courrier, identite or configuration.identite, self.chemin)
        document = pymupdf.open(self.chemin)
        try:
            return "\n".join(page.get_text() for page in document)
        finally:
            document.close()

    def test_la_lettre_porte_l_expediteur_le_destinataire_et_l_objet(self):
        rendu = self.texte()
        self.assertIn("Prénom NOM", rendu)
        self.assertIn("MAIF", rendu)
        self.assertIn("Résiliation", rendu)

    def test_la_mention_du_recommande_est_visible_quand_elle_s_impose(self):
        self.assertIn("recommandée avec accusé de réception", self.texte())

    def test_un_contrat_sans_recommande_n_en_porte_pas_la_mention(self):
        courrier = composer(lu(), contrat("edf-domicile"), LE_JOUR)
        self.assertNotIn("recommandée avec accusé", self.texte(courrier))

    def test_la_lettre_est_datee_du_jour_de_sa_composition(self):
        # Tout le corps est calculé à cette date : une lettre datée d'un autre
        # jour que ses propres délais se contredit.
        courrier = composer(lu(), contrat(), date(2026, 9, 10))
        self.assertIn("le 10/09/2026", self.texte(courrier))

    def test_une_place_est_laissee_pour_la_signature(self):
        self.assertIn("Signature", self.texte())

    def test_les_signes_absents_des_polices_de_base_sont_transposes(self):
        # Mesuré ailleurs : sans transposition, « € » ressort « ? ».
        courrier = composer(lu(), contrat(libelle="Assurance habitation & cœur 214,80 €"), LE_JOUR)
        rendu = self.texte(courrier)
        self.assertIn("coeur", rendu)
        self.assertIn("EUR", rendu)
        self.assertNotIn("?", rendu)


if __name__ == "__main__":
    unittest.main()
