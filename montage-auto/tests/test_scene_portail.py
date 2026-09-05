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
RECITS = {p.name: json.loads(p.read_text(encoding="utf-8"))
          for p in sorted((RACINE / "scenes/recits").glob("*.json"))}
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


    def test_seuls_les_sons_graves_sont_poussés_fort(self):
        """Un son poussé fort doit être grave, sinon c'est un sifflet.

        La règle vient d'une bavure : pour combler quatre secondes de creux
        sous le message final, le lit avait été monté de +11 dB **en bloc**.
        `drone_grave` et `nappe_sombre` le portent bien — 90 % de leur énergie
        est tonale et rien ne dépasse 2 kHz — mais `riser_long`, un balayage de
        centroïde 944 Hz, est passé à +16 et s'est mis à siffler sous le texte.

        Le seuil n'est pas une esthétique : au-delà de +12 dB un son n'est plus
        posé, il domine, et seul un grave peut dominer sans percer. Un lit se
        monte son par son, jamais d'un seul geste sur un groupe.
        """
        import numpy

        import bruitages
        import sfx_pro
        banque = catalogue()
        if banque is None:
            self.skipTest("sfx_library/ absente — `download_blockbuster_sfx.py` la régénère")
        for pose in RECETTE["effets"]:
            if float(pose.get("gain", 0)) <= 12:
                continue
            nom = pose["son"]
            if nom in banque:
                onde, taux = sfx_pro.lire_wav(DEPOT / "sfx_library" / banque[nom]["chemin"])
            else:
                onde, taux = bruitages.BRUITAGES[nom](**pose.get("parametres", {})), 48000
            if onde.ndim > 1:
                onde = onde.mean(axis=1)
            spectre = numpy.abs(numpy.fft.rfft(onde * numpy.hanning(len(onde))))
            frequences = numpy.fft.rfftfreq(len(onde), 1 / taux)
            energie = float((spectre ** 2).sum())
            centroide = float((frequences * spectre ** 2).sum() / max(energie, 1e-12))
            with self.subTest(son=nom, instant=pose["instant"], gain=pose["gain"]):
                self.assertLess(centroide, 200,
                                f"« {nom} » est poussé à {pose['gain']:+g} dB avec un "
                                f"centroïde de {centroide:.0f} Hz : ça siffle")


class Scene(unittest.TestCase):
    def test_la_zone_sure_est_celle_du_depot(self):
        """12 % à 45 % de 1920 — l'intersection des trois plateformes."""
        zone = re.search(r"const ZONE = \{ haut: (\d+), bas: (\d+) \}", SCENE)
        self.assertIsNotNone(zone, "la scène ne déclare plus de zone sûre")
        self.assertEqual((int(zone[1]), int(zone[2])), (230, 865))

    def test_les_hauteurs_de_texte_viennent_du_recit(self):
        """Plus aucune hauteur écrite dans un appel : elles sont toutes réglables.

        Ce test a d'abord relu les hauteurs dans les appels `ligneCentree`
        eux-mêmes. Depuis qu'un récit peut les remplacer, les y relire ne
        prouverait plus rien : c'est la classe `Recits` qui tient la zone sûre,
        pour tous les montages à la fois. Celui-ci garde seulement la porte
        fermée — un littéral qui reviendrait dans le code échapperait à l'autre.
        """
        appels = re.findall(r"ligneCentree\([^;]*?\)", CODE, re.S)
        self.assertTrue(appels, "plus aucun texte dans la scène ?")
        for appel in appels:
            with self.subTest(appel=appel[:60]):
                self.assertNotRegex(appel, r",\s*\d{3}(\.\d+)?\s*[,)]",
                                    "une hauteur en dur : elle échappe au réglage")

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


class CoucheVoix(unittest.TestCase):
    """Le tampon entrelacé, et pourquoi aucune mesure ne le signalait.

    `sfx_pro.lire_wav` rend le WAV **à plat** : pour un fichier stéréo, le
    tableau reste de dimension 1 et vaut deux fois la longueur. `couche_voix`
    testait `son.ndim > 1` avant de moyenner les canaux — un test qui n'est
    jamais vrai — et posait donc l'entrelacé tel quel : voix deux fois trop
    longue, une octave trop bas. Sonie, crête et dynamique restaient
    défendables ; seule l'oreille l'entendait.

    Le test ne synthétise rien : il fabrique un WAV stéréo d'une seconde, ce
    qui suffit et garde la suite à cinq secondes.
    """

    def _wav(self, canaux: int, secondes: float, taux: int = 48000) -> Path:
        import struct
        import tempfile
        import wave as w
        chemin = Path(tempfile.mkdtemp()) / f"{canaux}c.wav"
        n = int(secondes * taux)
        with w.open(str(chemin), "wb") as f:
            f.setnchannels(canaux)
            f.setsampwidth(2)
            f.setframerate(taux)
            f.writeframes(struct.pack("<%dh" % (n * canaux), *([1000] * (n * canaux))))
        return chemin

    def test_un_wav_stereo_rend_sa_vraie_duree(self):
        import monter_episode

        for canaux in (1, 2):
            with self.subTest(canaux=canaux):
                mono = monter_episode.mono_depuis(self._wav(canaux, 1.0))
                self.assertEqual(len(mono), 48000,
                                 "un tampon entrelacé pris pour du mono : "
                                 "la voix sortirait deux fois trop longue")


