"""Le modèle livré doit rester valide, et la validation doit voir ce qui compte.

Ces tests ne touchent ni au disque de l'utilisateur ni à une bibliothèque
lourde : ils sont la contrepartie de la décision 3 du README, et c'est ce qui
les garde sous la seconde.
"""

import copy
import json
import sys
import unittest
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from noyau.config import valider  # noqa: E402

MODELE = json.loads((RACINE / "organizer_config.json").read_text(encoding="utf-8"))


class ModeleLivre(unittest.TestCase):
    def test_le_modele_livre_ne_presente_aucun_probleme(self):
        self.assertEqual(valider(copy.deepcopy(MODELE)), [])

    def test_le_modele_ne_contient_aucune_donnee_personnelle_reelle(self):
        # Un modèle versionné qui embarquerait un vrai IBAN ou une vraie adresse
        # se retrouverait publié le jour où le dépôt s'ouvre.
        expediteur = MODELE["resiliation"]["expediteur"]
        self.assertTrue(all(valeur == "" for valeur in expediteur.values()))

    def test_les_abonnements_du_modele_sont_manifestement_fictifs(self):
        """Le constat M-3 : l'identité était gardée, les dépenses non.

        Le test ci-dessus couvrait `resiliation.expediteur` — nom, adresse,
        IBAN — et s'arrêtait là. Les trois abonnements livrés portaient pourtant
        des montants au centime, des dates de souscription et des notes qui se
        lisent comme un carnet de comptes : « Prix passé de 29,99 € à 39,99 € en
        janvier 2026 », « Non ouvert depuis mai ».

        Ce n'est ni un secret ni un identifiant — et c'est bien pour ça que rien
        ne le signalait. C'est de la donnée de dépense, publiée et indexable dans
        un dépôt public, et l'historique git la garde même après correction.

        Deux marques suffisent à rendre la confusion impossible : un montant rond
        et un nom qui se déclare exemple. Un vrai abonnement n'a presque jamais
        les deux.
        """
        for abonnement in MODELE["abonnements"]:
            with self.subTest(abonnement=abonnement["id"]):
                self.assertIn(
                    "exemple", abonnement["id"].lower(),
                    "l'identifiant doit se déclarer comme un exemple",
                )
                montant = abonnement["montant"]
                self.assertEqual(
                    montant, round(montant),
                    f"{montant} € se lit comme une vraie dépense : arrondir",
                )


