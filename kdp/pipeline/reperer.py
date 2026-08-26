#!/usr/bin/env python3
"""Outil de repérage : retrouve les boîtes des mots dans une zone de bulle.

Sert à situer une coquille au pixel près sans la pointer à la main. Le texte des
bulles est sombre sur un fond très clair : un seuil suffit à l'isoler, une
dilatation horizontale recolle les lettres en mots, et les composantes connexes
donnent les boîtes, rendues dans l'ordre de lecture.
"""

from __future__ import annotations

import cv2
import numpy as np
from PIL import Image


def mots(image: Image.Image, zone: tuple[int, int, int, int],
         seuil: int = 150, liant: int = 9) -> list[tuple[int, int, int, int]]:
    """Boîtes des mots de `zone`, en coordonnées absolues, dans l'ordre de lecture."""
    x0, y0, x1, y1 = zone
    gris = np.asarray(image.convert("L").crop(zone))
    encre = (gris < seuil).astype(np.uint8) * 255

    # Dilatation horizontale : recolle les lettres d'un mot sans souder les mots
    # voisins. Le liant est plus large que l'approche des lettres, plus étroit
    # que l'espace-mot.
    noyau = cv2.getStructuringElement(cv2.MORPH_RECT, (liant, 3))
    dense = cv2.dilate(encre, noyau, iterations=1)

    n, _, stats, _ = cv2.connectedComponentsWithStats(dense, 8)
    boites = []
    for i in range(1, n):
        x, y, w, h, aire = stats[i]
        if aire < 40 or w < 6 or h < 8:
            continue
        boites.append((x0 + x, y0 + y, x0 + x + w, y0 + y + h))
    # Ordre de lecture : par ligne (tolérance d'une demi-hauteur), puis par x.
    if not boites:
        return []
    hauteur = int(np.median([b[3] - b[1] for b in boites]))
    boites.sort(key=lambda b: (round(b[1] / max(1, hauteur * 0.6)), b[0]))
    return boites


if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser()
    a.add_argument("image")
    a.add_argument("--zone", required=True, help="x0,y0,x1,y1")
    a.add_argument("--seuil", type=int, default=150)
    a.add_argument("--liant", type=int, default=9)
    args = a.parse_args()
    im = Image.open(args.image)
    z = tuple(int(v) for v in args.zone.split(","))
    for i, b in enumerate(mots(im, z, args.seuil, args.liant), 1):
        print(f"  {i:2d}. x {b[0]:5d}-{b[2]:5d}  y {b[1]:5d}-{b[3]:5d}  "
              f"({b[2]-b[0]}x{b[3]-b[1]})")
