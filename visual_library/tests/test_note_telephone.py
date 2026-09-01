#!/usr/bin/env python3
"""Ce que la note téléphone doit tenir, et ce qu'elle ne tient pas.

`visual_library/` portait 1109 lignes et aucun test. Sa raison d'être est
pourtant une leçon déjà payée ailleurs : un calque conforme à l'écran de
montage **disparaît** sur un téléphone en plein jour, exactement comme un
mixage conforme au casque devient inaudible. Le fichier le dit lui-même —
`visibilite_telephone` est la transposition en image de la mesure au-dessus
de 400 Hz.

Ces tests mesurent, ils ne devinent pas : chaque nombre attendu ci-dessous a
été relevé en exécutant le code, jamais déduit de ce que la docstring promet.
C'est ce qui a permis d'y trouver un écart.
"""

import sys
import tempfile
import unittest
from pathlib import Path

import numpy
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from construire_bibliotheque import (  # noqa: E402
    BAISSE_ECRAN, LUMA_MINI, NOTE_MINI, Asset, corriger_pour_telephone,
    ecrire_lut, fusionner_catalogues, noter, simuler_ecran,
)


def uni(valeur: int, alpha: int | None = None) -> numpy.ndarray:
    """Une image unie de 16 x 16, éventuellement avec un canal alpha."""
    canaux = 4 if alpha is not None else 3
    image = numpy.zeros((16, 16, canaux), numpy.uint8)
    image[..., :3] = valeur
    if alpha is not None:
        image[..., 3] = alpha
    return image


class ConstantesDeTerrain(unittest.TestCase):
    """Les trois nombres relevés sur l'appareil, épinglés et non déduits.

    Ils viennent d'un écran réel — Redmi Note 12 Plus, Chrome Android,
    assombrissement système — et aucune formule ne les redonne. Un test qui
    les réutiliserait pour formuler ses attentes suivrait docilement une
    retouche au lieu de la signaler : c'est le défaut qu'avait la première
    version de ce fichier, trouvé en changeant `BAISSE_ECRAN` sans qu'un seul
    test bronche.
    """

    def test_les_bornes_sont_celles_de_l_appareil(self):
        self.assertEqual(BAISSE_ECRAN, 0.80)
        self.assertEqual(LUMA_MINI, 40.0)
        self.assertEqual(NOTE_MINI, 50.0)


class SimulationEcran(unittest.TestCase):
    """Le voile ambiant, qui est tout l'intérêt du modèle."""

    def test_le_noir_ne_reste_pas_noir(self):
        # C'est LA raison d'être de la fonction : la dalle est éclairée par
        # l'arrière, son noir n'est jamais du noir. Une simple multiplication
        # laisserait 0 à 0 et ne verrait jamais disparaître un calque sombre.
        vue = simuler_ecran(uni(0))
        self.assertEqual(vue.min(), 6.0)
        self.assertEqual(vue.max(), 6.0)

    def test_le_blanc_perd_ce_que_l_ecran_perd(self):
        vue = simuler_ecran(uni(255))
        # 255 × 0,80 + 6 = 210. Le voile ne compense pas la baisse, il la
        # complète — les hautes lumières descendent quand même.
        self.assertEqual(vue.max(), 255 * BAISSE_ECRAN + 6.0)
        self.assertEqual(vue.max(), 210.0)

    def test_le_voile_ecrase_le_contraste_des_ombres(self):
        # Deux niveaux bas séparés de 30 sur l'écran de montage ne le sont plus
        # que de 24 sur le téléphone : c'est la compression qui fait disparaître
        # le détail d'un calque sombre, pas la luminosité moyenne.
        ecart_avant = 30.0
        sombre = numpy.zeros((16, 16, 3), numpy.uint8)
        sombre[::2] = int(ecart_avant)
        vue = simuler_ecran(sombre)
        self.assertAlmostEqual(vue.max() - vue.min(), ecart_avant * BAISSE_ECRAN)


