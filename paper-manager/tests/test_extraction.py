#!/usr/bin/env python3
"""Ce que la lecture des champs d'un document français doit tenir.

Tout est hors réseau : ces motifs sont précisément ce qui permet de se passer
d'un modèle quand aucune clé n'est disponible.
"""

import sys
import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.extraction import (  # noqa: E402
    a_relire, aplatir, champs_de, date_pres_de, dates, extraire, montant_principal,
    montants, nature_de, normaliser, reference_client, ETIQUETTES_ECHEANCE,
)
from core.modele import Document, Nature  # noqa: E402
from core.scan import Lecture  # noqa: E402

LE_JOUR = date(2026, 8, 27)
CONNUS = {
    "EDF": {"categorie": "energie", "motif": r"(?i)\bEDF\b|Électricité de France"},
    "Orange": {"categorie": "telecom", "motif": r"(?i)\bOrange\b"},
}

FACTURE = """EDF — Électricité de France
SIRET 552 081 317 00234   TVA FR03 552081317
FACTURE D'ÉLECTRICITÉ
Référence client : 0123456789
Date de facture : 14/03/2026
Total HT                        65,35 €
Total TTC                    1 234,56 €
Net à payer                     78,42 €
Date limite de paiement : 05/04/2026
Document imprimé le 20/03/2026
"""


class Normalisation(unittest.TestCase):
    def test_l_espace_insecable_des_milliers_est_ramenee(self):
        # Sans cela, « 1 234,56 € » se lit « 234,56 » : un facteur mille, en silence.
        self.assertIn("1 234,56", normaliser("1 234,56 €"))
        self.assertEqual(montants(normaliser("Total 1 234,56 €")), [Decimal("1234.56")])

    def test_l_aplatissement_conserve_les_positions(self):
        # C'est ce qui rend valables dans le texte d'origine les positions
        # trouvées : un aplatissement qui raccourcit décale les fenêtres.
        original = "Référence client : ABC-123"
        self.assertEqual(len(aplatir(original)), len(original))
        self.assertEqual(aplatir(original)[:9], "reference")


class Montants(unittest.TestCase):
    def test_le_montant_etiquete_prime_sur_le_plus_gros(self):
        # La régression à retenir : « Net à payer 78,42 € » doit gagner contre
        # un « Total TTC 1 234,56 € » situé juste au-dessus.
        montant, comment = montant_principal(normaliser(FACTURE))
        self.assertEqual(montant, Decimal("78.42"))
        self.assertEqual(comment, "etiquete")

    def test_sans_etiquette_on_prend_le_plus_grand_et_on_le_dit(self):
        montant, comment = montant_principal(normaliser("Une somme de 42,10 € puis 91,00 €"))
        self.assertEqual(montant, Decimal("91.00"))
        self.assertEqual(comment, "devine")

    def test_les_numeros_administratifs_ne_sont_pas_des_montants(self):
        # Un SIRET, un IBAN ou un numéro de TVA portent des suites de chiffres
        # qui ressemblent à des montants sans en être.
        texte = "SIRET 552 081 317 00234\nIBAN FR76 3000 4000 0312 3456 7890 143\n"
        self.assertEqual(montants(normaliser(texte)), [])

    def test_un_montant_a_sept_chiffres_est_un_numero_mal_decoupe(self):
        self.assertEqual(montants("Ligne 12345678,90"), [])

    def test_un_document_sans_montant_n_en_invente_pas(self):
        montant, comment = montant_principal("Attestation d'assurance habitation")
        self.assertIsNone(montant)
        self.assertEqual(comment, "")


class Dates(unittest.TestCase):
    def test_une_date_francaise_commence_par_le_jour(self):
        # 03/04/2026 est le 3 avril, jamais le 4 mars.
        self.assertEqual(dates("le 03/04/2026", LE_JOUR)[0][0], date(2026, 4, 3))

    def test_la_forme_iso_est_lue_telle_quelle(self):
        trouvee, forme = dates("émis 2026-03-14", LE_JOUR)[0]
        self.assertEqual(trouvee, date(2026, 3, 14))
        self.assertEqual(forme, "iso")

    def test_un_mois_en_toutes_lettres_est_lu(self):
        self.assertEqual(dates("le 1er août 2026", LE_JOUR)[0][0], date(2026, 8, 1))

    def test_une_date_dans_le_futur_n_est_pas_un_document(self):
        self.assertEqual(dates("le 14/03/2030", LE_JOUR), [])

    def test_une_date_d_avant_l_informatique_non_plus(self):
        self.assertEqual(dates("le 14/03/1970", LE_JOUR), [])

    def test_un_31_fevrier_est_ecarte_plutot_que_de_lever(self):
        self.assertEqual(dates("le 31/02/2026", LE_JOUR), [])

    def test_l_echeance_se_lit_derriere_son_etiquette(self):
        trouvee, comment = date_pres_de(normaliser(FACTURE), ETIQUETTES_ECHEANCE, LE_JOUR)
        self.assertEqual(trouvee, date(2026, 4, 5))
        self.assertEqual(comment, "etiquete")


