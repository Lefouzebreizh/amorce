#!/usr/bin/env python3
"""Ce que l'index des sons doit tenir avant qu'une oreille s'en mêle.

`kits/` portait 874 lignes et aucun test — et il n'était routé nulle part :
ni dans le hook, ni dans `verifier.sh`, ni dans aucune liste. Son
`sfx/indexer.py` produit pourtant `second-brain/sound_index.json`, que
`visual_library/` lit pour fabriquer son catalogue commun. Un contrat entre
deux chantiers, que rien ne gardait.

L'index ne remplace pas l'écoute : il écarte ce qui ne peut pas marcher. Ce
sont ces trois refus que ces tests figent, chacun venant d'un échec constaté
et non d'une règle inventée.

Les nombres attendus ont été relevés en exécutant le code. Aucun n'est déduit
d'une docstring.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "sfx"))
import indexer  # noqa: E402
from indexer import (  # noqa: E402
    DUREE_DEFAUT, DUREE_MINI, FAMILLES, SONIE_MINI, TELEPHONE_MINI,
    etiquettes, verdict,
)


def mesure(duree=3.0, sonie=-12.0, telephone=-15.0, silences=0) -> dict:
    """Un son qui passe tout, dont on dégrade un seul critère à la fois."""
    return {"duree": duree, "sonie_lufs": sonie,
            "telephone_db": telephone, "silences": silences}


class SeuilsMesures(unittest.TestCase):
    """Les bornes viennent d'échecs constatés — aucune formule ne les redonne."""

    def test_les_bornes_sont_celles_ecrites(self):
        self.assertEqual(SONIE_MINI, -20.0)
        self.assertEqual(TELEPHONE_MINI, -22.0)
        self.assertEqual(DUREE_DEFAUT, 1.2)

    def test_chaque_famille_a_son_plancher_de_duree(self):
        self.assertEqual(DUREE_MINI, {
            "impacts": 0.5, "whooshes": 0.8, "dragons": 1.5,
            "magic": 0.6, "crowds": 2.0, "atmos": 2.0,
        })
        # Toutes les familles indexées ont un plancher explicite : une famille
        # qui retomberait sur le défaut de 1,2 s hériterait du défaut que le
        # plancher par famille existe précisément pour corriger.
        self.assertEqual(sorted(DUREE_MINI), sorted(FAMILLES))


class PlancherParFamille(unittest.TestCase):
    """La leçon qui a fait remplacer un seuil unique par un seuil par famille."""

    def test_le_pas_de_titan_de_0_85_s_passe_en_impact(self):
        # C'est le cas qui a cassé la règle précédente : un seuil unique à
        # 1,2 s l'écartait, alors qu'un impact DOIT être bref — sa brièveté
        # est ce qui le fait percevoir comme un choc.
        ok, raisons = verdict(mesure(duree=0.85), "impacts")
        self.assertTrue(ok, raisons)

    def test_le_meme_son_sans_famille_se_fait_ecarter(self):
        # Le repli à 1,2 s, c'est-à-dire l'ancien comportement. Ce test tient
        # les deux bouts : il montre le plancher par famille à l'œuvre, et il
        # tombe si quelqu'un ramène un seuil unique.
        ok, raisons = verdict(mesure(duree=0.85), None)
        self.assertFalse(ok)
        self.assertEqual(raisons, ["trop court (0.85 s < 1.2)"])

    def test_une_ambiance_exige_bien_plus_qu_un_impact(self):
        # 2,0 s contre 0,5 s : une ambiance sans longueur ne tient rien.
        self.assertTrue(verdict(mesure(duree=1.0), "impacts")[0])
        self.assertFalse(verdict(mesure(duree=1.0), "atmos")[0])
        self.assertFalse(verdict(mesure(duree=1.0), "dragons")[0])


class LesTroisRefus(unittest.TestCase):

    def test_un_son_trop_faible_ne_se_rattrape_pas(self):
        # « Un impact qu'il faut remonter de dix décibels au montage remonte
        # son bruit de fond avec lui. »
        ok, raisons = verdict(mesure(sonie=-25.0), "impacts")
        self.assertFalse(ok)
        self.assertIn("trop faible (-25.0 LUFS < -20.0)", raisons)

    def test_un_son_absent_du_haut_parleur_de_telephone(self):
        # La même leçon que la note de `visual_library`, dans l'autre sens :
        # magnifique au casque, inexistant sur l'appareil où la vidéo est vue.
        ok, raisons = verdict(mesure(telephone=-30.0), "dragons")
        self.assertFalse(ok)
        self.assertIn("absent sur téléphone (-30.0 dB < -22.0)", raisons)

    def test_un_trou_au_milieu_disqualifie(self):
        # « On croit poser un impact, on pose un impact suivi d'un trou. »
        ok, raisons = verdict(mesure(silences=2), "impacts")
        self.assertFalse(ok)
        self.assertIn("2 silence(s) de plus de 0,5 s", raisons)

    def test_les_raisons_s_accumulent_au_lieu_de_s_arreter_a_la_premiere(self):
        """Un son mauvais partout doit le dire en entier.

        S'arrêter au premier refus ferait revenir le son quatre fois, corrigé
        d'un défaut à chaque passage. La liste complète est ce qui permet de
        décider en une fois de le jeter.
        """
        ok, raisons = verdict(
            mesure(duree=0.2, sonie=-30.0, telephone=-40.0, silences=1),
            "impacts")
        self.assertFalse(ok)
        self.assertEqual(len(raisons), 4)

    def test_un_son_qui_passe_tout_ne_donne_aucune_raison(self):
        self.assertEqual(verdict(mesure(), "dragons"), (True, []))


