#!/usr/bin/env python3
"""Étape 3 — refabriquer le jeu des sept différences de la page 17.

Les deux vignettes livrées n'étaient pas deux versions d'un même dessin : après
recalage optimal, l'écart moyen restait à 53 sur 255. Nuages, fougères et poses
différaient partout. Le jeu était injouable — un enfant y aurait trouvé des
dizaines d'écarts, dont aucun n'était « le bon ».

On repart donc d'une **référence unique**, la vignette de gauche, et on
fabrique celle de droite par sept modifications déclarées. Ce que le lecteur
trouve est alors exactement ce que la page de solutions annonce.

Les sept écarts montent en difficulté : deux virages de couleur sur les héros
en pleine lumière, puis un détail plus petit, puis la périphérie, puis une
suppression noyée dans le fouillis du pique-nique, et pour finir un ajout —
ce qui manque se voit toujours moins bien que ce qui change.
"""

from __future__ import annotations

import colorsys
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image

# Cadres des deux vignettes dans la planche d'origine (1600 x 1600).
VIGNETTE_A = (52, 210, 779, 1520)
VIGNETTE_B = (816, 210, 1549, 1520)

# La vignette de droite dérive de celle de gauche : elle en emporte le macaron
# « A ». On y remet la lettre « B » de l'original — la LETTRE seule, pas le
# cadre. Reporter le cadre entraînait avec lui quelques pixels du ciel voisin,
# et le filet du macaron se retrouvait doublé. Le cadre, lui, est le même des
# deux côtés : il n'y a rien à y changer.
MACARON_B = (829, 221, 887, 279)


@dataclass
class Ecart:
    rang: int
    intitule: str
    ou: str
    boite: tuple[int, int, int, int]      # dans le repère de la vignette
    genre: str                            # 'teinte' | 'effacer' | 'ajouter'
    teinte_source: float | None = None    # 0-1
    teinte_cible: float | None = None
    tolerance: float = 0.09
    saturation_min: float = 0.18
    # Plafond de clarté : sur cette planche, la veste du korrigan et son pelage
    # partagent exactement la même teinte brune. Seule la clarté les sépare
    # (0,26 contre 0,47), et c'est elle qui permet d'englober tout le
    # personnage sans lui bleuir le visage.
    clarte_max: float | None = None
    source: tuple[int, int, int, int] | None = None   # pour 'effacer' et 'ajouter'
    options: dict = field(default_factory=dict)


# Ordre de difficulté croissante : c'est lui qui numérote le jeu et la solution.
ECARTS: list[Ecart] = [
    Ecart(1, "Le foulard de Roussy est rouge au lieu de bleu",
          "au cou du renard, au centre de l'image",
          (197, 603, 289, 674), "teinte", teinte_source=0.62, teinte_cible=0.99,
          tolerance=0.10, saturation_min=0.15),
    Ecart(2, "Le jus de la bouteille est vert au lieu de violet",
          "dans la bouteille que tient Zéphy",
          (347, 540, 400, 643), "teinte", teinte_source=0.78, teinte_cible=0.32,
          tolerance=0.10, saturation_min=0.12),
    Ecart(3, "La confiture de la crêpe est à la myrtille, pas à la fraise",
          "sur la crêpe posée au centre de la pierre",
          (269, 794, 383, 857), "teinte", teinte_source=0.01, teinte_cible=0.70,
          tolerance=0.045, saturation_min=0.40),
    Ecart(4, "Le triskell du menhir de gauche est violet au lieu de vert",
          "sur la pierre dressée la plus à gauche",
          (24, 318, 105, 578), "teinte", teinte_source=0.33, teinte_cible=0.78,
          tolerance=0.05, saturation_min=0.12),
    Ecart(5, "La veste du korrigan est bleue au lieu d'être brune",
          "en bas à droite, derrière l'hermine",
          (600, 1052, 727, 1215), "teinte", teinte_source=0.07, teinte_cible=0.58,
          tolerance=0.06, saturation_min=0.32),
    Ecart(6, "Les fraises ont disparu de la nappe",
          "sur la nappe du pique-nique, en bas à gauche",
          (254, 1060, 309, 1111), "effacer", source=(186, 1064, 241, 1115)),
    Ecart(7, "Un triskell doré est apparu sur la grande aile de Zéphy",
          "sur les plumes larges du bas de l'aile droite",
          (600, 352, 660, 412), "ajouter", source=(157, 343, 223, 406),
          options={"fondu": 0.78, "teinte_cible": 0.12}),
]


def _virer_teinte(image: Image.Image, e: Ecart) -> int:
    """Fait tourner la teinte des pixels d'une couleur donnée, dans une boîte.

    On ne repeint pas la boîte : on ne touche qu'aux pixels dont la teinte est
    proche de la couleur visée et dont la saturation dépasse un seuil. Le gris
    du menhir, le blanc de la nappe et les ombres restent intacts — sans quoi le
    rectangle de travail se verrait comme un timbre collé.
    """
    zone = np.asarray(image.crop(e.boite).convert("RGB")).astype(np.float32) / 255
    h, s, v = np.vectorize(colorsys.rgb_to_hsv)(zone[..., 0], zone[..., 1], zone[..., 2])

    ecart = np.abs(h - e.teinte_source)
    ecart = np.minimum(ecart, 1 - ecart)          # la teinte est circulaire
    choisis = (ecart <= e.tolerance) & (s >= e.saturation_min)
    if e.clarte_max is not None:
        choisis &= v <= e.clarte_max
    if not choisis.any():
        return 0

    decalage = (e.teinte_cible - e.teinte_source) % 1.0
    h2 = np.where(choisis, (h + decalage) % 1.0, h)
    r, g, b = np.vectorize(colorsys.hsv_to_rgb)(h2, s, v)
    neuve = np.stack([r, g, b], axis=-1) * 255

    # Fondu sur les bords de la boîte. Sans lui, un objet qui déborde du cadre
    # de travail — le col d'une veste, le bas d'un triskell — se retrouve coupé
    # net par une arête horizontale ou verticale que l'œil repère aussitôt,
    # alors même que la couleur, elle, est juste.
    ancienne = zone * 255
    alpha = _fondu_de_bord(neuve.shape[0], neuve.shape[1], e.options.get("fondu_bord", 9))
    melange = ancienne + (neuve - ancienne) * alpha[..., None]
    image.paste(Image.fromarray(melange.clip(0, 255).astype(np.uint8)), e.boite[:2])
    return int(choisis.sum())


