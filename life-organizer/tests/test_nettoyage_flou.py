"""La décision de netteté, vérifiée sur des nombres.

Aucune image n'est décodée ici, aucune bibliothèque lourde n'est importée :
c'est précisément ce que la séparation `regles.py` / `traitement.py` achète, et
ce qui garde ces tests sous la milliseconde.

Les cas qui comptent ne sont pas « floue » et « nette » — ce sont les trois
refus de trancher, parce qu'un faux positif met en quarantaine une photo qu'on
ne pourra plus juger avant trente jours.
"""

import sys
import unittest
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from modules.nettoyage import regles  # noqa: E402
from noyau.modele import ECARTER, GARDER, Media  # noqa: E402

MAINTENANT = 1_800_000_000.0
JOUR = regles.SECONDES_PAR_JOUR


def photo(nettete=None, jours_avant=365, visage=None, nom="photo.jpg"):
    return Media(
        chemin=Path(nom), poids_octets=2_000_000,
        date_horodatage=MAINTENANT - jours_avant * JOUR,
        largeur=4032, hauteur=3024, nettete=nettete, visage_detecte=visage,
    )


class Netteté(unittest.TestCase):
    def test_une_netteté_non_mesurée_n_est_jamais_déclarée_floue(self):
        # Sinon tout ce qu'OpenCV ne sait pas lire partirait en quarantaine.
        self.assertFalse(regles.est_flou(None, seuil=100.0))

    def test_sous_le_seuil_la_photo_est_floue(self):
        self.assertTrue(regles.est_flou(42.0, seuil=100.0))

    def test_au_seuil_exact_la_photo_est_gardée(self):
        self.assertFalse(regles.est_flou(100.0, seuil=100.0))


class Fraîcheur(unittest.TestCase):
    def test_un_fichier_du_jour_est_récent(self):
        self.assertTrue(regles.est_recente(MAINTENANT - JOUR, MAINTENANT, jours=7))

    def test_un_fichier_d_il_y_a_un_mois_ne_l_est_plus(self):
        self.assertFalse(regles.est_recente(MAINTENANT - 30 * JOUR, MAINTENANT, jours=7))

    def test_un_délai_nul_désactive_la_protection(self):
        self.assertFalse(regles.est_recente(MAINTENANT, MAINTENANT, jours=0))


class Décision(unittest.TestCase):
    REGLAGES = {"seuil_variance_laplacien": 100.0, "ignorer_si_recente_jours": 7,
                "ignorer_si_visage_detecte": True}

    def decider(self, media, **remplacements):
        reglages = {**self.REGLAGES, **remplacements}
        return regles.decider_nettete(media, reglages, MAINTENANT)

    def test_une_photo_nette_est_gardée(self):
        decision = self.decider(photo(nettete=350.0))
        self.assertEqual(decision.geste, GARDER)
        self.assertIn("nette", decision.motif)

    def test_une_photo_floue_et_ancienne_est_écartée(self):
        decision = self.decider(photo(nettete=12.0))
        self.assertEqual(decision.geste, ECARTER)
        self.assertIn("12", decision.motif)

    def test_une_photo_floue_mais_récente_est_gardée(self):
        # Elle vient d'être importée : son propriétaire ne l'a pas encore vue.
        decision = self.decider(photo(nettete=12.0, jours_avant=2))
        self.assertEqual(decision.geste, GARDER)
        self.assertIn("moins de 7 jours", decision.motif)

    def test_une_photo_floue_où_un_visage_est_reconnu_est_gardée(self):
        # La seule photo d'un moment n'est jamais reprise.
        decision = self.decider(photo(nettete=12.0, visage=True))
        self.assertEqual(decision.geste, GARDER)
        self.assertIn("visage", decision.motif)

    def test_le_garde_fou_du_visage_se_désactive(self):
        decision = self.decider(photo(nettete=12.0, visage=True),
                                ignorer_si_visage_detecte=False)
        self.assertEqual(decision.geste, ECARTER)

    def test_une_recherche_de_visage_non_faite_ne_protège_pas(self):
        # `None` veut dire « on n'a pas cherché », pas « il y en a un » : sans
        # cette distinction, un OpenCV sans classifieur garderait tout.
        decision = self.decider(photo(nettete=12.0, visage=None))
        self.assertEqual(decision.geste, ECARTER)

    def test_une_netteté_non_mesurée_est_gardée_et_le_motif_le_dit(self):
        decision = self.decider(photo(nettete=None))
        self.assertEqual(decision.geste, GARDER)
        self.assertIn("non mesurée", decision.motif)


class Décompte(unittest.TestCase):
    def test_le_décompte_sépare_les_gestes(self):
        decisions = [
            regles.decider_nettete(photo(nettete=12.0, nom="a.jpg"), {}, MAINTENANT),
            regles.decider_nettete(photo(nettete=12.0, nom="b.jpg"), {}, MAINTENANT),
            regles.decider_nettete(photo(nettete=900.0, nom="c.jpg"), {}, MAINTENANT),
        ]
        self.assertEqual(regles.compter(decisions), {ECARTER: 2, GARDER: 1})
        self.assertEqual(regles.chemins_ecartes(decisions), {Path("a.jpg"), Path("b.jpg")})


class DépartageParNetteté(unittest.TestCase):
    """Le critère qui a manqué au premier essai sur un vrai dossier.

    Une photo floue se comprime mal, donc pèse souvent plus lourd que sa version
    nette. Départager au poids gardait le raté et écartait l'original.
    """

    CRITERES = ["nettete", "definition", "poids", "date_la_plus_ancienne"]

    def test_à_définition_égale_la_plus_nette_est_conservée(self):
        nette = photo(nettete=114.0, nom="originale.jpg")
        floue = Media(chemin=Path("ratee.jpg"), poids_octets=9_000_000,
                      date_horodatage=MAINTENANT, largeur=4032, hauteur=3024,
                      nettete=2.4)
        # La floue pèse quatre fois plus : sans le critère de netteté, elle gagnait.
        self.assertEqual(
            regles.choisir_a_conserver([floue, nette], self.CRITERES).chemin,
            Path("originale.jpg"),
        )

    def test_une_netteté_non_mesurée_ne_gagne_jamais_contre_une_mesurée(self):
        mesuree = photo(nettete=3.0, nom="mesuree.jpg")
        inconnue = photo(nettete=None, nom="inconnue.jpg")
        self.assertEqual(
            regles.choisir_a_conserver([inconnue, mesuree], self.CRITERES).chemin,
            Path("mesuree.jpg"),
        )

    def test_deux_netteté_inconnues_laissent_trancher_le_critère_suivant(self):
        # Passe de netteté désactivée : le départage doit retomber sur ses pieds.
        petite = Media(chemin=Path("petite.jpg"), poids_octets=100,
                       date_horodatage=MAINTENANT, largeur=100, hauteur=100)
        grande = Media(chemin=Path("grande.jpg"), poids_octets=100,
                       date_horodatage=MAINTENANT, largeur=4000, hauteur=3000)
        self.assertEqual(
            regles.choisir_a_conserver([petite, grande], self.CRITERES).chemin,
            Path("grande.jpg"),
        )

    def test_conserver_plus_nette_est_un_choix_offert_par_la_configuration(self):
        criteres = regles.criteres_de_departage("plus_nette", ["definition", "poids"])
        self.assertEqual(criteres[0], "nettete")


if __name__ == "__main__":
    unittest.main()
