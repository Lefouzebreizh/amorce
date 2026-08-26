"""Le seuil de ressemblance et le regroupement des quasi-doublons.

Ces tests ne décodent aucune image : ils travaillent sur des empreintes écrites
à la main. C'est tout l'intérêt de la découpe — vérifier qu'une rafale n'est pas
prise pour un doublon ne doit pas coûter l'installation de Pillow.

Les empreintes sont fabriquées par `empreinte(bits_a_un)` : deux empreintes qui
diffèrent de n bits représentent deux photos à distance n. Aucune n'est un vrai
pHash, et c'est sans importance — `regles.py` ne fait que de l'arithmétique.
"""

import sys
import unittest
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from modules.nettoyage.regles import (  # noqa: E402
    NIVEAUX_DE_RESSEMBLANCE,
    avertissement_ressemblance,
    choisir_a_conserver,
    constituer_doublons,
    criteres_de_departage,
    distance_de_hamming,
    grouper_quasi_identiques,
    resoudre_ressemblance,
)
from noyau.modele import Media  # noqa: E402

DEPARTAGE = ["definition", "poids", "date_la_plus_ancienne"]


def empreinte(bits_a_un: int) -> str:
    """Une empreinte 64 bits dont les `bits_a_un` premiers bits valent 1."""
    return f"{(1 << bits_a_un) - 1:016x}"


def photo(nom: str, bits: int = 0, largeur: int = 1920, hauteur: int = 1080,
          poids: int = 1_000_000, horodatage: float = 1_000.0,
          dossier: str = "/photos") -> Media:
    return Media(
        chemin=Path(dossier) / nom,
        poids_octets=poids,
        date_horodatage=horodatage,
        largeur=largeur,
        hauteur=hauteur,
        empreinte_perceptuelle=empreinte(bits),
    )


class DistanceDeHamming(unittest.TestCase):
    def test_deux_empreintes_egales_sont_a_distance_zero(self):
        self.assertEqual(distance_de_hamming(empreinte(9), empreinte(9)), 0)

    def test_la_distance_compte_les_bits_qui_different(self):
        self.assertEqual(distance_de_hamming(empreinte(3), empreinte(8)), 5)

    def test_deux_empreintes_de_tailles_differentes_sont_refusees(self):
        # Un pHash 8×8 et un pHash 16×16 ne décrivent pas la même chose : les
        # comparer rendrait un nombre qui a l'air d'une distance.
        with self.assertRaises(ValueError):
            distance_de_hamming("ffff", "ffffffffffffffff")


class ReglageDeLaRessemblance(unittest.TestCase):
    def test_sans_demande_la_configuration_decide(self):
        reglage = resoudre_ressemblance(None, defaut=5)
        self.assertEqual(reglage.distance_max, 5)
        self.assertEqual(reglage.origine, "configuration")

    def test_un_niveau_nomme_est_traduit_en_bits(self):
        self.assertEqual(resoudre_ressemblance("stricte", 5).distance_max,
                         NIVEAUX_DE_RESSEMBLANCE["stricte"])

    def test_un_niveau_nomme_est_insensible_a_la_casse(self):
        self.assertEqual(resoudre_ressemblance("  Large ", 5).distance_max,
                         NIVEAUX_DE_RESSEMBLANCE["large"])

    def test_un_nombre_de_bits_est_accepte_tel_quel(self):
        reglage = resoudre_ressemblance("8", 5)
        self.assertEqual(reglage.distance_max, 8)
        self.assertEqual(reglage.origine, "argument")

    def test_un_niveau_inconnu_est_refuse_en_listant_les_niveaux(self):
        with self.assertRaises(ValueError) as erreur:
            resoudre_ressemblance("un peu", 5)
        self.assertIn("prudente", str(erreur.exception))

    def test_une_distance_hors_de_lechelle_est_refusee(self):
        # 64 bits est le maximum d'un pHash : au-delà, le réglage n'a pas de sens.
        with self.assertRaises(ValueError):
            resoudre_ressemblance("65", 5)

    def test_les_niveaux_vont_du_plus_strict_au_plus_permissif(self):
        valeurs = list(NIVEAUX_DE_RESSEMBLANCE.values())
        self.assertEqual(valeurs, sorted(valeurs))

    def test_un_seuil_permissif_declenche_un_avertissement(self):
        self.assertIsNone(avertissement_ressemblance(5))
        self.assertIn("rafales", avertissement_ressemblance(10))
        self.assertIn("Relire la liste", avertissement_ressemblance(20))