class Recits(unittest.TestCase):
    """Les récits déplacent les textes hors du code : le garde-fou les suit.

    Le premier montage écrivait ses hauteurs dans les appels eux-mêmes, et
    `Scene.test_aucun_texte_ne_sort_de_la_zone_sure` les y relisait. Depuis
    qu'un récit peut les remplacer, ce test ne couvre plus que les valeurs par
    défaut : sans ce qui suit, un montage entier passerait sous les boutons de
    la plateforme sans que rien ne le dise.
    """

    def test_il_y_a_des_recits_a_verifier(self):
        self.assertTrue(RECITS, "scenes/recits/ est vide — le test ne prouve rien")

    def test_le_recit_par_defaut_et_le_fichier_long_disent_la_meme_chose(self):
        """La scène porte son récit deux fois : en dur, et en fichier.

        En dur pour qu'ouvrir `portail.html` dans un navigateur montre quelque
        chose ; en fichier pour que le montage long se compare au court sur le
        même pied. Deux copies dérivent toujours — celle-ci ne le peut pas.
        """
        bloc = re.search(r"const DEFAUT = \{\s*\n\s*T: \{(.*?)\n\s*\},", SCENE, re.S)
        self.assertIsNotNone(bloc, "la scène ne déclare plus de récit par défaut")
        en_dur = {c: float(v) for c, v in re.findall(r"(\w+)\s*:\s*([\d.]+)", bloc[1])}
        self.assertEqual(en_dur, {c: float(v) for c, v in RECITS["artisan-long.json"]["T"].items()})

    def test_aucun_carton_ne_sort_de_la_zone_sure(self):
        """Borne les lignes DÉCLARÉES, et c'est tout ce qu'il peut faire.

        La scène coupe les lignes trop longues : un carton de deux lignes peut
        en dessiner quatre, et le bloc dessiné est alors plus haut que celui
        calculé ici. Ce test est donc un premier filtre, pas une preuve — c'est
        `montage-auto/mesurer_textes.py` qui mesure le résultat réel, dans le
        navigateur, avec la police et le crénage du rendu. Un récit qui passe
        ici peut encore sortir du cadre, et le mesureur le dira.
        """
        for nom, recit in RECITS.items():
            for carte in recit.get("cartes", []):
                taille = float(carte["taille"])
                interligne = taille * 1.24
                milieu = float(carte["y"])
                y0 = milieu - (len(carte["lignes"]) - 1) * interligne / 2
                y1 = y0 + (len(carte["lignes"]) - 1) * interligne
                with self.subTest(recit=nom, debut=carte["debut"]):
                    self.assertGreaterEqual(y0 - taille / 2, 230)
                    self.assertLessEqual(y1 + taille / 2, 865)

    def test_la_signature_reste_dans_la_zone_sure(self):
        for nom, recit in RECITS.items():
            signe = recit.get("signature")
            if not signe:
                continue
            with self.subTest(recit=nom):
                self.assertGreaterEqual(signe["y"] - signe["taille"] / 2, 230)
                self.assertLessEqual(signe["y"] + signe["taille"] / 2, 865)

    def test_les_cartons_ne_se_chevauchent_pas(self):
        """Deux textes à la même hauteur au même instant sont illisibles."""
        for nom, recit in RECITS.items():
            cartes = sorted(recit.get("cartes", []), key=lambda c: c["debut"])
            for avant, apres in zip(cartes, cartes[1:]):
                with self.subTest(recit=nom, avant=avant["debut"], apres=apres["debut"]):
                    self.assertLessEqual(float(avant["fin"]), float(apres["debut"]),
                                         "deux cartons se recouvrent")

    def test_rien_ne_joue_apres_la_derniere_image(self):
        for nom, recit in RECITS.items():
            fin = float(recit["T"]["fin"])
            for carte in recit.get("cartes", []):
                with self.subTest(recit=nom, debut=carte["debut"]):
                    self.assertLessEqual(float(carte["fin"]), fin)
            signe = recit.get("signature")
            if signe:
                with self.subTest(recit=nom, signature=True):
                    self.assertLess(float(signe["debut"]), fin)


if __name__ == "__main__":
    unittest.main()
