#!/usr/bin/env python3
"""Ce que le remplissage d'un PDF doit tenir.

Le formulaire de test est **fabriqué à l'exécution** : ce dépôt ne versionne
aucun binaire, et un Cerfa vierge en est un. Le PDF produit ici a exactement ce
qui compte — un champ texte, une case à cocher, et une page plate pour le second
chemin.
"""

import sys
import tempfile
import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.formulaires import (  # noqa: E402
    ErreurFormulaire, formater, lire_champs, remplir, resoudre,
)
from core.modele import Abonnement, Engagement, Identite, Periodicite  # noqa: E402

MOI = Identite(civilite="Monsieur", nom="Nom", prenom="Prénom", adresse="12 rue de l'Exemple",
               code_postal="35000", ville="Rennes")
CONTRAT = Abonnement(
    id="maif", libelle="Habitation", emetteur="MAIF", categorie="assurance",
    montant=Decimal("214.80"), periodicite=Periodicite.ANNUELLE, reference_client="000000 X",
    engagement=Engagement(debut=date(2021, 11, 1), fin=date(2026, 11, 1), duree_mois=12),
)
CONTEXTE = {"identite": MOI, "abonnement": CONTRAT}
LE_JOUR = date(2026, 8, 25)


def formulaire(dossier: Path) -> Path:
    """Un PDF à champs : un texte, une case à cocher."""
    chemin = dossier / "vierge.pdf"
    document = pymupdf.open()
    page = document.new_page(width=595, height=842)
    page.insert_text((60, 100), "Nom et prénom :", fontname="helv", fontsize=11)
    texte = pymupdf.Widget()
    texte.field_name, texte.field_type = "nom", pymupdf.PDF_WIDGET_TYPE_TEXT
    texte.rect, texte.field_value, texte.text_fontsize = pymupdf.Rect(200, 88, 500, 106), "", 11
    page.add_widget(texte)
    case = pymupdf.Widget()
    case.field_name, case.field_type = "recommande", pymupdf.PDF_WIDGET_TYPE_CHECKBOX
    case.rect, case.field_value = pymupdf.Rect(200, 150, 214, 164), False
    page.add_widget(case)
    document.save(chemin)
    document.close()
    return chemin


def plat(dossier: Path) -> Path:
    """Un PDF sans le moindre champ — un scan, ou une sortie de traitement de texte."""
    chemin = dossier / "plat.pdf"
    document = pymupdf.open()
    page = document.new_page(width=595, height=842)
    page.insert_text((60, 100), "Nom et prénom :", fontname="helv", fontsize=11)
    document.save(chemin)
    document.close()
    return chemin


def texte_de(chemin: Path) -> str:
    document = pymupdf.open(chemin)
    try:
        return "\n".join(page.get_text() for page in document)
    finally:
        document.close()


class MiseEnForme(unittest.TestCase):
    def test_une_date_s_ecrit_comme_l_attend_un_guichet(self):
        self.assertEqual(formater(date(2026, 3, 14)), "14/03/2026")

    def test_un_montant_garde_la_virgule_francaise(self):
        self.assertEqual(formater(Decimal("214.8")), "214,80")


class Resolution(unittest.TestCase):
    def test_un_gabarit_compose_plusieurs_valeurs(self):
        valeurs = resoudre({"nom": "{identite.prenom} {identite.nom}"}, CONTEXTE, LE_JOUR)
        self.assertEqual(valeurs["nom"], "Prénom Nom")

    def test_le_texte_hors_accolades_est_recopie_tel_quel(self):
        valeurs = resoudre({"lieu": "Fait à {identite.ville}, le {@aujourdhui}"}, CONTEXTE, LE_JOUR)
        self.assertEqual(valeurs["lieu"], "Fait à Rennes, le 25/08/2026")

    def test_le_jour_accepte_un_format_explicite(self):
        self.assertEqual(resoudre({"an": "{@aujourdhui:%Y}"}, CONTEXTE, LE_JOUR)["an"], "2026")

    def test_un_chemin_traverse_les_objets_imbriques(self):
        valeurs = resoudre({"fin": "{abonnement.engagement.fin}"}, CONTEXTE, LE_JOUR)
        self.assertEqual(valeurs["fin"], "01/11/2026")

    def test_un_booleen_reste_un_booleen_pour_les_cases(self):
        self.assertIs(resoudre({"case": True}, CONTEXTE, LE_JOUR)["case"], True)

    def test_un_chemin_inconnu_leve_en_nommant_le_champ_du_plan(self):
        # Sur un formulaire, un champ vide et un champ oublié se ressemblent trop.
        with self.assertRaises(ErreurFormulaire) as leve:
            resoudre({"nom": "{identite.nomm}"}, CONTEXTE, LE_JOUR)
        self.assertIn("champ « nom »", str(leve.exception))
        self.assertIn("nomm", str(leve.exception))

    def test_un_contrat_non_designe_dit_ce_qui_est_disponible(self):
        # Le plan parle du contrat, mais aucun contrat n'a été passé : la faute
        # est dans la commande, pas dans le plan.
        with self.assertRaises(ErreurFormulaire) as leve:
            resoudre({"ref": "{abonnement.reference_client}"}, {"identite": MOI}, LE_JOUR)
        self.assertIn("disponible : identite", str(leve.exception))

    def test_un_jeton_inconnu_est_refuse(self):
        with self.assertRaises(ErreurFormulaire):
            resoudre({"date": "{@demain}"}, CONTEXTE, LE_JOUR)


