#!/usr/bin/env python3
"""Ce que le nom d'un document classé doit tenir.

Ce module est pur : aucun test n'écrit sur le disque. C'est voulu — le nom se
calcule, le déplacement est une autre affaire.
"""

import sys
import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.modele import Document, Nature  # noqa: E402
from core.nommage import (  # noqa: E402
    ErreurNommage, assainir, aujourdhui_est_plausible, destination, dossier_de,
    libre, montant_en_nom, nom_de,
)

MODELE_NOM = "{date}_{emetteur}_{nature}_{montant}"
MODELE_DOSSIER = "{annee}/{categorie}"


def document(**changements) -> Document:
    base = dict(
        id="x", chemin="coffre/entree/f.pdf", nature=Nature.FACTURE,
        emetteur="Électricité de France", categorie="energie",
        montant=Decimal("78.42"), date_emission=date(2026, 3, 14),
        reference="0000000000", empreinte="abc",
    )
    return Document(**{**base, **changements})


class Assainir(unittest.TestCase):
    def test_les_accents_sont_deplies_et_non_supprimes(self):
        # « Electricite » se retrouve à la recherche ; « lectricit » non.
        self.assertEqual(assainir("Électricité"), "Electricite")

    def test_les_espaces_et_la_ponctuation_deviennent_un_seul_tiret(self):
        self.assertEqual(assainir("Crédit  Agricole, S.A."), "Credit-Agricole-S-A")

    def test_un_libelle_trop_long_est_coupe_sans_finir_sur_un_tiret(self):
        long = assainir("Direction générale des Finances publiques")
        self.assertLessEqual(len(long), 40)
        self.assertFalse(long.endswith("-"))

    def test_le_resultat_survit_a_une_cle_usb(self):
        propre = assainir("Facture n°12 — été 2026 (copie)")
        self.assertTrue(all(c.isalnum() or c == "-" for c in propre), propre)


class Nom(unittest.TestCase):
    def test_la_date_vient_en_premier_pour_que_le_tri_soit_chronologique(self):
        self.assertTrue(nom_de(document(), MODELE_NOM).startswith("2026-03-14_"))

    def test_le_nom_complet_porte_ce_qu_on_cherche_sans_ouvrir_le_fichier(self):
        self.assertEqual(nom_de(document(), MODELE_NOM),
                         "2026-03-14_Electricite-de-France_facture_78-42EUR.pdf")

    def test_la_virgule_decimale_devient_un_tiret(self):
        # Elle casse les exports CSV et certains outils de synchronisation.
        self.assertEqual(montant_en_nom(Decimal("1234.50")), "1234-50EUR")

    def test_un_document_sans_montant_n_ecrit_pas_None(self):
        nom = nom_de(document(montant=None), MODELE_NOM)
        self.assertNotIn("None", nom)
        self.assertEqual(nom, "2026-03-14_Electricite-de-France_facture.pdf")

    def test_un_document_sans_date_part_a_relire_plutot_qu_au_coffre(self):
        # Un document daté « inconnu » se perd au milieu des autres.
        with self.assertRaises(ErreurNommage) as leve:
            nom_de(document(date_emission=None), MODELE_NOM)
        self.assertIn("relire", str(leve.exception))

    def test_l_extension_suit_le_fichier_d_origine(self):
        self.assertTrue(nom_de(document(), MODELE_NOM, ".png").endswith(".png"))


class Rangement(unittest.TestCase):
    def test_le_dossier_suit_l_annee_et_la_categorie(self):
        self.assertEqual(dossier_de(document(), MODELE_DOSSIER), Path("2026/energie"))

    def test_la_destination_compose_les_deux(self):
        chemin = destination(document(), Path("coffre/classes"), MODELE_DOSSIER, MODELE_NOM)
        self.assertEqual(chemin, Path(
            "coffre/classes/2026/energie/"
            "2026-03-14_Electricite-de-France_facture_78-42EUR.pdf"))

    def test_un_nom_deja_pris_se_decale_plutot_que_d_ecraser(self):
        # Deux factures du même jour et du même montant existent — un avoir, un
        # double prélèvement — et la seconde ne doit pas effacer la première.
        pris = {"/c/a.pdf", "/c/a-2.pdf"}
        self.assertEqual(libre(Path("/c/a.pdf"), existe=lambda p: str(p) in pris),
                         Path("/c/a-3.pdf"))

    def test_un_nom_libre_ne_bouge_pas(self):
        self.assertEqual(libre(Path("/c/a.pdf"), existe=lambda p: False), Path("/c/a.pdf"))


class DatePlausible(unittest.TestCase):
    def test_une_date_dans_le_futur_est_une_erreur_de_lecture(self):
        self.assertFalse(aujourdhui_est_plausible(date(2027, 1, 1), date(2026, 8, 27)))

    def test_une_date_d_avant_l_informatique_aussi(self):
        self.assertFalse(aujourdhui_est_plausible(date(1970, 5, 3), date(2026, 8, 27)))

    def test_une_facture_du_mois_dernier_passe(self):
        self.assertTrue(aujourdhui_est_plausible(date(2026, 7, 14), date(2026, 8, 27)))


if __name__ == "__main__":
    unittest.main()