class NoteTelephone(unittest.TestCase):

    def test_une_image_noire_est_recalee(self):
        luma, contraste, note = noter(uni(0))
        self.assertEqual(luma, 6.0)
        self.assertEqual(contraste, 0.0)
        self.assertLess(note, NOTE_MINI)

    def test_un_calque_sombre_typique_est_recale(self):
        # 24/255 : le réglage qui « paraît discret » au montage.
        luma, _, note = noter(uni(24))
        self.assertLess(luma, LUMA_MINI)
        self.assertLess(note, NOTE_MINI)

    def test_la_note_n_est_PAS_symetrique(self):
        """Le point où le code et sa docstring divergent — constaté, pas corrigé.

        La docstring de `noter` annonce qu'« une image très claire mais plate
        est aussi inutilisable qu'une image sombre et contrastée ». Mesuré,
        elle ne l'est pas du tout :

            blanche et plate      luma 210,0  contraste  0,0  note 82,0  PASSE
            sombre et contrastée  luma  30,0  contraste 24,0  note 30,5  recalée

        La formule est `luma/128 × 50 + min(contraste, 64)/64 × 50` : la
        luminance seule suffit à franchir le seuil, le contraste n'est qu'un
        bonus. Ce n'est pas une note de qualité symétrique, c'est un
        **détecteur d'obscurité** — et pour ce que ce projet cherche, un
        calque qui disparaît, c'est exactement le bon outil. Seule la phrase
        promettait plus que la formule ne tient ; elle a été corrigée, la
        formule non. La changer redéciderait quels calques d'une bibliothèque
        déjà fabriquée sont à retoucher, et un test ne tranche pas ça seul.
        """
        _, contraste_clair, note_claire = noter(uni(255))
        sombre = numpy.zeros((16, 16, 3), numpy.uint8)
        sombre[::2] = 60
        luma_sombre, contraste_sombre, note_sombre = noter(sombre)

        self.assertEqual(contraste_clair, 0.0)
        self.assertGreater(contraste_sombre, contraste_clair)
        self.assertGreaterEqual(note_claire, NOTE_MINI)
        self.assertLess(note_sombre, NOTE_MINI)
        # Le plate-et-clair l'emporte largement sur le sombre-et-contrasté.
        self.assertGreater(note_claire - note_sombre, 50.0)

    def test_le_gris_plat_qui_passe_tout_juste(self):
        # 160 uni, sans le moindre contraste, franchit le seuil. La borne du
        # détecteur est là, et elle est basse : c'est mesuré, pas souhaité.
        _, contraste, note = noter(uni(160))
        self.assertEqual(contraste, 0.0)
        self.assertGreaterEqual(note, NOTE_MINI)


