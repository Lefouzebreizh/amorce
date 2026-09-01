"""Les redondances que l'empreinte perceptuelle ne voit pas.

Un `rapport (1).pdf` n'est pas une image : aucun pHash ne le rapproche de son
original. Ces règles rapprochent par le nom et tranchent sur le contenu, et ces
tests vérifient les deux moitiés séparément — surtout la seconde, qui est celle
qui empêche de perdre du travail.

Aucun fichier n'est écrit : les empreintes sont des chaînes posées à la main,
puisque `variantes.py` ne fait que les comparer.
"""

import sys
import unittest
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from modules.nettoyage.variantes import (  # noqa: E402
    derives_recalculables,
    est_une_variante,
    grouper_variantes_de_nom,
    nom_de_base,
    volumineux,
)
from noyau.modele import Fiche  # noqa: E402


def fiche(nom: str, poids: int = 1000, date: float = 1_700_000_000.0) -> Fiche:
    return Fiche(chemin=Path("/d") / nom, poids_octets=poids, date_horodatage=date)


class NomDeBase(unittest.TestCase):
    def test_les_marques_courantes_sont_retirees(self):
        for nom in ("rapport (1).pdf", "rapport - copie.pdf", "rapport copie.pdf",
                    "rapport - Copy.pdf", "rapport copy.pdf", "rapport - 2.pdf"):
            self.assertEqual(nom_de_base(Path(nom)), "rapport.pdf", nom)

    def test_les_marques_empilees_se_retirent_toutes(self):
        # Les services en ajoutent une par duplication, sans nettoyer la précédente.
        self.assertEqual(nom_de_base(Path("rapport copie (2).pdf")), "rapport.pdf")

    def test_une_marque_au_milieu_du_nom_ne_compte_pas(self):
        # « copie-de-sauvegarde » n'est pas une copie de « -de-sauvegarde ».
        self.assertEqual(nom_de_base(Path("copie-de-sauvegarde.txt")), "copie-de-sauvegarde.txt")

    def test_un_nom_entierement_fait_de_marques_est_laisse_tel_quel(self):
        # Sinon on rendrait un nom vide, et deux fichiers sans rapport se
        # retrouveraient dans le même groupe.
        self.assertEqual(nom_de_base(Path("copie.pdf")), "copie.pdf")

    def test_est_une_variante_distingue_l_original(self):
        self.assertTrue(est_une_variante(Path("rapport (1).pdf")))
        self.assertFalse(est_une_variante(Path("rapport.pdf")))


class VariantesDeNom(unittest.TestCase):
    def test_une_copie_au_contenu_identique_est_proposee_a_l_ecart(self):
        original, copie = fiche("rapport.pdf"), fiche("rapport (1).pdf")
        groupes = grouper_variantes_de_nom([original, copie],
                                           {original.chemin: "aaa", copie.chemin: "aaa"})
        self.assertEqual(len(groupes), 1)
        self.assertEqual(groupes[0].original.chemin, original.chemin)
        self.assertEqual([v.chemin for v in groupes[0].variantes], [copie.chemin])

    def test_une_copie_au_contenu_different_est_laissee_en_place(self):
        # Le cas qui compte : « copie de contrat » qu'on a annotée puis oubliée.
        original, copie = fiche("contrat.pdf"), fiche("contrat - copie.pdf")
        groupes = grouper_variantes_de_nom([original, copie],
                                           {original.chemin: "aaa", copie.chemin: "bbb"})
        self.assertEqual(groupes, [])

    def test_sans_empreinte_de_l_original_on_ne_tranche_pas(self):
        original, copie = fiche("photo.jpg"), fiche("photo (1).jpg")
        self.assertEqual(grouper_variantes_de_nom([original, copie], {copie.chemin: "aaa"}), [])

    def test_l_original_est_le_plus_ancien_quand_aucun_n_est_marque(self):
        vieux = fiche("a.pdf", date=1.0)
        recent = Fiche(chemin=Path("/d/sous/a.pdf"), poids_octets=1000, date_horodatage=99.0)
        groupes = grouper_variantes_de_nom([recent, vieux],
                                           {vieux.chemin: "x", recent.chemin: "x"})
        self.assertEqual(groupes[0].original.chemin, vieux.chemin)

    def test_le_poids_recuperable_additionne_les_variantes(self):
        original = fiche("r.pdf", poids=500)
        a, b = fiche("r (1).pdf", poids=500), fiche("r (2).pdf", poids=500)
        empreintes = {f.chemin: "z" for f in (original, a, b)}
        self.assertEqual(grouper_variantes_de_nom([original, a, b], empreintes)[0]
                         .octets_recuperables, 1000)


class DerivesRecalculables(unittest.TestCase):
    REGLES = {"pdf": ["psd", "svg", "md"], "jpg": ["psd"]}

    def test_un_export_dont_la_source_est_la_part_en_quarantaine(self):
        source, export = fiche("planche-01.psd"), fiche("planche-01.pdf")
        groupes = derives_recalculables([source, export], self.REGLES)
        self.assertEqual(len(groupes), 1)
        self.assertEqual(groupes[0].variantes[0].chemin, export.chemin)
        self.assertEqual(groupes[0].original.chemin, source.chemin)

    def test_un_export_orphelin_reste(self):
        # Sa source a disparu : il ne se recalcule plus, il devient l'original.
        self.assertEqual(derives_recalculables([fiche("planche-02.pdf")], self.REGLES), [])

    def test_la_source_n_est_jamais_proposee_a_l_ecart(self):
        source, export = fiche("rush.psd", poids=90_000), fiche("rush.pdf", poids=10)
        ecartes = [v.chemin for g in derives_recalculables([source, export], self.REGLES)
                   for v in g.variantes]
        # Même bien plus lourde que son dérivé : on garde ce qui ne se recalcule pas.
        self.assertNotIn(source.chemin, ecartes)


class Volumineux(unittest.TestCase):
    def test_le_seuil_est_en_mega_octets_et_le_tri_decroissant(self):
        petit, moyen, gros = (fiche("p", poids=1_000_000), fiche("m", poids=60 * 1024 * 1024),
                              fiche("g", poids=200 * 1024 * 1024))
        self.assertEqual([f.chemin.name for f in volumineux([petit, moyen, gros], 50)], ["g", "m"])

    def test_un_seuil_nul_ne_releve_rien(self):
        # Désactiver le relevé doit se faire par la configuration, pas par un tri
        # qui rendrait le dossier entier.
        self.assertEqual(volumineux([fiche("x", poids=10**9)], 0), [])


if __name__ == "__main__":
    unittest.main()
