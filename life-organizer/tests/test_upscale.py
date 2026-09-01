"""Ce que la décision d'agrandir doit tenir, sans modèle et sans image.

Toute la valeur de ce module tient dans ces refus. Le calcul lui-même — faire
passer une photo de 800 à 3200 pixels — est le travail de Real-ESRGAN, absent de
cet environnement ; ce qui décide **quoi** lui donner, et ce qui empêche de lui
donner n'importe quoi, se vérifie ici en une milliseconde.

Les cas qui comptent ne sont pas « une petite photo est agrandie ». Ce sont les
cinq refus, et la reprise.
"""

import json
import sys
import unittest
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from modules.upscale import regles  # noqa: E402

CONFIG = json.loads((RACINE / "organizer_config.json").read_text(encoding="utf-8"))


def image(nom="photo.jpg", largeur=800, hauteur=600, nettete=None):
    return regles.Candidat(chemin=Path("/entree") / nom, largeur=largeur,
                           hauteur=hauteur, poids_octets=400_000, nettete=nettete)


class TestFacteur(unittest.TestCase):
    def test_le_facteur_se_borne_par_la_largeur_obtenue(self):
        # ×4 sur 1200 px donnerait 4800 px : personne n'en a besoin, et le
        # calcul coûte seize fois celui d'un ×1.
        self.assertEqual(regles.facteur_effectif(1200, 4, 4000), 2)

    def test_le_facteur_demande_est_un_plafond_pas_une_cible(self):
        self.assertEqual(regles.facteur_effectif(500, 2, 4000), 2)

    def test_le_trois_n_existe_pas(self):
        # Real-ESRGAN est entraîné en ×2 et ×4 ; un ×3 coûte le prix du ×4 pour
        # un résultat moindre.
        self.assertNotIn(3, regles.FACTEURS)

    def test_une_image_deja_grande_ne_tient_sous_aucun_facteur(self):
        self.assertEqual(regles.facteur_effectif(3900, 4, 4000), 1)


class TestRefus(unittest.TestCase):
    def test_une_image_deja_assez_definie_est_refusee(self):
        decision = regles.decider(image(largeur=2000, hauteur=1500), CONFIG)
        self.assertFalse(decision.retenu)
        self.assertIn("au-delà du seuil", decision.motif)

    def test_une_capture_de_telephone_est_refusee_malgre_sa_faible_largeur(self):
        # Le cas qui a fait changer le critère : 1080 px de large passait sous
        # un seuil de largeur de 1280, alors que 1080 × 2400 fait 2,59 Mpx.
        # Mille cent soixante-dix-sept fichiers d'un vrai Bureau étaient dans ce
        # cas, et ce sont les plus longs à agrandir.
        decision = regles.decider(image(largeur=1080, hauteur=2400), CONFIG)
        self.assertFalse(decision.retenu)
        self.assertIn("2.59 Mpx", decision.motif)

    def test_une_image_etroite_et_peu_definie_reste_un_candidat(self):
        # Le symétrique : la bascule ne doit pas refuser tout ce qui est haut.
        decision = regles.decider(image(largeur=600, hauteur=1200), CONFIG)
        self.assertTrue(decision.retenu)

    def test_une_vignette_est_refusee(self):
        # Agrandir soixante pixels n'y retrouve rien : cela invente des pixels.
        decision = regles.decider(image(largeur=60, hauteur=40), CONFIG)
        self.assertFalse(decision.retenu)
        self.assertIn("trop peu", decision.motif)

    def test_une_photo_floue_est_refusee(self):
        # Agrandir n'est pas restaurer : on obtiendrait un flou plus lourd.
        decision = regles.decider(image(nettete=12.0), CONFIG)
        self.assertFalse(decision.retenu)
        self.assertIn("floue", decision.motif)

    def test_une_nettete_non_mesuree_ne_vaut_pas_floue(self):
        # `None` veut dire « pas mesurée » : dans le doute on agrandit, le coût
        # d'un refus injustifié étant plus élevé que celui d'un calcul inutile.
        self.assertTrue(regles.decider(image(nettete=None), CONFIG).retenu)

    def test_une_image_deja_agrandie_n_est_jamais_reprise(self):
        # Sans ce refus : photo_hd_hd_hd.jpg au fil des passages.
        decision = regles.decider(image("photo_hd.jpg"), CONFIG)
        self.assertFalse(decision.retenu)
        self.assertIn("suffixe", decision.motif)


class TestSortie(unittest.TestCase):
    def test_la_sortie_se_pose_a_cote_de_l_original(self):
        decision = regles.decider(image(), CONFIG)
        self.assertEqual(decision.sortie, Path("/entree/photo_hd.jpg"))
        self.assertEqual(decision.sortie.parent, decision.candidat.chemin.parent)

    def test_l_original_n_est_jamais_la_cible(self):
        # La règle du module tient dans le nom plutôt que dans une consigne.
        decision = regles.decider(image(), CONFIG)
        self.assertNotEqual(decision.sortie, decision.candidat.chemin)


class TestFileReprenable(unittest.TestCase):
    def _trois(self):
        return [regles.decider(image(f"p{i}.jpg"), CONFIG) for i in range(3)]

    def test_ce_qui_existe_deja_sort_de_la_file(self):
        # C'est toute la reprise : le disque est l'état, il ne peut pas mentir.
        file, restants = regles.file_a_traiter(self._trois(), {Path("/entree/p1_hd.jpg")})
        self.assertEqual([a.candidat.chemin.name for a in file], ["p0.jpg", "p2.jpg"])
        self.assertEqual(restants, 0)

    def test_le_lot_borne_la_file_et_dit_ce_qu_il_laisse(self):
        # Une file qui ne dirait pas ce qu'elle laisse ferait croire le travail
        # fini à chaque passage.
        file, restants = regles.file_a_traiter(self._trois(), set(), lot_maximal=2)
        self.assertEqual(len(file), 2)
        self.assertEqual(restants, 1)

    def test_deux_passages_successifs_epuisent_la_file(self):
        agrandissements = self._trois()
        faits: set[Path] = set()
        file, _ = regles.file_a_traiter(agrandissements, faits, lot_maximal=2)
        faits.update(a.sortie for a in file)
        file, restants = regles.file_a_traiter(agrandissements, faits, lot_maximal=2)
        self.assertEqual(len(file), 1)
        self.assertEqual(restants, 0)
        faits.update(a.sortie for a in file)
        self.assertEqual(regles.file_a_traiter(agrandissements, faits)[0], [])

    def test_les_refuses_n_entrent_jamais_dans_la_file(self):
        agrandissements = self._trois() + [
            regles.decider(image(largeur=2000, hauteur=1500), CONFIG)]
        file, _ = regles.file_a_traiter(agrandissements, set())
        self.assertEqual(len(file), 3)


class TestCompteRendu(unittest.TestCase):
    def test_les_refus_se_regroupent_par_cause_et_non_par_fichier(self):
        agrandissements = [
            regles.decider(image("a.jpg", largeur=2000, hauteur=1500), CONFIG),
            regles.decider(image("b.jpg", largeur=1080, hauteur=2400), CONFIG),
            regles.decider(image("c_hd.jpg"), CONFIG),
        ]
        compte = regles.compter(agrandissements)
        self.assertEqual(len(compte), 2)
        self.assertEqual(sum(compte.values()), 3)


if __name__ == "__main__":
    unittest.main()