class CorrectionPlutotQueSuppression(unittest.TestCase):
    """La décision centrale du fichier : on rend visible, on ne jette pas."""

    def setUp(self):
        self.dossier = Path(tempfile.mkdtemp())

    def _note_du_fichier(self, chemin: Path) -> float:
        with Image.open(chemin) as ouvert:
            return noter(numpy.asarray(ouvert.convert("RGB")))[2]

    def test_la_correction_releve_la_note(self):
        """Et de combien — « ça monte » ne garde rien.

        Un simple `apres > avant` reste vrai quand la courbe en S s'adoucit :
        vérifié en ramenant son coefficient de 1,22 à 1,00, seul contrôle de
        ce fichier qui ne bronchait pas. Le gain est donc épinglé à sa valeur
        mesurée — +5,625 points, et le même sur deux calques d'obscurité
        différente, parce que la remontée d'ombres est une affine.
        """
        for valeur in (30, 60):
            with self.subTest(valeur=valeur):
                chemin = self.dossier / f"calque_{valeur}.png"
                Image.fromarray(uni(valeur, alpha=255), "RGBA").save(chemin)
                avant = self._note_du_fichier(chemin)
                corriger_pour_telephone(chemin)
                apres = self._note_du_fichier(chemin)
                self.assertGreater(apres, avant)
                self.assertAlmostEqual(apres - avant, 5.625, places=3)

    def test_le_fichier_garde_son_nom_et_existe_encore(self):
        # « Supprimer ferait perdre un élément dont l'intention était juste et
        # le réglage faux. » Le contrat tient au nom de fichier près.
        chemin = self.dossier / "fuite_ambre.png"
        Image.fromarray(uni(30, alpha=200), "RGBA").save(chemin)
        self.assertTrue(corriger_pour_telephone(chemin))
        self.assertTrue(chemin.is_file())
        self.assertEqual(chemin.name, "fuite_ambre.png")

    def test_l_alpha_survit_intact_a_la_correction(self):
        """Le défaut silencieux qu'aucune note ne verrait passer.

        Un calque de superposition SANS son alpha n'est plus un calque : il
        masque le rush au lieu de s'y poser. La correction travaille en RVB et
        recolle le canal d'origine — si ce recollage sautait, la note
        continuerait de monter et la bibliothèque entière deviendrait opaque
        sans qu'un seul contrôle bronche.
        """
        chemin = self.dossier / "degrade.png"
        image = numpy.zeros((32, 32, 4), numpy.uint8)
        image[..., :3] = 30
        image[..., 3] = numpy.tile(numpy.arange(32, dtype=numpy.uint8) * 8, (32, 1))
        Image.fromarray(image, "RGBA").save(chemin)

        with Image.open(chemin) as ouvert:
            avant = numpy.asarray(ouvert)[..., 3].copy()
        corriger_pour_telephone(chemin)
        with Image.open(chemin) as ouvert:
            self.assertEqual(ouvert.mode, "RGBA")
            apres = numpy.asarray(ouvert)[..., 3].copy()

        numpy.testing.assert_array_equal(avant, apres)


class EcritureDesLut(unittest.TestCase):

    def setUp(self):
        self.dossier = Path(tempfile.mkdtemp())

    def _corps(self, nom: str, taille: int) -> list[str]:
        chemin = self.dossier / f"{nom}.cube"
        ecrire_lut(chemin, nom, taille=taille)
        lignes = chemin.read_text(encoding="utf-8").strip().split("\n")
        self.assertEqual(lignes[1], f"LUT_3D_SIZE {taille}")
        return [l for l in lignes if len(l.split()) == 3 and l[0].isdigit()]

    def test_un_cube_porte_taille_au_cube_triplets(self):
        for taille in (5, 9):
            with self.subTest(taille=taille):
                self.assertEqual(len(self._corps("bw_film", taille)), taille ** 3)

    def test_bw_film_est_neutre_partout(self):
        # Pas une désaturation : une pesée. Mais le résultat doit rester gris
        # sur TOUTE l'étendue — un seul triplet coloré teinterait le rendu.
        corps = self._corps("bw_film", 5)
        colores = [l for l in corps if len(set(l.split())) != 1]
        self.assertEqual(colores, [])

    def _gris(self, corps: list[str], r: int, v: int, b: int) -> float:
        """Le gris rendu pour un coin du cube de taille 3 (r varie le plus vite)."""
        return float(corps[b * 9 + v * 3 + r].split()[0])

    def test_bw_film_pese_les_canaux_et_ne_desature_pas(self):
        """« Le rouge compte moins que ce que fait l'œil » — mesuré, pas cru.

        La neutralité seule ne garde rien : changer un poids laisse le rendu
        parfaitement gris, donc invisible à un test qui ne vérifie que r=v=b.
        Ce sont les poids qui font le rendu, et ce sont eux qu'on épingle.
        """
        corps = self._corps("bw_film", 3)
        rouge = self._gris(corps, 2, 0, 0)
        vert = self._gris(corps, 0, 2, 0)
        bleu = self._gris(corps, 0, 0, 2)
        self.assertAlmostEqual(rouge, 0.3240, places=4)
        self.assertAlmostEqual(vert, 0.6662, places=4)
        self.assertAlmostEqual(bleu, 0.0998, places=4)
        # L'ordre est ce que dit la docstring : le vert domine, et le rouge
        # passe AU-DESSUS du bleu — 0,30 contre 0,11, le parti pris « film »
        # où le rouge pèse moins que dans la luma vidéo (0,2126) sans pour
        # autant descendre sous le bleu.
        self.assertGreater(vert, rouge)
        self.assertGreater(rouge, bleu)

    def test_bw_film_ecrase_les_ombres_les_plus_basses(self):
        """Deuxième écart entre la docstring et la mesure — constaté.

        La docstring annonce « une courbe relève les basses lumières pour
        qu'un écran assombri garde de la matière dans les ombres ». La courbe
        est `0,5 + 1,18·(g − 0,5) + 0,06` : elle ne relève qu'AU-DESSUS de
        g = 1/6. En dessous elle assombrit, et le noir pur tombe à 0 au lieu
        d'être relevé — l'expansion de contraste l'emporte sur le décalage.

        Ce n'est pas forcément un défaut : un noir qui reste noir sur une LUT
        de rendu se défend. Mais ce n'est pas ce qui est écrit, et rien ne le
        disait. Le test le fige ; changer la courbe reste une décision.
        """
        corps = self._corps("bw_film", 3)
        self.assertEqual(self._gris(corps, 0, 0, 0), 0.0)

    def test_teal_orange_ne_l_est_jamais(self):
        # L'inverse, et c'est ce qui prouve que la LUT fait quelque chose :
        # aucun triplet ne doit être gris, sinon la séparation n'a pas lieu.
        corps = self._corps("teal_orange", 5)
        neutres = [l for l in corps if len(set(l.split())) == 1]
        self.assertEqual(neutres, [])


