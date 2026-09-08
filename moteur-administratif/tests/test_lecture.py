"""Ce que la brique 1 doit tenir : dataclasses, confiance, et lecture de champs."""

import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path

from moteur_administratif.lecture import regles
from moteur_administratif.lecture.modele import ChampsDocument, Extraction

AUJOURDHUI = date(2026, 9, 3)

TYPES = [
    {"type": "facture", "mots_cles": ["facture", "net a payer"]},
    {"type": "avis", "mots_cles": ["avis d'imposition", "avis"]},
]


class TestExtraction(unittest.TestCase):
    def test_a_du_texte_vide(self):
        self.assertFalse(Extraction(chemin=Path("x.pdf"), texte="   ").a_du_texte)

    def test_a_du_texte_present(self):
        self.assertTrue(Extraction(chemin=Path("x.pdf"), texte="Facture EDF").a_du_texte)


class TestConfianceSaturante(unittest.TestCase):
    def test_zero_signal(self):
        self.assertEqual(regles.confiance_pour(0), 0.0)

    def test_un_signal(self):
        self.assertEqual(regles.confiance_pour(1), 0.5)

    def test_deux_signaux(self):
        self.assertEqual(regles.confiance_pour(2), 0.75)

    def test_jamais_un(self):
        self.assertLess(regles.confiance_pour(20), 1.0)


class TestConfianceGlobale(unittest.TestCase):
    def setUp(self):
        self.poids = {
            "emetteur": {"connu": 0.3},
            "montant": {"etiquete": 0.25, "devine": 0.1},
        }

    def test_champs_sans_trouvaille(self):
        self.assertEqual(regles.confiance(ChampsDocument(), self.poids), 0.0)

    def test_deux_champs_trouves(self):
        champs = ChampsDocument(
            emetteur="EDF", montant=Decimal("78.42"),
            trouvailles={"emetteur": "connu", "montant": "etiquete"},
        )
        self.assertAlmostEqual(regles.confiance(champs, self.poids), 0.55)

    def test_plafonne_a_un(self):
        champs = ChampsDocument(trouvailles={
            "emetteur": "connu", "montant": "etiquete",
            "date_emission": "connu",  # absent du barème : ignoré, pas une erreur
        })
        poids_genereux = {"emetteur": {"connu": 0.8}, "montant": {"etiquete": 0.8}}
        self.assertEqual(regles.confiance(champs, poids_genereux), 1.0)


class TestNormaliser(unittest.TestCase):
    def test_espace_insecable_devient_ordinaire(self):
        self.assertEqual(regles.normaliser("1 234,56 €"), "1 234,56 €")


class TestReconnaitreNature(unittest.TestCase):
    def test_deux_mots_cles_concordants(self):
        nature, confiance, indices = regles.reconnaitre_nature(
            "FACTURE\nNet à payer : 78,42 €", TYPES)
        self.assertEqual(nature, "facture")
        self.assertEqual(confiance, 0.75)
        self.assertEqual(set(indices), {"facture", "net a payer"})

    def test_aucun_mot_cle(self):
        nature, confiance, indices = regles.reconnaitre_nature("Bonjour, comment allez-vous ?", TYPES)
        self.assertIsNone(nature)
        self.assertEqual(confiance, 0.0)

    def test_type_avec_le_plus_de_signaux_gagne(self):
        # « avis » seul matcherait aussi « avis » du type avis, mais « facture »
        # apporte deux signaux contre un.
        nature, _, _ = regles.reconnaitre_nature("Facture. Net à payer. Avis clientèle.", TYPES)
        self.assertEqual(nature, "facture")


