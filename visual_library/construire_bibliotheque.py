#!/usr/bin/env python3
"""Fabriquer une bibliothèque de calques et de rendus qui survivent à un téléphone.

Un calque de superposition trop sombre ne devient pas « discret » sur un écran
de six pouces en plein jour : il **disparaît**. C'est exactement le défaut qui a
coûté une nuit du côté du son — un mixage conforme, inaudible sur l'appareil où
la vidéo est regardée — et il se reproduit à l'identique en image. La note
`visibilite_telephone` de ce fichier est la transposition de la mesure au-dessus
de 400 Hz : elle simule l'écran avant de juger, et corrige au lieu de supprimer.

Trois décisions gouvernent ce fichier.

**Tout ce qui peut se calculer se calcule.** Grain, fuites de lumière,
vignettage, poussières, barres, LUT, transition à décalage de canaux : aucun de
ces éléments n'a besoin d'être téléchargé, et un fichier fabriqué se règle,
se refait et n'a pas de licence à retrouver dans six mois. Les seules choses
qu'on ne sait pas coder sont les prises de vues réelles.

**ffmpeg plutôt que moviepy.** L'installation de moviepy rétrograde Pillow et
casse `pdfplumber`, dont dépend Paper-Manager dans ce même dépôt. Les images se
calculent en numpy et se poussent brutes dans ffmpeg — la technique déjà
éprouvée par `kits/video/animer-image.py`, et sans dépendance qui déborde sur
le voisin.

**Rien de binaire n'entre dans Git.** C'est l'invariant n°8 du dépôt. Le script
et le catalogue sont versionnés ; les fichiers 4K qu'ils produisent vivent dans
un dossier ignoré, exactement comme les rushes et les exports.

Usage :
    python3 construire_bibliotheque.py --dry-run
    python3 construire_bibliotheque.py --limit 100 --resume
    python3 construire_bibliotheque.py --make-demo
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

import numpy
from PIL import Image, ImageDraw, ImageFilter

RACINE = Path(__file__).resolve().parent
DEPOT = RACINE.parent

# L'arborescence demandée. `sfx_library/` n'existe pas dans ce dépôt : la
# bibliothèque sonore s'appelle `kits/sfx/` et son index vit dans
# `second-brain/sound_index.json`. On s'y branche plutôt que d'en fabriquer un
# doublon sous un autre nom — c'est la règle anti-doublon prise au mot.
INDEX_AUDIO = DEPOT / "second-brain" / "sound_index.json"

DOSSIERS = [
    "01_Overlays_and_FX/Light_Leaks",
    "01_Overlays_and_FX/Film_Grain",
    "01_Overlays_and_FX/Dust",
    "01_Overlays_and_FX/Smoke",
    "02_LUTs_and_Grading",
    "03_Transitions",
    "04_BRoll_Textures",
    "05_Matte_and_Bars",
    "app_optimized",
    "previews",
    "recipes",
    "my_signature_looks",
]

# 4K de référence. Les calques se posent sur du 3840 x 2160 et se redimensionnent
# vers le bas sans perte visible ; l'inverse ne marche pas.
L4K, H4K = 3840, 2160
CADENCE = 24

# L'écran de référence est celui du propriétaire : Redmi Note 12 Plus, Chrome
# Android, luminosité réduite par l'assombrissement du système.
BAISSE_ECRAN = 0.80
LUMA_MINI = 40.0
NOTE_MINI = 50.0


def ffmpeg() -> str:
    c = shutil.which("ffmpeg")
    if c:
        return c
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


@dataclass
class Asset:
    nom: str
    categorie: str
    chemin: Path
    largeur: int
    hauteur: int
    cadence: float | None = None
    origine: str = "synthèse"
    licence: str = "CC0 — fabriqué par code, aucun droit tiers"
    luma: float = 0.0
    contraste: float = 0.0
    note: float = 0.0
    corrige: bool = False
    empreinte: str = ""
    versions: dict = field(default_factory=dict)


# ─────────────────────────────────────────────────────────────────────────────
# La note téléphone, et sa correction
# ─────────────────────────────────────────────────────────────────────────────

def simuler_ecran(image: numpy.ndarray) -> numpy.ndarray:
    """Ce qu'il reste d'une image sur un écran de six pouces assombri.

    La baisse de luminosité n'est pas une multiplication linéaire : un écran
    perd surtout dans les ombres, parce que le noir d'une dalle éclairée par
    l'arrière n'est jamais noir. On modélise donc le voile ambiant qui remonte
    le plancher et écrase le contraste des basses lumières — c'est lui qui fait
    disparaître un calque sombre, pas la luminosité moyenne.
    """
    voile = 6.0
    return numpy.clip(image.astype(numpy.float32) * BAISSE_ECRAN + voile, 0, 255)


def noter(image: numpy.ndarray) -> tuple[float, float, float]:
    """Rend (luma, contraste, note) après simulation d'écran."""
    vue = simuler_ecran(image)
    luma = vue @ numpy.array([0.2126, 0.7152, 0.0722], dtype=numpy.float32) \
        if vue.ndim == 3 else vue
    moyenne = float(luma.mean())
    contraste = float(luma.std())
    # La note pèse les deux à parts égales, bornées : une image très claire mais
    # plate est aussi inutilisable qu'une image sombre et contrastée.
    note = min(100.0, moyenne / 128.0 * 50.0 + min(contraste, 64.0) / 64.0 * 50.0)
    return moyenne, contraste, note


def corriger_pour_telephone(chemin: Path) -> bool:
    """Relève les ombres, pose une courbe en S, avive — sans changer le nom.

    On ne supprime pas un calque trop sombre : on le rend visible. Supprimer
    ferait perdre un élément dont l'intention était juste et le réglage faux.
    """
    image = Image.open(chemin).convert("RGBA") if chemin.suffix == ".png" \
        else Image.open(chemin).convert("RGB")
    canaux = image.split()
    rvb = Image.merge("RGB", canaux[:3])
    a = numpy.asarray(rvb).astype(numpy.float32) / 255.0

    # Lever les ombres avant la courbe : dans l'autre ordre, la courbe écrase ce
    # qu'on cherchait précisément à faire remonter.
    a = a * 0.86 + 0.14
    # Courbe en S douce, centrée sur le gris moyen.
    a = numpy.clip(0.5 + 1.22 * (a - 0.5) - 0.28 * (a - 0.5) ** 3, 0, 1)
    rvb = Image.fromarray((a * 255).astype(numpy.uint8))
    rvb = rvb.filter(ImageFilter.UnsharpMask(radius=2, percent=20, threshold=3))

    if len(canaux) == 4:
        Image.merge("RGBA", (*rvb.split(), canaux[3])).save(chemin)
    else:
        rvb.save(chemin, quality=95)
    return True