class EtiquettesAutomatiques(unittest.TestCase):
    """« Rien à saisir à la main » — donc le nom et le dossier doivent suffire."""

    def chemin(self, relatif: str) -> Path:
        return indexer.RACINE / relatif

    def test_la_famille_vient_du_dossier_et_le_reste_du_nom(self):
        self.assertEqual(
            etiquettes(self.chemin("kits/sfx/dragons/rugissement_grave-02.wav")),
            ["dragons", "grave", "rugissement"])

    def test_les_mots_courts_et_les_nombres_sont_ecartes(self):
        # « pas » et « de » font trois lettres ou moins, « 01 » est un nombre :
        # trois étiquettes qui ne diraient rien et pollueraient toute recherche.
        self.assertEqual(
            etiquettes(self.chemin("kits/sfx/impacts/pas_de_titan.wav")),
            ["impacts", "titan"])
        self.assertEqual(
            etiquettes(self.chemin("kits/music/stems/nappe_01.wav")),
            ["nappe"])
        # « 01 » serait déjà tombé sur la longueur : c'est un nombre LONG qui
        # éprouve vraiment le `isdigit()`. Une année ou un numéro de prise
        # étiquetterait toute la bibliothèque avec des repères sans rapport.
        self.assertEqual(
            etiquettes(self.chemin("kits/sfx/atmos/ambiance_foret_2024.wav")),
            ["ambiance", "atmos", "foret"])

    def test_un_dossier_hors_familles_ne_pose_aucune_famille(self):
        # `music/stems` n'est pas une famille de bruitage : rien ne doit être
        # inventé, sous peine de faire remonter un stem dans une recherche
        # d'impacts.
        for tag in etiquettes(self.chemin("kits/music/stems/nappe_01.wav")):
            self.assertNotIn(tag, FAMILLES)


class ReplisDOutils(unittest.TestCase):
    """Le repli doit échouer clairement, jamais fabriquer un chemin impossible."""

    def test_le_module_s_importe_sans_ffmpeg(self):
        # Les deux fonctions qui portent les décisions sont pures. Les résoudre
        # au chargement rendait ce fichier impossible à éprouver ailleurs que
        # sur une machine de montage — et c'est probablement pour ça qu'il
        # n'avait aucun test.
        self.assertTrue(callable(indexer.verdict))
        self.assertTrue(callable(indexer.etiquettes))

    def test_ffprobe_ne_se_deduit_pas_du_chemin_de_ffmpeg(self):
        """Le défaut trouvé en écrivant ces tests, et recopié dans trois fichiers.

        `outil("ffprobe")` repliait sur `imageio-ffmpeg` en remplaçant
        « ffmpeg » par « ffprobe » dans le chemin du binaire. `str.replace`
        remplace TOUTES les occurrences : le nom du dossier `imageio_ffmpeg`
        y passait aussi, donnant un `.../imageio_ffprobe/binaries/ffprobe-...`
        qui ne peut pas exister. Et même corrigé, il n'existerait pas :
        **imageio-ffmpeg ne livre aucun ffprobe**.

        Sur une machine sans ffprobe système, `mesurer()` levait donc une
        `FileNotFoundError` brute nommant un dossier fantôme, au lieu du
        « ffprobe introuvable » que le repli promet. Le même code se trouvait
        mot pour mot dans `/etalonner` et `/trier-les-rushes`.
        """
        try:
            chemin = Path(indexer.outil("ffprobe"))
        except SystemExit as renoncement:
            # Le bon comportement quand il n'y en a pas : renoncer en disant
            # quoi installer.
            self.assertIn("ffprobe", str(renoncement))
            self.assertIn("ffmpeg", str(renoncement))
            return
        self.assertNotIn("imageio_ffprobe", chemin.parts)
        self.assertTrue(chemin.is_file(), f"chemin ffprobe inutilisable : {chemin}")
        # Et c'est bien un ffprobe : rendre le binaire ffmpeg sous ce nom
        # ferait échouer la mesure de durée avec un message incompréhensible.
        self.assertIn("ffprobe", chemin.name)

    def test_ffmpeg_a_bien_un_repli_lui(self):
        # L'asymétrie est voulue et c'est tout le correctif : ffmpeg a un repli
        # par paquet Python, ffprobe n'en a pas et ne doit pas faire semblant.
        chemin = Path(indexer.outil("ffmpeg"))
        self.assertTrue(chemin.is_file())


if __name__ == "__main__":
    unittest.main()