def _fondu_de_bord(hauteur: int, largeur: int, marge: int) -> np.ndarray:
    """Rampe d'opacité valant 1 au centre et 0 sur le pourtour de la boîte."""
    if marge <= 0:
        return np.ones((hauteur, largeur), np.float32)
    y = np.minimum(np.arange(hauteur), hauteur - 1 - np.arange(hauteur))
    x = np.minimum(np.arange(largeur), largeur - 1 - np.arange(largeur))
    return np.minimum.outer(np.clip(y / marge, 0, 1), np.clip(x / marge, 0, 1)).astype(np.float32)


def _effacer(image: Image.Image, e: Ecart) -> int:
    """Recouvre un objet par un morceau voisin du même décor, fondu sur les bords."""
    largeur = e.boite[2] - e.boite[0]
    hauteur = e.boite[3] - e.boite[1]
    piece = image.crop(e.source).resize((largeur, hauteur), Image.LANCZOS)
    masque = _masque_ovale(largeur, hauteur, douceur=0.22)
    image.paste(piece, e.boite[:2], masque)
    return largeur * hauteur


def _ajouter(image: Image.Image, e: Ecart) -> int:
    """Recopie un motif du décor à un autre endroit, en le fondant dans la pierre."""
    largeur = e.boite[2] - e.boite[0]
    hauteur = e.boite[3] - e.boite[1]
    motif = image.crop(e.source).resize((largeur, hauteur), Image.LANCZOS)
    if "teinte_cible" in e.options:
        # Un triskell violet posé sur une aile violette serait introuvable.
        # On le vire au doré, qui est l'autre couleur des ailes de Zéphy :
        # le motif reste dans la charte tout en se détachant des plumes.
        z = np.asarray(motif).astype(np.float32) / 255
        h, sat, val = np.vectorize(colorsys.rgb_to_hsv)(z[..., 0], z[..., 1], z[..., 2])
        vise = (sat >= 0.20)
        h = np.where(vise, e.options["teinte_cible"], h)
        sat = np.where(vise, np.clip(sat * 1.25, 0, 1), sat)
        r, g, b = np.vectorize(colorsys.hsv_to_rgb)(h, sat, val)
        motif = Image.fromarray((np.stack([r, g, b], -1) * 255).clip(0, 255).astype(np.uint8))
    masque = _masque_ovale(largeur, hauteur, douceur=0.30)
    if "fondu" in e.options:
        masque = masque.point(lambda v: int(v * e.options["fondu"]))
    image.paste(motif, e.boite[:2], masque)
    return largeur * hauteur


def _masque_ovale(largeur: int, hauteur: int, douceur: float) -> Image.Image:
    """Masque doux : un rectangle net trahirait la retouche."""
    y, x = np.mgrid[0:hauteur, 0:largeur]
    cx, cy = (largeur - 1) / 2, (hauteur - 1) / 2
    d = np.sqrt(((x - cx) / max(cx, 1)) ** 2 + ((y - cy) / max(cy, 1)) ** 2)
    bord = 1 - douceur
    alpha = np.clip((1 - d) / max(douceur, 1e-3), 0, 1)
    alpha = np.where(d <= bord, 1.0, alpha)
    return Image.fromarray((alpha * 255).astype(np.uint8), "L")


def fabriquer(source: Path, cible: Path) -> list[tuple[Ecart, int]]:
    with Image.open(source) as brut:
        planche = brut.convert("RGB")

    vignette = planche.crop(VIGNETTE_A)
    journal = []
    for e in ECARTS:
        if e.genre == "teinte":
            n = _virer_teinte(vignette, e)
        elif e.genre == "effacer":
            n = _effacer(vignette, e)
        else:
            n = _ajouter(vignette, e)
        journal.append((e, n))

    largeur = VIGNETTE_B[2] - VIGNETTE_B[0]
    hauteur = VIGNETTE_B[3] - VIGNETTE_B[1]
    lettre = planche.crop(MACARON_B)
    planche.paste(vignette.resize((largeur, hauteur), Image.LANCZOS), VIGNETTE_B[:2])
    planche.paste(lettre, MACARON_B[:2],
                  _masque_ovale(MACARON_B[2] - MACARON_B[0],
                                MACARON_B[3] - MACARON_B[1], douceur=0.18))

    cible.parent.mkdir(parents=True, exist_ok=True)
    planche.save(cible, compress_level=6)
    return journal


if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--source", required=True)
    a.add_argument("--vers", required=True)
    args = a.parse_args()
    for e, n in fabriquer(Path(args.source), Path(args.vers)):
        print(f"  {e.rang}. {e.intitule:62s} {n:>7d} px")
    print(f"\n7 écarts déclarés, du plus visible au plus discret -> {args.vers}")