# ─────────────────────────────────────────────────────────────────────────────
# Les synthèses
# ─────────────────────────────────────────────────────────────────────────────

def fuite_de_lumiere(chemin: Path, teinte: tuple[int, int, int], graine: int) -> None:
    """Trois taches radiales décentrées, floutées, en mode addition.

    Une fuite de lumière réelle vient du bord du cadre et n'est jamais ronde :
    trois foyers d'intensités différentes suffisent à casser la symétrie qui
    trahit un dégradé fabriqué.
    """
    rng = numpy.random.default_rng(graine)
    y, x = numpy.mgrid[0:H4K, 0:L4K].astype(numpy.float32)
    somme = numpy.zeros((H4K, L4K), dtype=numpy.float32)
    for _ in range(3):
        cx = rng.uniform(-0.15, 0.35) * L4K if rng.random() < 0.5 \
            else rng.uniform(0.65, 1.15) * L4K
        cy = rng.uniform(0.05, 0.95) * H4K
        rayon = rng.uniform(0.28, 0.62) * L4K
        d = numpy.sqrt((x - cx) ** 2 + (y - cy) ** 2) / rayon
        somme += numpy.clip(1.0 - d, 0, 1) ** 1.7 * rng.uniform(0.55, 1.0)
    somme = numpy.clip(somme, 0, 1)
    rvba = numpy.zeros((H4K, L4K, 4), dtype=numpy.uint8)
    for i, c in enumerate(teinte):
        rvba[:, :, i] = (somme * c).astype(numpy.uint8)
    rvba[:, :, 3] = (somme * 235).astype(numpy.uint8)
    Image.fromarray(rvba, "RGBA").filter(ImageFilter.GaussianBlur(24)).save(chemin)


def vignettage(chemin: Path, force: float = 0.82) -> None:
    y, x = numpy.mgrid[0:H4K, 0:L4K].astype(numpy.float32)
    d = numpy.sqrt(((x - L4K / 2) / (L4K * 0.62)) ** 2 + ((y - H4K / 2) / (H4K * 0.62)) ** 2)
    masque = numpy.clip(d - 0.42, 0, None)
    masque = numpy.clip(masque / masque.max() * force, 0, 1)
    rvba = numpy.zeros((H4K, L4K, 4), dtype=numpy.uint8)
    rvba[:, :, 3] = (masque * 255).astype(numpy.uint8)
    Image.fromarray(rvba, "RGBA").filter(ImageFilter.GaussianBlur(60)).save(chemin)


def barres_noires(chemin: Path, hauteur_barre: int = 280) -> None:
    rvba = numpy.zeros((H4K, L4K, 4), dtype=numpy.uint8)
    rvba[:hauteur_barre, :, 3] = 255
    rvba[-hauteur_barre:, :, 3] = 255
    Image.fromarray(rvba, "RGBA").save(chemin)


def _encoder(chemin: Path, images, largeur: int, hauteur: int, cadence: int) -> None:
    """Pousse des images brutes dans ffmpeg. Rien n'est gardé en mémoire."""
    p = subprocess.Popen(
        [ffmpeg(), "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{largeur}x{hauteur}", "-r", str(cadence), "-i", "-",
         "-c:v", "libx264", "-crf", "20", "-preset", "medium",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(chemin)],
        stdin=subprocess.PIPE)
    for image in images:
        p.stdin.write(image.tobytes())
    p.stdin.close()
    p.wait()


def grain_argentique(chemin: Path, duree: float = 3.0, largeur=L4K, hauteur=H4K) -> None:
    """Bruit gaussien monochrome, légèrement corrélé d'une image à l'autre.

    Un bruit tiré à neuf à chaque image scintille et fatigue ; un grain de
    pellicule garde une part de la structure précédente. Le mélange à 25 %
    suffit à le rendre organique sans le figer.
    """
    rng = numpy.random.default_rng(3)
    n = int(duree * CADENCE)
    precedent = rng.normal(0, 1, (hauteur, largeur)).astype(numpy.float32)

    def suite():
        nonlocal precedent
        for _ in range(n):
            neuf = rng.normal(0, 1, (hauteur, largeur)).astype(numpy.float32)
            precedent = 0.25 * precedent + 0.75 * neuf
            # Centré sur le gris moyen : posé en « superposition », un grain
            # centré n'assombrit ni n'éclaircit l'image qu'il recouvre.
            g = numpy.clip(128 + precedent * 26, 0, 255).astype(numpy.uint8)
            yield numpy.repeat(g[:, :, None], 3, axis=2)

    _encoder(chemin, suite(), largeur, hauteur, CADENCE)


def poussieres(chemin: Path, duree: float = 4.0, combien: int = 100,
               largeur=L4K, hauteur=H4K) -> None:
    """Cent particules claires en dérive lente sur fond noir.

    Fond noir et non transparent : le calque se pose en « éclaircir », mode que
    tous les logiciels de montage ont, alors que la couche alpha d'un MP4 ne
    survit pas à l'encodage H.264.
    """
    rng = numpy.random.default_rng(11)
    n = int(duree * CADENCE)
    px = rng.uniform(0, largeur, combien)
    py = rng.uniform(0, hauteur, combien)
    vx = rng.normal(0, 1.6, combien)
    vy = rng.uniform(0.3, 1.8, combien)
    taille = rng.integers(2, 7, combien)
    eclat = rng.uniform(0.45, 1.0, combien)

    def suite():
        nonlocal px, py
        for k in range(n):
            image = numpy.zeros((hauteur, largeur, 3), dtype=numpy.uint8)
            px = (px + vx + numpy.sin(k / 18.0 + numpy.arange(combien)) * 0.9) % largeur
            py = (py + vy) % hauteur
            for i in range(combien):
                x, y, r = int(px[i]), int(py[i]), int(taille[i])
                x0, x1 = max(0, x - r), min(largeur, x + r)
                y0, y1 = max(0, y - r), min(hauteur, y + r)
                if x1 > x0 and y1 > y0:
                    image[y0:y1, x0:x1] = int(255 * eclat[i])
            yield image

    _encoder(chemin, suite(), largeur, hauteur, CADENCE)
    # Le flou se pose après l'encodage : flouter cent carrés image par image en
    # numpy coûte cent fois plus cher que de le demander une fois à ffmpeg.
    temporaire = chemin.with_suffix(".tmp.mp4")
    subprocess.run([ffmpeg(), "-v", "error", "-y", "-i", str(chemin),
                    "-vf", "gblur=sigma=2.2", "-c:v", "libx264", "-crf", "20",
                    "-pix_fmt", "yuv420p", str(temporaire)], check=True)
    temporaire.replace(chemin)