class LectureComplete(unittest.TestCase):
    def champs(self, texte=FACTURE):
        return champs_de(texte, CONNUS, LE_JOUR)

    def test_une_facture_ordinaire_est_lue_de_bout_en_bout(self):
        c = self.champs()
        self.assertEqual(c.emetteur, "EDF")
        self.assertEqual(c.categorie, "energie")
        self.assertIs(c.nature, Nature.FACTURE)
        self.assertEqual(c.montant, Decimal("78.42"))
        self.assertEqual(c.date_emission, date(2026, 3, 14))
        self.assertEqual(c.date_limite, date(2026, 4, 5))
        self.assertEqual(c.reference, "0123456789")

    def test_la_date_d_impression_du_pied_de_page_ne_devient_pas_l_emission(self):
        # Prise pour l'émission, elle range la facture au mauvais mois.
        self.assertEqual(self.champs().date_emission, date(2026, 3, 14))

    def test_un_emetteur_inconnu_reste_vide_plutot_que_devine(self):
        c = champs_de("Facture de la société Truc\nNet à payer 10,00 €", {}, LE_JOUR)
        self.assertEqual(c.emetteur, "")
        self.assertEqual(c.categorie, "divers")

    def test_le_mot_facture_dans_les_conditions_generales_ne_compte_pas(self):
        # Il apparaît dans les conditions générales de presque tout.
        loin = "ATTESTATION D'ASSURANCE\n" + "texte neutre. " * 90 + "facture"
        self.assertIs(nature_de(loin)[0], Nature.ATTESTATION)


class Confiance(unittest.TestCase):
    def test_un_champ_etiquete_vaut_mieux_qu_un_champ_ramasse(self):
        etiquete = champs_de(FACTURE, CONNUS, LE_JOUR).confiance
        ramasse = champs_de("EDF\n78,42 €\n14/03/2026", CONNUS, LE_JOUR).confiance
        self.assertGreater(etiquete, ramasse)

    def test_une_facture_complete_et_reconnue_atteint_la_confiance_maximale(self):
        self.assertEqual(champs_de(FACTURE, CONNUS, LE_JOUR).confiance, 1.0)

    def test_un_document_illisible_ne_promet_rien(self):
        self.assertEqual(champs_de("", CONNUS, LE_JOUR).confiance, 0.0)


class DepuisUneLecture(unittest.TestCase):
    def lecture(self, texte, pages=1):
        return Lecture(chemin=Path("coffre/entree/f.pdf"), format="pdf",
                       empreinte="abc", pages=pages, texte=texte)

    def test_un_scan_sans_texte_n_invente_aucun_champ(self):
        # Les motifs n'ont rien à lire : c'est au modèle de vision de prendre le
        # relais quand une clé existe. Ne rien inventer vaut mieux qu'un
        # champ plausible.
        document = extraire(self.lecture(""), CONNUS, LE_JOUR)
        self.assertEqual(document.confiance, 0.0)
        self.assertIsNone(document.montant)
        self.assertEqual(document.empreinte, "abc")

    def test_une_facture_courte_est_lue_quand_meme(self):
        # Le seuil de `scan.a_du_texte` répond à « faut-il rendre l'image ? »,
        # pas à « faut-il essayer de lire ? ». Une facture de mobile tient en
        # cinq lignes, et la lui refuser la renvoyait à relire alors que tous
        # ses champs étaient là.
        courte = "Orange\nFACTURE\nRéférence client : 987654321\n" \
                 "Date de facture : 02/03/2026\nNet à payer 49,99 €\n"
        document = extraire(self.lecture(courte), CONNUS, LE_JOUR)
        self.assertFalse(self.lecture(courte).a_du_texte)
        self.assertEqual(document.emetteur, "Orange")
        self.assertEqual(document.montant, Decimal("49.99"))
        self.assertGreater(document.confiance, 0.75)

    def test_une_facture_lue_devient_un_document_complet(self):
        document = extraire(self.lecture(FACTURE), CONNUS, LE_JOUR)
        self.assertEqual(document.emetteur, "EDF")
        self.assertEqual(document.montant, Decimal("78.42"))
        self.assertEqual(document.chemin, "coffre/entree/f.pdf")

    def test_ce_qui_manque_est_dit_champ_par_champ(self):
        # « Il manque la date d'émission » se corrige ; « à relire » non.
        manques = a_relire(Document(id="", chemin="x", empreinte="y", confiance=0.2), 0.75)
        self.assertEqual(len(manques), 3)
        self.assertTrue(any("date d'émission" in m for m in manques))

    def test_un_document_complet_ne_reclame_rien(self):
        document = extraire(self.lecture(FACTURE), CONNUS, LE_JOUR)
        self.assertEqual(a_relire(document, 0.75), [])


if __name__ == "__main__":
    unittest.main()