class Regroupement(unittest.TestCase):
    def test_deux_copies_de_la_meme_image_forment_un_groupe(self):
        groupes = grouper_quasi_identiques([photo("a.jpg", 4), photo("b.jpg", 4)], 5)
        self.assertEqual(len(groupes), 1)
        self.assertEqual(len(groupes[0]), 2)

    def test_une_photo_seule_ne_forme_pas_de_groupe(self):
        self.assertEqual(grouper_quasi_identiques([photo("a.jpg", 4)], 5), [])

    def test_une_rafale_nest_pas_un_doublon_a_seuil_prudent(self):
        # Trois déclenchements successifs : proches, mais ce sont trois photos.
        # C'est le cas que le réglage prudent doit laisser passer.
        rafale = [photo("r1.jpg", 0), photo("r2.jpg", 7), photo("r3.jpg", 14)]
        self.assertEqual(grouper_quasi_identiques(rafale, NIVEAUX_DE_RESSEMBLANCE["prudente"]), [])

    def test_la_meme_rafale_est_regroupee_a_seuil_permissif(self):
        rafale = [photo("r1.jpg", 0), photo("r2.jpg", 7), photo("r3.jpg", 14)]
        groupes = grouper_quasi_identiques(rafale, 8)
        self.assertEqual([len(groupe) for groupe in groupes], [3])

    def test_le_regroupement_est_transitif(self):
        # A et C sont à 8 bits l'un de l'autre, au-delà du seuil de 5 ; B les
        # relie. Les trois doivent finir dans le même groupe, sinon la même
        # photo se retrouverait dans deux groupes et serait jugée deux fois.
        chaine = [photo("a.jpg", 0), photo("b.jpg", 4), photo("c.jpg", 8)]
        groupes = grouper_quasi_identiques(chaine, 5)
        self.assertEqual([len(groupe) for groupe in groupes], [3])

    def test_deux_dossiers_ne_sont_pas_compares_si_on_le_refuse(self):
        photos = [
            photo("a.jpg", 4, dossier="/photos/2024"),
            photo("a.jpg", 4, dossier="/photos/2025"),
        ]
        self.assertEqual(len(grouper_quasi_identiques(photos, 5)), 1)
        self.assertEqual(grouper_quasi_identiques(photos, 5, comparer_entre_dossiers=False), [])


class ChoixDeCelleQuOnGarde(unittest.TestCase):
    def test_la_meilleure_definition_lemporte(self):
        petite = photo("petite.jpg", 4, largeur=640, hauteur=480)
        grande = photo("grande.jpg", 4, largeur=4032, hauteur=3024)
        self.assertIs(choisir_a_conserver([petite, grande], DEPARTAGE), grande)

    def test_a_definition_egale_le_fichier_le_plus_lourd_lemporte(self):
        legere = photo("legere.jpg", 4, poids=200_000)
        lourde = photo("lourde.jpg", 4, poids=900_000)
        self.assertIs(choisir_a_conserver([legere, lourde], DEPARTAGE), lourde)

    def test_a_egalite_la_plus_ancienne_lemporte(self):
        # La copie, le partage et le réenregistrement sont toujours postérieurs
        # à l'original : à défaut d'autre critère, c'est la date qui dit lequel
        # des deux fichiers est le fichier d'origine.
        ancienne = photo("copie.jpg", 4, horodatage=1_000.0)
        recente = photo("originale.jpg", 4, horodatage=9_000.0)
        self.assertIs(choisir_a_conserver([recente, ancienne], DEPARTAGE), ancienne)

    def test_deux_photos_equivalentes_donnent_toujours_le_meme_gagnant(self):
        # Sans départage stable, la quarantaine changerait à chaque passage sur
        # le même dossier.
        jumelles = [photo("b.jpg", 4), photo("a.jpg", 4)]
        self.assertEqual(choisir_a_conserver(jumelles, DEPARTAGE).chemin.name, "a.jpg")
        self.assertEqual(choisir_a_conserver(jumelles[::-1], DEPARTAGE).chemin.name, "a.jpg")

    def test_un_critere_inconnu_est_refuse(self):
        with self.assertRaises(ValueError):
            choisir_a_conserver([photo("a.jpg")], ["la_plus_jolie"])

    def test_le_reglage_conserver_passe_devant_la_liste_de_departage(self):
        self.assertEqual(
            criteres_de_departage("plus_ancienne", ["definition", "poids"]),
            ["date_la_plus_ancienne", "definition", "poids"],
        )

    def test_un_reglage_conserver_inconnu_est_refuse(self):
        with self.assertRaises(ValueError):
            criteres_de_departage("la_plus_jolie", DEPARTAGE)


class ResultatComplet(unittest.TestCase):
    def test_un_groupe_garde_toujours_une_photo(self):
        doublons = constituer_doublons(
            [photo("a.jpg", 4), photo("b.jpg", 4), photo("c.jpg", 4)], 5, DEPARTAGE
        )
        self.assertEqual(len(doublons), 1)
        self.assertEqual(len(doublons[0].ecartes), 2)
        self.assertNotIn(doublons[0].conserve, doublons[0].ecartes)

    def test_les_octets_recuperables_ne_comptent_que_les_ecartees(self):
        doublons = constituer_doublons(
            [photo("a.jpg", 4, poids=500), photo("b.jpg", 4, poids=500)], 5, DEPARTAGE
        )
        self.assertEqual(doublons[0].octets_recuperables, 500)

    def test_les_plus_gros_groupes_viennent_en_premier(self):
        photos = [
            photo("solo1.jpg", 30), photo("solo2.jpg", 30),
            photo("trio1.jpg", 0), photo("trio2.jpg", 1), photo("trio3.jpg", 2),
        ]
        doublons = constituer_doublons(photos, 3, DEPARTAGE)
        self.assertEqual([len(doublon.ecartes) for doublon in doublons], [2, 1])

    def test_la_distance_du_groupe_est_celle_de_la_plus_eloignee(self):
        doublons = constituer_doublons(
            [photo("a.jpg", 0), photo("b.jpg", 2), photo("c.jpg", 5)], 5, DEPARTAGE
        )
        self.assertEqual(doublons[0].distance_max_du_groupe, 5)

    def test_aucun_doublon_quand_rien_ne_se_ressemble(self):
        photos = [photo("a.jpg", 0), photo("b.jpg", 20), photo("c.jpg", 40)]
        self.assertEqual(constituer_doublons(photos, 5, DEPARTAGE), [])


if __name__ == "__main__":
    unittest.main()