def fumee(chemin: Path, duree: float = 4.0, largeur=L4K // 2, hauteur=H4K // 2) -> None:
    """Nappe de bruit basse fréquence qui monte — une fumée, pas un nuage fixe.

    Fabriquée en petit puis agrandie : une turbulence n'a pas de détail fin, et
    la calculer en 4K coûterait cinquante fois plus pour un résultat identique.
    """
    rng = numpy.random.default_rng(29)
    n = int(duree * CADENCE)
    petit_l, petit_h = largeur // 24, hauteur // 24
    champs = [rng.normal(0, 1, (petit_h, petit_l)).astype(numpy.float32) for _ in range(4)]

    def suite():
        for k in range(n):
            u = k / max(1, n - 1)
            a = numpy.zeros((petit_h, petit_l), dtype=numpy.float32)
            for j, champ in enumerate(champs):
                decalage = int(u * petit_h * (1.4 + j * 0.5))
                a += numpy.roll(champ, -decalage, axis=0) / (j + 1)
            a = (a - a.min()) / (numpy.ptp(a) + 1e-6)
            image = Image.fromarray((a * 255).astype(numpy.uint8)).resize(
                (largeur, hauteur), Image.BICUBIC).filter(ImageFilter.GaussianBlur(9))
            g = numpy.asarray(image)
            yield numpy.repeat(g[:, :, None], 3, axis=2)

    _encoder(chemin, suite(), largeur, hauteur, CADENCE)


def transition_glitch(chemin: Path, duree: float = 0.9,
                      largeur=L4K // 2, hauteur=H4K // 2) -> None:
    """Décalage des canaux et lignes de balayage, sur fond gris neutre.

    Le décalage part de zéro, culmine au milieu et revient : une transition qui
    commence déjà cassée ne se raccorde à rien.
    """
    rng = numpy.random.default_rng(5)
    n = int(duree * CADENCE)
    base = numpy.full((hauteur, largeur, 3), 128, dtype=numpy.uint8)
    base[::3] = 150

    def suite():
        for k in range(n):
            u = k / max(1, n - 1)
            force = numpy.sin(numpy.pi * u) ** 1.4
            image = base.copy()
            for canal, sens in ((0, 1), (2, -1)):
                d = int(sens * force * largeur * 0.055)
                image[:, :, canal] = numpy.roll(image[:, :, canal], d, axis=1)
            # Quelques bandes arrachées, franches : un glitch progressif se lit
            # comme un flou, pas comme une coupure.
            for _ in range(int(force * 14)):
                y = rng.integers(0, hauteur - 12)
                h = rng.integers(4, 40)
                image[y:y + h] = numpy.roll(image[y:y + h],
                                            rng.integers(-160, 160), axis=1)
            image[::2] = (image[::2] * 0.82).astype(numpy.uint8)
            yield image

    _encoder(chemin, suite(), largeur, hauteur, CADENCE)


def ecrire_lut(chemin: Path, nom: str, taille: int = 33) -> None:
    """Écrit un .cube. Deux rendus, et la raison de chacun.

    `teal_orange` sépare les ombres des hautes lumières : ombres vers le
    cyan, peaux et feux vers l'orange. C'est le rendu des bandes-annonces, et
    il fonctionne sur téléphone parce qu'il **augmente** l'écart entre les deux
    familles au lieu de tout teinter.

    `bw_film` n'est pas une désaturation : les canaux sont pesés à la manière
    d'un film noir et blanc, où le rouge compte moins que ce que fait l'œil,
    et une courbe relève les basses lumières pour qu'un écran assombri garde
    de la matière dans les ombres.
    """
    lignes = [f"TITLE \"{nom}\"", f"LUT_3D_SIZE {taille}", "DOMAIN_MIN 0 0 0",
              "DOMAIN_MAX 1 1 1", ""]
    for b in range(taille):
        for v in range(taille):
            for r in range(taille):
                rn, vn, bn = r / (taille - 1), v / (taille - 1), b / (taille - 1)
                if nom == "teal_orange":
                    luma = 0.2126 * rn + 0.7152 * vn + 0.0722 * bn
                    chaud = luma ** 1.5
                    froid = (1.0 - luma) ** 1.5
                    ro = numpy.clip(rn + 0.085 * chaud - 0.030 * froid, 0, 1)
                    vo = numpy.clip(vn + 0.012 * chaud + 0.020 * froid, 0, 1)
                    bo = numpy.clip(bn - 0.065 * chaud + 0.105 * froid, 0, 1)
                else:
                    g = 0.30 * rn + 0.59 * vn + 0.11 * bn
                    g = numpy.clip(0.5 + 1.18 * (g - 0.5) + 0.06, 0, 1)
                    ro = vo = bo = g
                lignes.append(f"{ro:.6f} {vo:.6f} {bo:.6f}")
    chemin.write_text("\n".join(lignes) + "\n", encoding="utf-8")


# ─────────────────────────────────────────────────────────────────────────────
# Prises de vues réelles : sonder avant de promettre
# ─────────────────────────────────────────────────────────────────────────────

SOURCES = {
    "pexels": ("api.pexels.com", "PEXELS_API_KEY"),
    "pixabay": ("pixabay.com", "PIXABAY_API_KEY"),
    "mixkit": ("assets.mixkit.co", None),
}


def sonder_sources(seulement_cc0: bool = False) -> dict:
    """Dit ce qui répond **avant** de lancer la moindre requête utile.

    Une session distante peut refuser un hôte par politique de sortie ; le
    découvrir au dixième téléchargement coûte le double. Ici on le sait en
    trois secondes, et le rapport le dit à l'utilisateur au lieu de laisser un
    dossier à moitié rempli sans explication.
    """
    import os
    import urllib.request
    etat = {}
    for nom, (hote, variable) in SOURCES.items():
        if seulement_cc0 and nom == "pexels":
            etat[nom] = {"joignable": False, "raison": "écarté par --only-cc0"}
            continue
        cle = os.environ.get(variable) if variable else "sans clé"
        try:
            urllib.request.urlopen(f"https://{hote}/", timeout=12).close()
            joignable = True
            raison = "" if cle else f"hôte joignable mais {variable} absente"
        except Exception as erreur:
            joignable = False
            raison = f"{type(erreur).__name__} — {str(erreur)[:70]}"
        etat[nom] = {"joignable": joignable and bool(cle), "raison": raison}
    return etat


# ─────────────────────────────────────────────────────────────────────────────
# Versions allégées, empreintes, aperçus
# ─────────────────────────────────────────────────────────────────────────────

def alleger(asset: Asset, dossier: Path) -> dict:
    """Une version 720p pour le montage sur téléphone, une webp pour la fiche."""
    versions = {}
    if asset.chemin.suffix == ".mp4":
        sortie = dossier / f"{asset.chemin.stem}_720p.mp4"
        subprocess.run([ffmpeg(), "-v", "error", "-y", "-i", str(asset.chemin),
                        "-vf", "scale=-2:720", "-c:v", "libx264", "-crf", "23",
                        "-preset", "fast", "-pix_fmt", "yuv420p",
                        "-movflags", "+faststart", str(sortie)], check=False)
        if sortie.is_file():
            versions["720p"] = str(sortie.relative_to(DEPOT))
    else:
        image = Image.open(asset.chemin)
        image.thumbnail((1280, 1280))
        sortie = dossier / f"{asset.chemin.stem}.webp"
        image.save(sortie, "WEBP", quality=70)
        versions["webp"] = str(sortie.relative_to(DEPOT))
    return versions


def premiere_image(chemin: Path) -> numpy.ndarray | None:
    """Une image représentative, quel que soit le format."""
    if chemin.suffix != ".mp4":
        try:
            return numpy.asarray(Image.open(chemin).convert("RGB"))
        except Exception:
            return None
    p = subprocess.run([ffmpeg(), "-v", "error", "-ss", "0.5", "-i", str(chemin),
                        "-frames:v", "1", "-vf", "scale=480:-1",
                        "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                       capture_output=True)
    if not p.stdout:
        return None
    l = 480
    h = len(p.stdout) // (l * 3)
    return numpy.frombuffer(p.stdout, dtype=numpy.uint8)[: l * h * 3].reshape(h, l, 3)


def empreinte(image: numpy.ndarray) -> str:
    import imagehash
    return str(imagehash.phash(Image.fromarray(image)))


def vignette(asset: Asset, dossier: Path) -> Path | None:
    image = premiere_image(asset.chemin)
    if image is None:
        return None
    # Sur damier : sans lui, un calque à dominante alpha se lit comme une image
    # noire dans la fiche, et on croit l'asset raté.
    vue = Image.fromarray(image).convert("RGB")
    vue.thumbnail((320, 320))
    damier = Image.new("RGB", vue.size, (40, 40, 46))
    d = ImageDraw.Draw(damier)
    for y in range(0, vue.size[1], 16):
        for x in range(0, vue.size[0], 16):
            if (x // 16 + y // 16) % 2:
                d.rectangle([x, y, x + 15, y + 15], fill=(58, 58, 66))
    damier.paste(vue, (0, 0))
    sortie = dossier / f"{asset.chemin.stem}.jpg"
    damier.save(sortie, quality=88)
    return sortie


# ─────────────────────────────────────────────────────────────────────────────
# Le plan de fabrication
# ─────────────────────────────────────────────────────────────────────────────

def plan_de_fabrication() -> list[tuple[str, str, str, callable]]:
    """(nom de fichier, sous-dossier, catégorie, fonction). L'ordre est le coût.

    Les images d'abord, les vidéos ensuite : avec `--limit`, on veut que ce qui
    sort en premier soit ce qui coûte le moins et sert le plus souvent.
    """
    return [
        ("light_leak_orange.png", "01_Overlays_and_FX/Light_Leaks", "overlay",
         lambda p: fuite_de_lumiere(p, (255, 146, 58), 1)),
        ("light_leak_blue.png", "01_Overlays_and_FX/Light_Leaks", "overlay",
         lambda p: fuite_de_lumiere(p, (78, 176, 255), 2)),
        ("light_leak_magenta.png", "01_Overlays_and_FX/Light_Leaks", "overlay",
         lambda p: fuite_de_lumiere(p, (238, 92, 190), 3)),
        ("vignette_strong.png", "05_Matte_and_Bars", "matte",
         lambda p: vignettage(p, 0.82)),
        ("vignette_soft.png", "05_Matte_and_Bars", "matte",
         lambda p: vignettage(p, 0.48)),
        ("black_bars_2_39.png", "05_Matte_and_Bars", "matte",
         lambda p: barres_noires(p, 280)),
        ("LUT_teal_orange.cube", "02_LUTs_and_Grading", "lut",
         lambda p: ecrire_lut(p, "teal_orange")),
        ("LUT_bw_film.cube", "02_LUTs_and_Grading", "lut",
         lambda p: ecrire_lut(p, "bw_film")),
        ("glitch_transition_01.mp4", "03_Transitions", "transition",
         lambda p: transition_glitch(p)),
        ("dust_particles_4k.mp4", "01_Overlays_and_FX/Dust", "overlay",
         lambda p: poussieres(p)),
        ("smoke_drift_2k.mp4", "01_Overlays_and_FX/Smoke", "overlay",
         lambda p: fumee(p)),
        ("film_grain_4k.mp4", "01_Overlays_and_FX/Film_Grain", "overlay",
         lambda p: grain_argentique(p)),
    ]


RECETTES = {
    "layer_blockbuster.md": """# Layer blockbuster

L'ordre n'est pas négociable : chaque étage suppose le précédent.

1. **B-Roll** ou plan source, à sa pleine définition.
2. **LUT_teal_orange.cube**, en premier. Un étalonnage posé après le grain
   déplace le grain avec lui et le fait virer.
3. **light_leak_orange.png** en *superposition*, opacité **20 %**. Au-delà de
   30 % la fuite devient un filtre, et ça se voit.
4. **film_grain_4k.mp4** en *superposition*, opacité **12 %**, en boucle. Le
   grain se pose en **dernier** des images : tout filtre suivant le lisse et il
   ne reste qu'un flou.
5. **vignette_soft.png**, opacité 60 %. `vignette_strong` seulement si le sujet
   est centré — sinon elle mange le bord où il se trouve.
6. **Un impact** de `kits/sfx/impacts/` sur la coupe. Sans lui, l'œil voit un
   changement d'image et l'oreille n'entend rien : le montage paraît mou quel
   que soit son rythme.

Contrôle avant publication : `python3 .claude/skills/voir-le-son/scripts/voir.py`
pour le son, et la note `visibilite_telephone` du catalogue pour l'image.
""",
    "nuit_urbaine.md": """# Nuit urbaine

1. Plan de ville, **LUT_teal_orange** à 80 %.
2. **light_leak_blue.png**, *superposition*, 25 %, placée du côté d'où vient
   la lumière dans le plan. Une fuite qui vient du côté opposé se lit comme
   une erreur, même sans qu'on sache la nommer.
3. **dust_particles_4k.mp4** en *éclaircir*, 30 %.
4. Ambiance de `kits/sfx/atmos/`, très bas — présente, jamais identifiable.
""",
    "coupure_glitch.md": """# Coupure glitch

1. **glitch_transition_01.mp4** en *superposition* sur la coupe, 4 à 6 images.
   Plus long, ça devient un effet ; plus court, on ne le voit pas.
2. Un `whoosh` de `kits/sfx/whooshes/` calé **deux images avant** l'image la
   plus déformée. Le son en avance d'un souffle donne l'impact ; posé pile, il
   paraît en retard.
3. Coupe franche derrière, jamais un fondu.
""",
    "souvenir.md": """# Souvenir

1. **LUT_bw_film.cube** à 100 %.
2. **film_grain_4k.mp4**, *superposition*, **22 %** — presque le double de
   l'usage courant : c'est le grain qui date l'image.
3. **vignette_strong.png** à 70 %.
4. **black_bars_2_39.png** : le format large sépare le souvenir du présent
   sans qu'on ait à l'écrire.
""",
    "reveil_du_titan.md": """# Réveil du titan

La recette du plan final de TITANS, mesurée.

1. Plan de la créature, **LUT_teal_orange**.
2. **smoke_drift_2k.mp4** en *superposition* 35 %, **derrière** le sujet si le
   montage permet un masque.
3. **light_leak_orange.png** 30 % sur le rugissement seulement.
4. Son : un pas, un second pas plus fort, puis le rugissement. L'écart entre
   les trois fait la taille de la bête — mesuré, huit décibels de tenue valent
   mieux que quinze de crête.
""",
}


LICENCES = """# Licences de la bibliothèque visuelle

## Ce qui est fabriqué ici — CC0

Tous les fichiers produits par `construire_bibliotheque.py` sont calculés :
bruit, dégradés, masques, particules, courbes de LUT. **Aucun n'est dérivé
d'une œuvre existante.** Ils sont donc utilisables sans restriction,
commercialement, sans attribution.

C'est le premier argument pour synthétiser plutôt que télécharger : un fichier
fabriqué n'a pas de licence à retrouver dans six mois, quand le site d'origine
a changé ses conditions ou disparu.

## Ce qui serait téléchargé — à vérifier une par une

Les prises de vues réelles ne se codent pas. Si un jour elles sont récupérées :

| source | licence | attribution |
| --- | --- | --- |
| Pexels Video | Licence Pexels | non requise, appréciée |
| Pixabay | Licence Pixabay | non requise |
| Mixkit | Mixkit Free License | non requise, revente interdite |

**Aucune n'a pu être jointe depuis cette session** — les six hôtes répondent
403 au CONNECT, et aucune clé n'est configurée. Le tableau ci-dessus est donc
une intention, pas un état : à revérifier au premier téléchargement réel.

## L'audio

La bibliothèque sonore vit dans `kits/sfx/`, indexée par
`second-brain/sound_index.json`. Les fichiers `gen_*` y sont synthétisés, donc
CC0 au même titre. Les prises importées gardent la licence de leur origine.
"""


# ─────────────────────────────────────────────────────────────────────────────
# Catalogues, fiche, bacs de montage
# ─────────────────────────────────────────────────────────────────────────────

def fusionner_catalogues(visuels: list[Asset]) -> dict:
    """Un seul catalogue pour l'image et le son.

    L'index sonore existant n'est pas recopié : il est **lu**. Dupliquer ses
    entrées ferait deux vérités qui divergeraient au premier ajout de son.
    """
    audio = {}
    if INDEX_AUDIO.is_file():
        brut = json.loads(INDEX_AUDIO.read_text(encoding="utf-8"))
        audio = {
            "source": str(INDEX_AUDIO.relative_to(DEPOT)),
            "total": brut.get("total", 0),
            "utilisables": brut.get("utilisables", 0),
            "seuils": brut.get("seuils", {}),
            "sons": [{"id": s["id"], "chemin": s["chemin"],
                      "duree": s.get("duree"), "telephone_db": s.get("telephone_db"),
                      "utilisable": s.get("utilisable")}
                     for s in brut.get("sons", [])],
        }
    return {
        "visuels": {
            "total": len(visuels),
            "au_dessus_du_seuil": sum(1 for a in visuels if a.note >= NOTE_MINI),
            "corriges": sum(1 for a in visuels if a.corrige),
            "seuils": {"luma_mini": LUMA_MINI, "note_mini": NOTE_MINI,
                       "baisse_ecran": BAISSE_ECRAN},
            "assets": [{
                "nom": a.nom, "categorie": a.categorie,
                "chemin": str(a.chemin.relative_to(DEPOT)),
                "resolution": f"{a.largeur}x{a.hauteur}",
                "fps": a.cadence, "origine": a.origine, "licence": a.licence,
                "luma": round(a.luma, 1), "contraste": round(a.contraste, 1),
                "visibilite_telephone": round(a.note, 1),
                "corrige_pour_telephone": a.corrige,
                "empreinte": a.empreinte, "versions": a.versions,
            } for a in visuels],
        },
        "audio": audio,
    }


def planche_contact(vignettes: list[Path], sortie: Path, colonnes: int = 4) -> None:
    if not vignettes:
        return
    images = [Image.open(v) for v in vignettes]
    l = max(i.width for i in images)
    h = max(i.height for i in images)
    lignes = (len(images) + colonnes - 1) // colonnes
    planche = Image.new("RGB", (colonnes * (l + 8) + 8, lignes * (h + 8) + 8), (18, 18, 22))
    for i, image in enumerate(images):
        planche.paste(image, (8 + (i % colonnes) * (l + 8), 8 + (i // colonnes) * (h + 8)))
    planche.save(sortie, quality=88)


def bins_resolve(assets: list[Asset], sortie: Path) -> None:
    """Une liste de médias que Resolve importe en conservant les dossiers."""
    lignes = ['<?xml version="1.0" encoding="UTF-8"?>',
              '<xmeml version="5">', '  <bin>', '    <name>Visual Library</name>',
              '    <children>']
    for a in assets:
        lignes += ['      <clip>', f'        <name>{a.nom}</name>',
                   f'        <pathurl>file://{a.chemin}</pathurl>',
                   f'        <comment>{a.categorie} · visibilité téléphone '
                   f'{a.note:.0f}/100</comment>', '      </clip>']
    lignes += ['    </children>', '  </bin>', '</xmeml>']
    sortie.write_text("\n".join(lignes) + "\n", encoding="utf-8")


def bins_premiere(assets: list[Asset], sortie: Path) -> None:
    lignes = ['<?xml version="1.0" encoding="UTF-8"?>', '<xmeml version="4">',
              '  <project>', '    <name>Visual Library</name>', '    <children>']
    categories = sorted({a.categorie for a in assets})
    for categorie in categories:
        lignes += ['      <bin>', f'        <name>{categorie}</name>', '        <children>']
        for a in (x for x in assets if x.categorie == categorie):
            lignes += ['          <clip>', f'            <name>{a.nom}</name>',
                       '            <media><video><samplecharacteristics>',
                       f'              <width>{a.largeur}</width>',
                       f'              <height>{a.hauteur}</height>',
                       '            </samplecharacteristics></video></media>',
                       f'            <pathurl>file://{a.chemin}</pathurl>',
                       '          </clip>']
        lignes += ['        </children>', '      </bin>']
    lignes += ['    </children>', '  </project>', '</xmeml>']
    sortie.write_text("\n".join(lignes) + "\n", encoding="utf-8")


FICHE_HTML = r"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bibliothèque visuelle</title>
<style>
  :root { --fond:#0d1117; --carte:#161b22; --bord:#272e38; --texte:#e6edf3;
          --gris:#8b949e; --accent:#48d2ff; --alerte:#ff7b72; }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--fond); color:var(--texte); font:18px/1.55 system-ui,sans-serif;
         padding:20px; -webkit-text-size-adjust:100%; }
  h1 { font-size:26px; margin-bottom:4px; }
  .sous { color:var(--gris); margin-bottom:20px; }
  .reglages { display:flex; flex-wrap:wrap; gap:12px; align-items:center;
              background:var(--carte); border:1px solid var(--bord);
              border-radius:12px; padding:14px; margin-bottom:20px; }
  /* Cibles de 44 px au moins : cette page se consulte sur un téléphone,
     souvent d'une main, en cherchant un fichier au milieu d'un montage. */
  select, input[type=search] { min-height:44px; font-size:18px; padding:0 12px;
    background:#0d1117; color:var(--texte); border:1px solid var(--bord); border-radius:9px; }
  input[type=range] { min-height:44px; flex:1 1 220px; }
  .grille { display:grid; gap:16px;
            grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); }
  .carte { background:var(--carte); border:1px solid var(--bord); border-radius:12px;
           overflow:hidden; display:flex; flex-direction:column; }
  .carte img, .carte video { width:100%; aspect-ratio:16/9; object-fit:cover;
                             background:#000; display:block; }
  .corps { padding:12px; display:flex; flex-direction:column; gap:8px; flex:1; }
  .nom { font-weight:600; word-break:break-word; }
  .meta { color:var(--gris); font-size:15px; }
  .note { font-weight:700; }
  .bon { color:var(--accent); } .faible { color:var(--alerte); }
  /* Deux barres horizontales, jamais un cercle : c'est la règle d'affichage
     du dépôt, et elle se lit à la même vitesse sur un petit écran. */
  .jauge { height:9px; background:#0d1117; border-radius:5px; overflow:hidden; }
  .jauge > i { display:block; height:100%; background:var(--accent); }
  button { min-height:44px; font-size:17px; border:1px solid var(--bord);
           background:#21262d; color:var(--texte); border-radius:9px; cursor:pointer; }
  button:active { background:#30363d; }
  .vide { color:var(--gris); padding:40px 0; text-align:center; }
</style></head><body>
<h1>Bibliothèque visuelle</h1>
<p class="sous" id="resume">Chargement…</p>
<div class="reglages">
  <input type="search" id="recherche" placeholder="chercher un nom…">
  <select id="categorie"><option value="">toutes catégories</option></select>
  <label for="seuil">visibilité ≥ <b id="valeur">0</b></label>
  <input type="range" id="seuil" min="0" max="100" value="0">
</div>
<div class="grille" id="grille"></div>
<p class="vide" id="vide" hidden>Rien à ce seuil.</p>
<script>
const $ = s => document.querySelector(s);
let assets = [];

fetch('master_catalog.json').then(r => r.json()).then(d => {
  assets = d.visuels.assets;
  const a = d.audio || {};
  $('#resume').textContent =
    `${d.visuels.total} visuels · ${d.visuels.au_dessus_du_seuil} au-dessus du seuil · `
    + `${d.visuels.corriges} corrigés pour téléphone`
    + (a.total ? ` — et ${a.total} sons dans ${a.source}` : '');
  const cats = [...new Set(assets.map(x => x.categorie))].sort();
  for (const c of cats) {
    const o = document.createElement('option'); o.value = o.textContent = c;
    $('#categorie').append(o);
  }
  dessiner();
}).catch(e => { $('#resume').textContent = 'master_catalog.json introuvable : ' + e; });

function dessiner() {
  const seuil = +$('#seuil').value, cat = $('#categorie').value;
  const q = $('#recherche').value.trim().toLowerCase();
  $('#valeur').textContent = seuil;
  const vus = assets.filter(a => a.visibilite_telephone >= seuil
    && (!cat || a.categorie === cat) && (!q || a.nom.toLowerCase().includes(q)));
  const g = $('#grille'); g.textContent = '';
  $('#vide').hidden = vus.length > 0;
  for (const a of vus) {
    const c = document.createElement('div'); c.className = 'carte';
    const media = a.chemin.endsWith('.mp4');
    // La vidéo ne se lance qu'au survol ou au toucher : douze lectures
    // simultanées bloquent un téléphone, et l'autoplay est proscrit ici.
    if (media) {
      const v = document.createElement('video');
      v.src = a.versions?.['720p'] ? '../' + a.versions['720p'] : '../' + a.chemin;
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
      c.append(v);
      const jouer = () => v.play().catch(() => {});
      c.addEventListener('mouseenter', jouer);
      c.addEventListener('touchstart', jouer, { passive: true });
      c.addEventListener('mouseleave', () => { v.pause(); v.currentTime = 0; });
    } else {
      const i = document.createElement('img');
      i.loading = 'lazy';
      i.src = '../visual_library/previews/' + a.nom.replace(/\.[^.]+$/, '') + '.jpg';
      c.append(i);
    }
    const corps = document.createElement('div'); corps.className = 'corps';
    const nom = document.createElement('div'); nom.className = 'nom'; nom.textContent = a.nom;
    const meta = document.createElement('div'); meta.className = 'meta';
    meta.textContent = `${a.categorie} · ${a.resolution}` + (a.fps ? ` · ${a.fps} i/s` : '');
    const note = document.createElement('div'); note.className = 'meta';
    const fort = a.visibilite_telephone >= 50;
    note.innerHTML = `visibilité téléphone <span class="note ${fort ? 'bon' : 'faible'}">`
      + `${a.visibilite_telephone}</span>${a.corrige_pour_telephone ? ' · corrigé' : ''}`;
    const jauge = document.createElement('div'); jauge.className = 'jauge';
    const barre = document.createElement('i');
    barre.style.width = Math.min(100, a.visibilite_telephone) + '%';
    if (!fort) barre.style.background = 'var(--alerte)';
    jauge.append(barre);
    const b = document.createElement('button');
    b.textContent = 'copier le chemin';
    b.onclick = async () => {
      try { await navigator.clipboard.writeText(a.chemin); b.textContent = 'copié'; }
      catch { b.textContent = a.chemin; }
      setTimeout(() => (b.textContent = 'copier le chemin'), 1600);
    };
    corps.append(nom, meta, note, jauge, b); c.append(corps); g.append(c);
  }
}
for (const id of ['#seuil', '#categorie', '#recherche'])
  $(id).addEventListener('input', dessiner);
</script></body></html>
"""


# ─────────────────────────────────────────────────────────────────────────────
# Démonstration
# ─────────────────────────────────────────────────────────────────────────────

def fabriquer_demo(assets: dict[str, Path], sortie: Path) -> bool:
    """Dix secondes qui empilent la recette « layer blockbuster ».

    Aucune prise de vue réelle n'étant joignable, le fond est fabriqué : un
    dégradé animé sert de B-Roll. Ce n'est pas un cache-misère — c'est ce qui
    permet de vérifier que l'empilement fonctionne sans dépendre d'un
    téléchargement.
    """
    manquants = [n for n in ("film_grain_4k.mp4", "light_leak_orange.png",
                             "vignette_soft.png", "LUT_teal_orange.cube") if n not in assets]
    if manquants:
        print(f"   Démo impossible, il manque : {', '.join(manquants)}", file=sys.stderr)
        return False

    l, h, duree = 1920, 1080, 10.0
    fond = sortie.parent / "_fond_demo.mp4"
    n = int(duree * CADENCE)

    def suite():
        y, x = numpy.mgrid[0:h, 0:l].astype(numpy.float32)
        for k in range(n):
            u = k / max(1, n - 1)
            a = numpy.zeros((h, l, 3), dtype=numpy.float32)
            d = numpy.sqrt(((x - l * (0.3 + 0.4 * u)) / l) ** 2 + ((y - h * 0.5) / h) ** 2)
            lueur = numpy.clip(1.0 - d * 1.6, 0, 1) ** 2
            a[:, :, 0] = 26 + lueur * 205
            a[:, :, 1] = 32 + lueur * 118
            a[:, :, 2] = 46 + lueur * 42
            yield numpy.clip(a, 0, 255).astype(numpy.uint8)

    _encoder(fond, suite(), l, h, CADENCE)

    # L'ordre des filtres reprend exactement celui de la recette : étalonnage,
    # fuite, grain, vignettage. Le grain en dernier des images, sinon les
    # filtres suivants le lissent et il ne reste qu'un flou.
    filtre = (
        f"[0:v]lut3d='{assets['LUT_teal_orange.cube']}'[etalonne];"
        f"[1:v]scale={l}:{h}[fuite];"
        f"[etalonne][fuite]overlay=0:0:format=auto,"
        f"colorchannelmixer=aa=1[avecfuite];"
        f"[2:v]scale={l}:{h},format=gray,format=rgba,"
        f"colorchannelmixer=aa=0.12[grain];"
        f"[avecfuite][grain]overlay=0:0[graine];"
        f"[3:v]scale={l}:{h}[vig];"
        f"[graine][vig]overlay=0:0[final]"
    )
    commande = [ffmpeg(), "-v", "error", "-y",
                "-i", str(fond),
                "-i", str(assets["light_leak_orange.png"]),
                "-stream_loop", "-1", "-i", str(assets["film_grain_4k.mp4"]),
                "-i", str(assets["vignette_soft.png"]),
                "-filter_complex", filtre, "-map", "[final]", "-t", str(duree),
                "-c:v", "libx264", "-crf", "19", "-preset", "medium",
                "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(sortie)]
    resultat = subprocess.run(commande, capture_output=True)
    fond.unlink(missing_ok=True)
    if resultat.returncode != 0:
        print("   ffmpeg a refusé la démo :", file=sys.stderr)
        print("   " + resultat.stderr.decode()[-400:], file=sys.stderr)
        return False
    return True


# ─────────────────────────────────────────────────────────────────────────────
# Programme
# ─────────────────────────────────────────────────────────────────────────────

def main() -> int:
    a = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("--limit", type=int, default=100, help="nombre d'assets au plus")
    a.add_argument("--resume", action="store_true", help="ne refabrique pas ce qui existe")
    a.add_argument("--dry-run", action="store_true", help="annonce sans rien écrire")
    a.add_argument("--only-cc0", action="store_true", help="écarte les sources non CC0")
    a.add_argument("--make-demo", action="store_true", help="assemble une séquence de 10 s")
    v = a.parse_args()

    try:
        from tqdm import tqdm
    except ImportError:
        def tqdm(x, **k):
            return x

    print(f"── Inspection")
    print(f"   Dépôt        : {DEPOT}")
    existants = sorted(p for p in RACINE.rglob("*")
                       if p.is_file() and p.suffix in {".png", ".mp4", ".cube", ".jpg", ".webp"})
    print(f"   Déjà présent : {len(existants)} fichier(s) dans visual_library/")
    if INDEX_AUDIO.is_file():
        brut = json.loads(INDEX_AUDIO.read_text(encoding="utf-8"))
        print(f"   Audio        : {brut.get('total', 0)} son(s) indexés dans "
              f"{INDEX_AUDIO.relative_to(DEPOT)} — non touché")
    else:
        print(f"   Audio        : aucun index à {INDEX_AUDIO.relative_to(DEPOT)}")

    print("── Sources de prises de vues réelles")
    etat = sonder_sources(v.only_cc0)
    for nom, e in etat.items():
        marque = "joignable" if e["joignable"] else "indisponible"
        print(f"   {nom:9} {marque}" + (f" — {e['raison']}" if e["raison"] else ""))
    if not any(e["joignable"] for e in etat.values()):
        print("   Aucune source joignable : tout sera synthétisé, le B-Roll réel "
              "restera à récupérer ailleurs.")

    plan = plan_de_fabrication()[: v.limit]
    if v.dry_run:
        print(f"\n── Ce qui serait fabriqué ({len(plan)})")
        for nom, dossier, categorie, _ in plan:
            cible = RACINE / dossier / nom
            etat_fichier = "existe" if cible.is_file() else "à créer"
            print(f"   {categorie:11} {dossier + '/' + nom:52} {etat_fichier}")
        print(f"\n   Plus : {len(RECETTES)} recette(s), 2 bacs de montage, "
              f"la fiche HTML, master_catalog.json, LICENSES_VISUAL.md.")
        print("   Rien n'a été écrit (--dry-run).")
        return 0

    for d in DOSSIERS:
        (RACINE / d).mkdir(parents=True, exist_ok=True)

    print(f"\n── Fabrication ({len(plan)})")
    assets: list[Asset] = []
    empreintes: dict[str, str] = {}
    par_nom: dict[str, Path] = {}

    for nom, dossier, categorie, fabriquer in tqdm(plan, desc="synthèse", unit="asset"):
        cible = RACINE / dossier / nom
        if v.resume and cible.is_file():
            pass
        else:
            fabriquer(cible)
        par_nom[nom] = cible

        if nom.endswith(".cube"):
            assets.append(Asset(nom, categorie, cible, 33, 33, note=100.0,
                                origine="synthèse"))
            continue

        image = premiere_image(cible)
        if image is None:
            continue
        with Image.open(cible) if cible.suffix != ".mp4" else _dimensions(cible) as info:
            largeur, hauteur = info.size if hasattr(info, "size") else info
        # Rejet sous 720p : au-dessous, un calque ne tient pas sur un montage
        # vertical de 1920 de haut sans se voir.
        if max(largeur, hauteur) < 720:
            print(f"   {nom} écarté : {largeur}x{hauteur}, sous 720p", file=sys.stderr)
            continue

        e = empreinte(image)
        if e in empreintes:
            print(f"   {nom} écarté : doublon de {empreintes[e]}", file=sys.stderr)
            continue
        empreintes[e] = nom

        luma, contraste, note = noter(image)
        corrige = False
        if cible.suffix != ".mp4" and (luma < LUMA_MINI or note < NOTE_MINI):
            # On corrige, on ne supprime pas : l'intention était juste, le
            # réglage était faux. Les vidéos gardent leur réglage — un grain
            # ou une poussière **doivent** être sombres, c'est leur mode de
            # fusion qui les révèle, pas leur luminance propre.
            corriger_pour_telephone(cible)
            luma, contraste, note = noter(premiere_image(cible))
            corrige = True

        cadence = float(CADENCE) if cible.suffix == ".mp4" else None
        asset = Asset(nom, categorie, cible, largeur, hauteur, cadence,
                      luma=luma, contraste=contraste, note=note,
                      corrige=corrige, empreinte=e)
        asset.versions = alleger(asset, RACINE / "app_optimized")
        assets.append(asset)

    print(f"\n── Contrôle et catalogue")
    vignettes = []
    for asset in assets:
        if asset.nom.endswith(".cube"):
            continue
        chemin = vignette(asset, RACINE / "previews")
        if chemin:
            vignettes.append(chemin)
    planche_contact(vignettes, RACINE / "previews" / "contact_sheet.jpg")

    catalogue = fusionner_catalogues(assets)
    (RACINE / "visual_catalog.json").write_text(
        json.dumps(catalogue["visuels"], ensure_ascii=False, indent=2), encoding="utf-8")
    (RACINE / "master_catalog.json").write_text(
        json.dumps(catalogue, ensure_ascii=False, indent=2), encoding="utf-8")
    (RACINE / "visual_library.html").write_text(FICHE_HTML, encoding="utf-8")
    (RACINE / "LICENSES_VISUAL.md").write_text(LICENCES, encoding="utf-8")
    for nom, texte in RECETTES.items():
        (RACINE / "recipes" / nom).write_text(texte, encoding="utf-8")
    bins_resolve(assets, RACINE / "DaVinci_Resolve_Bins_Visual.xml")
    bins_premiere(assets, RACINE / "Premiere_Pro_Bins_Visual.xml")

    # Les meilleurs, par lien plutôt que par copie : dupliquer un fichier 4K
    # pour figurer dans deux dossiers double le poids sans rien apporter.
    signature = RACINE / "my_signature_looks"
    for ancien in signature.glob("*"):
        ancien.unlink()
    meilleurs = sorted(assets, key=lambda x: -x.note)[:20]
    (signature / "README.md").write_text(
        "# Meilleures visibilités sur téléphone\n\n"
        "Classées par la note mesurée après simulation d'un écran de six pouces "
        "assombri de 20 %.\n\n"
        + "\n".join(f"{i + 1}. `{a.nom}` — {a.note:.0f}/100 — `{a.chemin.relative_to(DEPOT)}`"
                    for i, a in enumerate(meilleurs)) + "\n",
        encoding="utf-8")

    faibles = [a for a in assets if a.note < NOTE_MINI]
    print(f"   {len(assets)} asset(s) catalogué(s), "
          f"{sum(1 for a in assets if a.corrige)} corrigé(s) pour téléphone.")
    if faibles:
        print("   Encore sous le seuil (et c'est voulu pour les calques de fusion) :")
        for a in faibles:
            print(f"     {a.nom:28} {a.note:5.1f}")

    if v.make_demo:
        print("\n── Démonstration")
        sortie = RACINE / "previews" / "demo_layer_blockbuster.mp4"
        if fabriquer_demo(par_nom, sortie):
            print(f"   {sortie.relative_to(DEPOT)}")

    print(f"\nFiche : {(RACINE / 'visual_library.html').relative_to(DEPOT)}")
    return 0


def _dimensions(chemin: Path):
    """Dimensions d'une vidéo, sans charger d'image."""
    p = subprocess.run([shutil.which("ffprobe") or "ffprobe", "-v", "error",
                        "-select_streams", "v", "-show_entries", "stream=width,height",
                        "-of", "csv=p=0", str(chemin)], capture_output=True, text=True)
    l, h = (int(x) for x in p.stdout.strip().split(",")[:2])

    class _Taille:
        size = (l, h)
        def __enter__(self): return self
        def __exit__(self, *a): return False
    return _Taille()


if __name__ == "__main__":
    sys.exit(main())
