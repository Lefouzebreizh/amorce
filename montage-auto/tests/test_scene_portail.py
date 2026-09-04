"""Vérifie la recette « portail » et la scène qui lui fournit son image.

Ce qui est testé n'est pas le goût — un montage se juge en le regardant — mais
les quatre défauts qui coûtent un rendu complet et que rien ne signale au
passage : un rendu de scène prend huit minutes, et une erreur découverte à la
fin en coûte seize.

Le catalogue de `sfx_library/` étant régénéré et non versionné, les
vérifications qui en dépendent s'effacent proprement quand il est absent : un
test qui échoue faute de matière n'apprend rien.
"""

import json
import re
import sys
import unittest
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
DEPOT = RACINE.parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(DEPOT / ".claude/skills/bande-son/scripts"))

RECETTE = json.loads(
    (RACINE / "references/artisan-express-portail.json").read_text(encoding="utf-8"))
SCENE = (RACINE / "scenes/portail.html").read_text(encoding="utf-8")
# Le code seul, commentaires ôtés. Les commentaires de la scène nomment
# volontiers ce qu'elle s'interdit — « pas de Math.random » — et une recherche
# littérale s'y prendrait les pieds : le test tomberait sur la phrase qui dit
# la règle plutôt que sur son infraction.
CODE = re.sub(r"//[^\n]*", "", re.sub(r"/\*[\s\S]*?\*/", "", SCENE))


def catalogue() -> dict | None:
    fichier = DEPOT / "sfx_library/audio_catalog.json"
    if not fichier.exists():
        return None
    donnees = json.loads(fichier.read_text(encoding="utf-8"))
    entrees = donnees if isinstance(donnees, list) else donnees.get("sons", [])
    return {e["nom"]: e for e in entrees}


class Recette(unittest.TestCase):
    def test_chaque_son_existe(self):
        """Un son inconnu ne tombe qu'au mixage, après le rendu de l'image."""
        import bruitages
        banque = catalogue()
        if banque is None:
            self.skipTest("sfx_library/ absente — `download_blockbuster_sfx.py` la régénère")
        for pose in RECETTE["effets"]:
            with self.subTest(son=pose["son"], instant=pose["instant"]):
                self.assertTrue(pose["son"] in banque or pose["son"] in bruitages.BRUITAGES,
                                f"« {pose['son']} » n'est ni dans la bibliothèque ni dans la palette")

    def test_les_sons_de_synthese_portent_leurs_parametres(self):
        """`bruitages` fabrique à la volée, et réclame alors ses arguments."""
        import inspect

        import bruitages
        banque = catalogue() or {}
        for pose in RECETTE["effets"]:
            nom = pose["son"]
            if nom in banque or nom not in bruitages.BRUITAGES:
                continue
            attendus = [p.name for p in inspect.signature(bruitages.BRUITAGES[nom]).parameters.values()
                        if p.default is inspect.Parameter.empty]
            donnes = pose.get("parametres", {})
            with self.subTest(son=nom, instant=pose["instant"]):
                self.assertEqual([p for p in attendus if p not in donnes], [],
                                 f"« {nom} » se fabrique à la volée et réclame {attendus}")

    def test_aucun_effet_ne_tombe_hors_du_montage(self):
        """Un son posé après la fin est fabriqué, mixé, puis jeté en silence."""
        total = sum(float(p["duree"]) for p in RECETTE["plans"])
        for pose in RECETTE["effets"]:
            with self.subTest(son=pose["son"], instant=pose["instant"]):
                self.assertLess(float(pose["instant"]), total,
                                "posé après la dernière image")

    def test_la_cadence_est_declaree(self):
        """`monter_episode` retombe sur 24 quand l'épisode se tait.

        La scène est rendue à 30 : sans cette clé, une image sur cinq est jetée
        et le rendu sort sans la moindre erreur — simplement saccadé, sur une
        vidéo qui n'est que du mouvement. C'est le seul réglage de ce fichier
        dont l'oubli est invisible partout ailleurs.
        """
        self.assertEqual(RECETTE.get("cadence"), 30)


class Scene(unittest.TestCase):
    def test_la_zone_sure_est_celle_du_depot(self):
        """12 % à 45 % de 1920 — l'intersection des trois plateformes."""
        zone = re.search(r"const ZONE = \{ haut: (\d+), bas: (\d+) \}", SCENE)
        self.assertIsNotNone(zone, "la scène ne déclare plus de zone sûre")
        self.assertEqual((int(zone[1]), int(zone[2])), (230, 865))

    def test_aucun_texte_ne_sort_de_la_zone_sure(self):
        """Un titre hors zone passe sous les boutons de la plateforme.

        Les hauteurs sont relues dans les appels eux-mêmes plutôt que dans une
        constante : c'est l'appel qui décide, et c'est donc lui qu'il faut
        contraindre. Une demi-hauteur de police est ajoutée de chaque côté,
        parce qu'un texte est centré sur sa ligne de base médiane.
        """
        appels = re.findall(r"ligneCentree\([^,]+,\s*([\d.]+)[^,]*,\s*(\d+)", SCENE)
        self.assertTrue(appels, "plus aucun texte dans la scène ?")
        for y, taille in appels:
            haut, demi = float(y), int(taille) / 2
            with self.subTest(y=haut, taille=taille):
                self.assertGreaterEqual(haut - demi, 230)
                self.assertLessEqual(haut + demi, 865)

    def test_le_rendu_est_deterministe(self):
        """Aucune horloge, aucun hasard non semé : sans quoi le son ne cale plus.

        `Math.random` et `Date` cherchés dans le corps du script — un seul
        suffit à rendre deux rendus différents, et le décalage ne se voit qu'au
        moment où le son ne tombe plus au bon endroit.
        """
        for interdit in ("Math.random", "Date.now", "new Date", "requestAnimationFrame"):
            with self.subTest(interdit=interdit):
                self.assertNotIn(interdit, CODE)

    def test_la_duree_de_la_scene_et_celle_du_plan_concordent(self):
        """Le plan est découpé dans le rendu : plus long, il finit sur du noir."""
        fin = re.search(r"fin\s*:\s*([\d.]+)", SCENE)
        self.assertIsNotNone(fin)
        self.assertAlmostEqual(float(fin[1]), float(RECETTE["plans"][0]["duree"]), places=2)


if __name__ == "__main__":
    unittest.main()
