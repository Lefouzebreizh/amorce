#!/usr/bin/env python3
"""Ce que la configuration doit garantir.

Deux enjeux : refuser une saisie fautive en nommant le champ, et ne jamais
abîmer un fichier que l'utilisateur tient à la main.
"""

import json
import os
import sys
import tempfile
import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.config import ErreurConfiguration, charger, enregistrer_alertes  # noqa: E402
from core.modele import Alerte, StatutAlerte, TypeAlerte  # noqa: E402

EXEMPLE = Path(__file__).resolve().parents[1] / "admin_config.exemple.json"


def minimale(**remplacements) -> dict:
    base = {
        "version": 1,
        "classement": {"categories": {"divers": {"libelle": "Divers", "conservation_annees": 3}}},
        "abonnements": [{"id": "c", "libelle": "Contrat", "categorie": "divers"}],
        "alertes": [],
    }
    return {**base, **remplacements}


class Ecrite:
    """Un fichier de configuration temporaire."""

    def __init__(self, contenu: dict) -> None:
        self.dossier = tempfile.TemporaryDirectory()
        self.chemin = Path(self.dossier.name) / "admin_config.json"
        self.chemin.write_text(json.dumps(contenu, ensure_ascii=False), encoding="utf-8")

    def __enter__(self) -> Path:
        return self.chemin

    def __exit__(self, *_) -> None:
        self.dossier.cleanup()


class LeModeleLivre(unittest.TestCase):
    """Le modèle versionné doit rester lisible par le lecteur : c'est le point de départ."""

    def test_l_exemple_se_charge_sans_reproche(self):
        configuration = charger(EXEMPLE)
        self.assertEqual(len(configuration.abonnements), 4)
        self.assertEqual(len(configuration.alertes), 3)

    def test_les_dates_d_alerte_de_l_exemple_sont_celles_que_le_calcul_donne(self):
        # L'exemple sert de documentation : une alerte écrite à la main qui
        # contredirait le calcul enseignerait une règle fausse.
        configuration = charger(EXEMPLE)
        assurance = configuration.abonnement("maif-habitation")
        self.assertEqual(assurance.date_preavis(date(2026, 8, 25)), date(2026, 9, 2))

    def test_le_total_mensuel_de_l_exemple_est_juste_au_centime(self):
        configuration = charger(EXEMPLE)
        total = sum(a.montant_mensuel for a in configuration.abonnements)
        self.assertEqual(total, Decimal("176.21"))


class SaisieRefusee(unittest.TestCase):
    def test_une_categorie_inconnue_est_refusee_en_nommant_l_abonnement(self):
        brut = minimale()
        brut["abonnements"][0]["categorie"] = "energieee"
        with Ecrite(brut) as chemin, self.assertRaises(ErreurConfiguration) as leve:
            charger(chemin)
        self.assertIn("abonnements[0].categorie", str(leve.exception))
        self.assertIn("divers", str(leve.exception))

    def test_une_date_impossible_est_refusee_en_nommant_le_champ(self):
        brut = minimale()
        brut["abonnements"][0]["engagement"] = {"fin": "02/09/2026"}
        with Ecrite(brut) as chemin, self.assertRaises(ErreurConfiguration) as leve:
            charger(chemin)
        self.assertIn("abonnements[0].engagement.fin", str(leve.exception))

    def test_deux_contrats_sous_le_meme_identifiant_sont_refuses(self):
        brut = minimale()
        brut["abonnements"].append(dict(brut["abonnements"][0]))
        with Ecrite(brut) as chemin, self.assertRaises(ErreurConfiguration) as leve:
            charger(chemin)
        self.assertIn("« c »", str(leve.exception))

    def test_une_alerte_qui_vise_un_contrat_inconnu_est_refusee(self):
        # Sans ce contrôle, l'alerte existe mais ne s'affiche jamais.
        brut = minimale(alertes=[{"id": "a", "source": "abonnement:inconnu", "echeance": "2026-09-02"}])
        with Ecrite(brut) as chemin, self.assertRaises(ErreurConfiguration) as leve:
            charger(chemin)
        self.assertIn("inconnu", str(leve.exception))

    def test_un_preavis_negatif_est_refuse(self):
        brut = minimale()
        brut["abonnements"][0]["preavis_jours"] = -30
        with Ecrite(brut) as chemin, self.assertRaises(ErreurConfiguration):
            charger(chemin)

    def test_un_fichier_absent_dit_par_quoi_commencer(self):
        with self.assertRaises(ErreurConfiguration) as leve:
            charger("/introuvable/admin_config.json")
        self.assertIn("admin_config.exemple.json", str(leve.exception))

    def test_un_fichier_venu_d_une_version_plus_recente_est_refuse(self):
        with Ecrite(minimale(version=99)) as chemin, self.assertRaises(ErreurConfiguration):
            charger(chemin)