class TestMontantPrincipal(unittest.TestCase):
    def test_montant_etiquete_prime_sur_le_plus_gros(self):
        texte = "Total antérieur 1 234,56 €\nNet à payer 78,42 €"
        montant, comment = regles.montant_principal(regles.normaliser(texte))
        self.assertEqual(montant, Decimal("78.42"))
        self.assertEqual(comment, "etiquete")

    def test_sans_etiquette_le_plus_grand_est_devine(self):
        texte = "12,00 € puis 45,50 €"
        montant, comment = regles.montant_principal(texte)
        self.assertEqual(montant, Decimal("45.50"))
        self.assertEqual(comment, "devine")

    def test_ligne_siret_ignoree(self):
        texte = "SIRET 123 456 789,00\nNet à payer 20,00 €"
        montant, comment = regles.montant_principal(texte)
        self.assertEqual(montant, Decimal("20.00"))

    def test_aucun_montant(self):
        self.assertEqual(regles.montant_principal("Rien à voir ici."), (None, ""))


class TestDates(unittest.TestCase):
    def test_jour_avant_mois(self):
        # 03/04/2026 est le 3 avril, jamais le 4 mars.
        trouvees = regles.dates("Le 03/04/2026 a eu lieu quelque chose.", AUJOURDHUI)
        self.assertIn((date(2026, 4, 3), "numerique"), trouvees)

    def test_date_future_rejetee(self):
        trouvees = regles.dates("Le 03/04/2099.", AUJOURDHUI)
        self.assertEqual(trouvees, [])

    def test_date_trop_ancienne_rejetee(self):
        trouvees = regles.dates("Le 03/04/1989.", AUJOURDHUI)
        self.assertEqual(trouvees, [])

    def test_date_iso(self):
        trouvees = regles.dates("Émis le 2026-03-14.", AUJOURDHUI)
        self.assertIn((date(2026, 3, 14), "iso"), trouvees)

    def test_date_en_lettres(self):
        trouvees = regles.dates("Fait le 14 mars 2026 à Paris.", AUJOURDHUI)
        self.assertIn((date(2026, 3, 14), "lettres"), trouvees)


class TestDatePresDe(unittest.TestCase):
    def test_date_limite_de_paiement_dans_le_futur(self):
        # Bug trouvé le 03/09/2026 : une seule fenêtre de plausibilité pour
        # toutes les dates rejetait toute échéance à venir, alors qu'une
        # échéance est presque toujours dans le futur par rapport à
        # aujourd'hui. `marge_future_jours` doit être élargie pour ce champ.
        texte = "Facture émise le 01/09/2026. Date limite de paiement : 15/09/2026."
        limite, comment = regles.date_pres_de(
            texte, regles.ETIQUETTES_ECHEANCE, AUJOURDHUI,
            marge_future_jours=regles.MARGE_FUTUR_ECHEANCE_JOURS)
        self.assertEqual(limite, date(2026, 9, 15))
        self.assertEqual(comment, "etiquete")

    def test_sans_marge_elargie_une_echeance_future_est_rejetee(self):
        texte = "Date limite de paiement : 15/09/2026."
        limite, _ = regles.date_pres_de(texte, regles.ETIQUETTES_ECHEANCE, AUJOURDHUI)
        self.assertIsNone(limite)

    def test_echeance_trop_lointaine_toujours_rejetee(self):
        texte = "Date limite de paiement : 15/09/2030."
        limite, _ = regles.date_pres_de(
            texte, regles.ETIQUETTES_ECHEANCE, AUJOURDHUI,
            marge_future_jours=regles.MARGE_FUTUR_ECHEANCE_JOURS)
        self.assertIsNone(limite)


class TestReference(unittest.TestCase):
    def test_reference_client_trouvee(self):
        ref, comment = regles.reference("Référence client : AB-12345")
        self.assertEqual(ref, "AB-12345")
        self.assertEqual(comment, "etiquete")

    def test_aucune_reference(self):
        self.assertEqual(regles.reference("Rien à voir ici."), ("", ""))