class CatalogueFusionne(unittest.TestCase):

    def _asset(self, nom: str, note: float, corrige: bool) -> Asset:
        return Asset(nom=nom, categorie="Light_Leaks",
                     chemin=Path(__file__).resolve().parents[2] / "visual_library" / nom,
                     largeur=3840, hauteur=2160, note=note, corrige=corrige)

    def test_les_seuils_sont_publies_avec_le_compte(self):
        # Un catalogue qui donne un compte sans dire selon quel seuil est
        # illisible dans six mois : c'est la même exigence que l'index sonore.
        cat = fusionner_catalogues([
            self._asset("clair", 82.0, False),
            self._asset("sombre", 30.0, True),
        ])
        self.assertEqual(cat["visuels"]["total"], 2)
        self.assertEqual(cat["visuels"]["au_dessus_du_seuil"], 1)
        self.assertEqual(cat["visuels"]["corriges"], 1)
        self.assertEqual(cat["visuels"]["seuils"], {
            "luma_mini": LUMA_MINI, "note_mini": NOTE_MINI,
            "baisse_ecran": BAISSE_ECRAN,
        })

    def test_l_index_sonore_est_lu_et_jamais_recopie(self):
        """Deux vérités qui divergent au premier ajout : la règle anti-doublon.

        Quand l'index existe, le catalogue en cite le CHEMIN. C'est ce champ
        `source` qui distingue une lecture d'une copie — sans lui, personne ne
        saurait plus lequel des deux fichiers fait foi.
        """
        cat = fusionner_catalogues([])
        audio = cat["audio"]
        if audio:
            self.assertIn("source", audio)
            self.assertTrue(audio["source"].endswith("sound_index.json"))
        else:
            # L'index n'est pas dans ce dépôt : le catalogue rend un audio vide
            # plutôt qu'inventer des entrées. C'est le bon comportement.
            self.assertEqual(audio, {})


if __name__ == "__main__":
    unittest.main()