class ReecritureDesAlertes(unittest.TestCase):
    def alerte(self) -> Alerte:
        return Alerte(
            id="a", type=TypeAlerte.PREAVIS, source="abonnement:c",
            echeance=date(2026, 9, 2), declenchement=date(2026, 8, 3),
            statut=StatutAlerte.OUVERTE, montant=Decimal("214.80"), action="Résilier",
        )

    def test_le_reste_du_fichier_ressort_intact(self):
        brut = {"_aide": "ne pas perdre cette ligne", **minimale(), "reglage_a_moi": {"garde": True}}
        with Ecrite(brut) as chemin:
            enregistrer_alertes(charger(chemin), [self.alerte()])
            relu = json.loads(chemin.read_text(encoding="utf-8"))
        self.assertEqual(relu["_aide"], "ne pas perdre cette ligne")
        self.assertEqual(relu["reglage_a_moi"], {"garde": True})
        # Ni l'ordre des sections ni les clés inconnues du programme ne bougent.
        self.assertEqual(list(relu), list(brut))

    def test_une_copie_de_sauvegarde_precede_l_ecriture(self):
        with Ecrite(minimale()) as chemin:
            enregistrer_alertes(charger(chemin), [self.alerte()])
            sauvegarde = chemin.with_suffix(chemin.suffix + ".bak")
            self.assertTrue(sauvegarde.exists())
            self.assertEqual(json.loads(sauvegarde.read_text(encoding="utf-8"))["alertes"], [])

    def test_aucun_fichier_temporaire_ne_reste_derriere(self):
        with Ecrite(minimale()) as chemin:
            enregistrer_alertes(charger(chemin), [self.alerte()])
            restes = [f.name for f in chemin.parent.iterdir() if f.suffix == ".tmp"]
        self.assertEqual(restes, [])

    def test_un_montant_fait_l_aller_retour_sans_perdre_un_centime(self):
        with Ecrite(minimale()) as chemin:
            enregistrer_alertes(charger(chemin), [self.alerte()])
            self.assertEqual(charger(chemin).alertes[0].montant, Decimal("214.80"))

    def test_le_fichier_reste_lisible_avec_ses_accents(self):
        with Ecrite(minimale()) as chemin:
            enregistrer_alertes(charger(chemin), [self.alerte()])
            self.assertIn('"action": "Résilier"', chemin.read_text(encoding="utf-8"))


class CleDApi(unittest.TestCase):
    def test_la_configuration_ne_porte_que_le_nom_de_la_variable(self):
        with Ecrite(minimale(extraction={"cle_api": "env:CLE_DE_TEST_PAPER"})) as chemin:
            extraction = charger(chemin).extraction
            os.environ.pop("CLE_DE_TEST_PAPER", None)
            self.assertIsNone(extraction.cle_api())
            os.environ["CLE_DE_TEST_PAPER"] = "secret"
            try:
                self.assertEqual(extraction.cle_api(), "secret")
            finally:
                del os.environ["CLE_DE_TEST_PAPER"]

    def test_une_cle_absente_n_empeche_pas_de_lire_ses_contrats(self):
        # Lister ses abonnements ne demande aucun réseau.
        with Ecrite(minimale(extraction={"active": True, "cle_api": "env:ABSENTE"})) as chemin:
            self.assertEqual(len(charger(chemin).abonnements), 1)


if __name__ == "__main__":
    unittest.main()