class TestEmetteur(unittest.TestCase):
    def test_emetteur_connu(self):
        nom, comment = regles.emetteur_connu("Votre facture EDF n°123", {"EDF": r"\bEDF\b"})
        self.assertEqual((nom, comment), ("EDF", "connu"))

    def test_emetteur_inconnu(self):
        self.assertEqual(regles.emetteur_connu("Facture Orange", {"EDF": r"\bEDF\b"}), ("", ""))

    def test_emetteur_devine_dans_l_entete(self):
        texte = "Ma Petite Assurance\n12 rue des Fleurs\nFACTURE\nNet à payer 78,42 €"
        devine = regles.emetteur_devine(texte, indices=("facture",))
        self.assertEqual(devine, "Ma Petite Assurance")

    def test_titre_du_document_pas_pris_pour_emetteur(self):
        # « Quittance de loyer » ne doit pas devenir l'émetteur : c'est le
        # mot-clé qui a désigné la nature, pas un nom.
        texte = "Quittance de loyer\nDate : 01/09/2026"
        devine = regles.emetteur_devine(texte, indices=("quittance de loyer",))
        self.assertNotEqual(devine, "Quittance de loyer")

    def test_ligne_avec_date_ecartee(self):
        devine = regles.emetteur_devine("01/09/2026\nVraie Entreprise SAS", indices=())
        self.assertEqual(devine, "Vraie Entreprise SAS")


class TestLire(unittest.TestCase):
    def test_document_complet(self):
        texte = (
            "Ma Petite Assurance\n"
            "12 rue des Fleurs, 75000 Paris\n"
            "FACTURE\n"
            "Référence client : AB-12345\n"
            "Date d'émission : 01/09/2026\n"
            "Date limite de paiement : 15/09/2026\n"
            "Net à payer : 78,42 €\n"
        )
        champs = regles.lire(texte, TYPES, aujourdhui=AUJOURDHUI)
        self.assertEqual(champs.nature, "facture")
        self.assertEqual(champs.emetteur, "Ma Petite Assurance")
        self.assertEqual(champs.montant, Decimal("78.42"))
        self.assertEqual(champs.date_emission, date(2026, 9, 1))
        self.assertEqual(champs.date_limite, date(2026, 9, 15))
        self.assertEqual(champs.reference, "AB-12345")
        self.assertEqual(champs.trouvailles["nature"], "connu")
        self.assertEqual(champs.trouvailles["emetteur"], "devine")
        self.assertEqual(champs.trouvailles["montant"], "etiquete")

    def test_emetteur_connu_prime_sur_le_devine(self):
        texte = "En-tête trompeuse\nFACTURE EDF\nNet à payer 10,00 €"
        champs = regles.lire(texte, TYPES, emetteurs_connus={"EDF": r"\bEDF\b"},
                             aujourdhui=AUJOURDHUI)
        self.assertEqual(champs.emetteur, "EDF")
        self.assertEqual(champs.trouvailles["emetteur"], "connu")

    def test_champs_absents_sans_signal(self):
        # L'émetteur peut toujours être deviné dans l'en-tête (aucune garantie
        # de justesse, d'où le marqueur "devine") : seuls les champs qui
        # dépendent d'une vraie reconnaissance restent absents ici.
        champs = regles.lire("Un texte sans rien de reconnaissable.", aujourdhui=AUJOURDHUI)
        self.assertIsNone(champs.nature)
        self.assertIsNone(champs.montant)
        self.assertIsNone(champs.date_limite)
        self.assertIsNone(champs.reference)
        self.assertNotIn("nature", champs.trouvailles)
        self.assertNotIn("montant", champs.trouvailles)

    def test_emission_devinee_sans_etiquette(self):
        texte = "Vraie Entreprise SAS\n01/09/2026\nFacture. Net à payer 10,00 €"
        champs = regles.lire(texte, TYPES, aujourdhui=AUJOURDHUI)
        self.assertEqual(champs.date_emission, date(2026, 9, 1))
        self.assertEqual(champs.trouvailles["date_emission"], "devine")


if __name__ == "__main__":
    unittest.main()