class Validation(unittest.TestCase):
    def config(self, **remplacements):
        config = copy.deepcopy(MODELE)
        config.update(remplacements)
        return config

    def test_une_section_absente_est_signalee(self):
        config = copy.deepcopy(MODELE)
        del config["nettoyage_medias"]
        self.assertTrue(any("nettoyage_medias" in p for p in valider(config)))

    def test_la_suppression_directe_est_refusee(self):
        config = copy.deepcopy(MODELE)
        config["securite"]["suppression_directe"] = True
        self.assertTrue(any("quarantaine" in p for p in valider(config)))

    def test_un_dossier_de_theme_absolu_est_refuse(self):
        """Le défaut C-1 de `AUDIT.md`, refusé au démarrage.

        En Python, `bibliotheque / "/tmp/ailleurs"` ne joint pas : l'opérande
        absolu **remplace** le gauche. Un thème ainsi configuré envoyait relevés
        bancaires et avis d'imposition hors de la bibliothèque, sans que rien ne
        le signale.
        """
        config = copy.deepcopy(MODELE)
        config["classement"]["themes"] = [{"nom": "fuite", "dossier": "/tmp/exfiltration",
                                           "mots": ["impot"]}]
        self.assertTrue(any("sortirait de la bibliothèque" in p for p in valider(config)))

    def test_un_dossier_de_theme_qui_remonte_est_refuse(self):
        """Même sortie, par « .. » plutôt que par la racine."""
        config = copy.deepcopy(MODELE)
        config["classement"]["themes"] = [{"nom": "fuite", "dossier": "../../../tmp/ailleurs",
                                           "mots": ["impot"]}]
        self.assertTrue(any("sortirait de la bibliothèque" in p for p in valider(config)))

    def test_un_schema_qui_remonte_est_refuse(self):
        """`classement.schema` porte le même défaut, et se corrige au même endroit."""
        config = copy.deepcopy(MODELE)
        config["classement"]["schema"] = "../{categorie}/{annee}"
        self.assertTrue(any("classement.schema" in p for p in valider(config)))

    def test_un_dossier_de_theme_relatif_passe(self):
        """La garde ne doit pas refuser ce que le modèle livré emploie."""
        config = copy.deepcopy(MODELE)
        config["classement"]["themes"] = [{"nom": "sain", "dossier": "Documents/Administratif",
                                           "mots": ["impot"]}]
        self.assertFalse(any("sortirait de la bibliothèque" in p for p in valider(config)))

    def test_une_extension_dans_deux_categories_est_signalee(self):
        config = copy.deepcopy(MODELE)
        config["classement"]["categories"]["Documents"].append("jpg")
        self.assertTrue(any("jpg" in p for p in valider(config)))

    def test_deux_abonnements_de_meme_identifiant_sont_signales(self):
        config = copy.deepcopy(MODELE)
        config["abonnements"].append(copy.deepcopy(config["abonnements"][0]))
        self.assertTrue(any("double" in p for p in valider(config)))

    def test_une_periodicite_inconnue_est_signalee(self):
        config = copy.deepcopy(MODELE)
        config["abonnements"][0]["periodicite"] = "tous les mardis"
        self.assertTrue(any("périodicité" in p for p in valider(config)))

    def test_une_date_mal_formee_est_signalee(self):
        config = copy.deepcopy(MODELE)
        config["abonnements"][0]["date_prochain_prelevement"] = "12/09/2026"
        self.assertTrue(any("AAAA-MM-JJ" in p for p in valider(config)))

    def test_une_distance_de_ressemblance_aberrante_est_signalee(self):
        # Mal réglé, ce seuil ne fait pas échouer la commande : il la fait
        # réussir en rapprochant des photos sans rapport.
        config = copy.deepcopy(MODELE)
        config["nettoyage_medias"]["doublons"]["distance_max"] = 200
        self.assertTrue(any("distance_max" in p for p in valider(config)))

    def test_une_distance_de_ressemblance_nulle_est_acceptee(self):
        # 0 veut dire « strictement le même rendu » : c'est un réglage légitime,
        # pas une valeur manquante.
        config = copy.deepcopy(MODELE)
        config["nettoyage_medias"]["doublons"]["distance_max"] = 0
        self.assertEqual([p for p in valider(config) if "distance_max" in p], [])

    def test_une_duree_minimale_de_video_en_minutes_est_signalee(self):
        # 5 saisi en pensant « minutes » ne fait pas échouer la commande : il
        # fait déclarer abîmé tout un dossier de clips lisibles.
        config = copy.deepcopy(MODELE)
        config["nettoyage_medias"]["videos"]["duree_minimale_secondes"] = 300
        self.assertTrue(any("duree_minimale_secondes" in p for p in valider(config)))

    def test_une_duree_minimale_de_video_nulle_est_acceptee(self):
        # 0 veut dire « aucune vidéo n'est trop courte » : c'est la façon de
        # désactiver ce seul critère sans désactiver la passe entière.
        config = copy.deepcopy(MODELE)
        config["nettoyage_medias"]["videos"]["duree_minimale_secondes"] = 0
        self.assertEqual(
            [p for p in valider(config) if "duree_minimale_secondes" in p], []
        )

    def test_une_cle_dapi_en_clair_est_refusee(self):
        config = copy.deepcopy(MODELE)
        config["upscale"]["api"]["cle"] = "sk-quelque-chose"
        self.assertTrue(any("variable d'environnement" in p for p in valider(config)))

    def test_un_objectif_de_conversion_mal_orthographie_est_signale(self):
        # C'est le défaut le plus silencieux de la section : le module retombe
        # sur « espace » par prudence, et les photos d'iPhone — qui grossissent
        # toujours en JPEG — cessent d'être converties sans qu'on sache pourquoi.
        config = copy.deepcopy(MODELE)
        config["conversion"]["regles"][0]["objectif"] = "compatibilité"
        self.assertTrue(any("objectif" in p for p in valider(config)))

    def test_un_seuil_de_gain_a_cent_pour_cent_est_refuse(self):
        # À 100, aucune conversion d'espace ne peut plus être retenue : le
        # dossier a l'air propre alors que rien n'a été fait.
        config = copy.deepcopy(MODELE)
        config["conversion"]["seuil_gain_minimal_pct"] = 100
        self.assertTrue(any("seuil_gain_minimal_pct" in p for p in valider(config)))

    def test_un_seuil_de_gain_nul_est_accepte(self):
        # 0 veut dire « toute conversion qui ne fait pas grossir est bonne à
        # prendre » : c'est un réglage légitime, pas une erreur de saisie.
        config = copy.deepcopy(MODELE)
        config["conversion"]["seuil_gain_minimal_pct"] = 0
        self.assertEqual(
            [p for p in valider(config) if "seuil_gain_minimal_pct" in p], []
        )

    def test_une_fin_dengagement_absente_est_acceptee(self):
        # `null` veut dire « sans engagement » : c'est le cas le plus fréquent,
        # il ne doit pas être confondu avec une date mal saisie.
        config = copy.deepcopy(MODELE)
        config["abonnements"][0]["fin_engagement"] = None
        self.assertEqual([p for p in valider(config) if "fin_engagement" in p], [])


if __name__ == "__main__":
    unittest.main()