class RemplissageParChamps(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.chemin = Path(self.dossier.name)
        self.vierge = formulaire(self.chemin)
        self.addCleanup(self.dossier.cleanup)

    def test_les_champs_du_pdf_sont_annonces_avec_leur_genre(self):
        releve = {champ.nom: champ.type for champ in lire_champs(self.vierge)}
        self.assertEqual(releve, {"nom": "texte", "recommande": "case"})

    def test_le_texte_rempli_se_retrouve_dans_la_page_une_fois_aplati(self):
        sortie = self.chemin / "rempli.pdf"
        remplir(self.vierge, {"nom": "Prénom Nom"}, sortie)
        self.assertIn("Prénom Nom", texte_de(sortie))

    def test_l_aplatissement_supprime_les_champs_modifiables(self):
        # Un formulaire dont les champs restent vivants s'imprime parfois vierge.
        sortie = self.chemin / "rempli.pdf"
        remplir(self.vierge, {"nom": "Prénom Nom"}, sortie)
        self.assertEqual(lire_champs(sortie), [])

    def test_le_mode_modifiable_conserve_les_champs_et_leur_valeur(self):
        sortie = self.chemin / "modifiable.pdf"
        remplir(self.vierge, {"nom": "Prénom Nom"}, sortie, aplatir=False)
        champs = {champ.nom: champ.valeur_actuelle for champ in lire_champs(sortie)}
        self.assertEqual(champs["nom"], "Prénom Nom")

    def test_une_case_prend_l_etat_declare_par_le_formulaire(self):
        # Le plan dit `true` ; la valeur « cochée » (/Yes ici, /1 ailleurs) est
        # celle que la case elle-même déclare, jamais une constante du code.
        etats = lire_champs(self.vierge)[1].valeurs
        sortie = self.chemin / "coche.pdf"
        remplir(self.vierge, {"recommande": True}, sortie, aplatir=False)
        cochee = [c for c in lire_champs(sortie) if c.nom == "recommande"][0]
        self.assertIn(cochee.valeur_actuelle, etats)

    def test_un_champ_absent_du_pdf_arrete_le_remplissage(self):
        # Un Cerfa qui change de millésime renomme ses champs : neuf sur douze
        # remplis en silence donnent un dossier qui revient trois semaines plus tard.
        with self.assertRaises(ErreurFormulaire) as leve:
            remplir(self.vierge, {"nom": "X", "date_naissance": "01/01/1980"},
                    self.chemin / "rate.pdf")
        self.assertIn("date_naissance", str(leve.exception))
        self.assertIn("nom", str(leve.exception))

    def test_le_formulaire_vierge_ne_peut_pas_etre_ecrase(self):
        with self.assertRaises(ErreurFormulaire):
            remplir(self.vierge, {"nom": "X"}, self.vierge)

    def test_le_vierge_reste_vierge_apres_un_remplissage(self):
        remplir(self.vierge, {"nom": "Prénom Nom"}, self.chemin / "rempli.pdf")
        self.assertNotIn("Prénom Nom", texte_de(self.vierge))


class RemplissageParSurcouche(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.chemin = Path(self.dossier.name)
        self.vierge = plat(self.chemin)
        self.addCleanup(self.dossier.cleanup)

    def test_un_pdf_plat_n_annonce_aucun_champ(self):
        self.assertEqual(lire_champs(self.vierge), [])

    def test_le_texte_est_pose_aux_coordonnees_donnees(self):
        sortie = self.chemin / "rempli.pdf"
        remplir(self.vierge, {"nom": "Prénom Nom"}, sortie,
                positions={"nom": {"page": 1, "rect": [200, 88, 500, 106]}})
        self.assertIn("Prénom Nom", texte_de(sortie))

    def test_les_signes_absents_des_polices_de_base_sont_transposes(self):
        # Mesuré : sans transposition, « Cœur 78,42 € » ressort « C?ur 78,42 ? ».
        sortie = self.chemin / "ligature.pdf"
        remplir(self.vierge, {"nom": "Cœur 78,42 €"}, sortie,
                positions={"nom": {"page": 1, "rect": [60, 200, 500, 220]}})
        releve = texte_de(sortie)
        self.assertIn("Coeur 78,42 EUR", releve)
        self.assertNotIn("?", releve)

    def test_une_case_cochee_pose_une_croix(self):
        sortie = self.chemin / "croix.pdf"
        remplir(self.vierge, {"recommande": True}, sortie,
                positions={"recommande": {"page": 1, "rect": [200, 150, 214, 164]}})
        self.assertIn("X", texte_de(sortie))

    def test_une_case_decochee_ne_pose_rien(self):
        sortie = self.chemin / "vide.pdf"
        remplir(self.vierge, {"recommande": False}, sortie,
                positions={"recommande": {"page": 1, "rect": [200, 150, 214, 164]}})
        self.assertNotIn("X", texte_de(sortie))

    def test_un_texte_qui_ne_tient_pas_dans_le_cadre_leve_plutot_que_de_disparaitre(self):
        # `insert_textbox` ne dessine rien plutôt que de déborder : sans contrôle,
        # le champ sortirait vide sans le moindre message.
        with self.assertRaises(ErreurFormulaire) as leve:
            remplir(self.vierge, {"nom": "Prénom Nom " * 20}, self.chemin / "deborde.pdf",
                    positions={"nom": {"page": 1, "rect": [200, 88, 260, 100]}})
        self.assertIn("ne tient pas", str(leve.exception))

    def test_une_position_incomplete_dit_ce_qui_manque(self):
        with self.assertRaises(ErreurFormulaire) as leve:
            remplir(self.vierge, {"nom": "X"}, self.chemin / "rate.pdf",
                    positions={"nom": {"page": 1}})
        self.assertIn("rect", str(leve.exception))


if __name__ == "__main__":
    unittest.main()
