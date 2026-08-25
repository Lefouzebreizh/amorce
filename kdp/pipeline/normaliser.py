#!/usr/bin/env python3
"""Étape 1 — porter chaque planche à 2600 px et rentrer le contenu dans la marge.

Deux opérations, toutes deux imposées par KDP et aucune anodine.

**Agrandissement.** Les sources vont de 1080 à 2048 px ; il en faut 2588 pour
tenir 300 DPI sur 8,625 po. On interpole en Lanczos, puis un très léger
renforcement d'acutance compense le flou propre au rééchantillonnage. Il faut
le dire nettement : cela ne crée aucun détail. La finesse perdue par la source
ne revient pas, on la rend seulement moins molle à l'impression.

**Rentrée du contenu.** Le titre et le parchemin des planches tombent hors de
la zone de sécurité. On réduit donc la planche entière de quelques pour cent et
on la recentre, puis on prolonge le papier crème jusqu'aux bords du gabarit. Le
massicot ne mord alors plus que du fond.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import charte  # noqa: E402

COTE = 2600                 # au-delà des 2588 px exigés par 300 DPI
RENTREE = 0.07              # réduction du contenu utile : 7 %
ACUTANCE = dict(radius=1.6, percent=55, threshold=3)


def couleur_du_fond(image: Image.Image, epaisseur: float = 0.012) -> tuple[int, int, int]:
    """Couleur médiane de l'anneau extérieur, qui est du papier sur toutes les planches.

    La médiane, et non la moyenne : une feuille d'automne qui dépasse dans
    l'anneau tirerait la moyenne vers le roux, la médiane l'ignore.
    """
    a = np.asarray(image.convert("RGB"))
    h, w, _ = a.shape
    e = max(2, int(min(h, w) * epaisseur))
    anneau = np.concatenate([
        a[:e, :, :].reshape(-1, 3), a[-e:, :, :].reshape(-1, 3),
        a[:, :e, :].reshape(-1, 3), a[:, -e:, :].reshape(-1, 3),
    ])
    return tuple(int(v) for v in np.median(anneau, axis=0))


def normaliser(source: Path, cible: Path, rentree: float = RENTREE,
               cote: int = COTE) -> dict:
    with Image.open(source) as brut:
        image = brut.convert("RGB")
    depart = image.size

    fond = couleur_du_fond(image)
    utile = max(1, round(cote * (1 - rentree)))

    agrandie = image.resize((utile, utile), Image.LANCZOS)
    agrandie = agrandie.filter(ImageFilter.UnsharpMask(**ACUTANCE))

    planche = Image.new("RGB", (cote, cote), fond)
    marge = (cote - utile) // 2
    planche.paste(agrandie, (marge, marge))

    # Le raccord entre la planche réduite et le fond ajouté est une arête nette.
    # Un flou local le fond dans le papier ; il ne porte que sur du fond crème,
    # jamais sur du dessin.
    _adoucir_le_raccord(planche, marge, utile)

    cible.parent.mkdir(parents=True, exist_ok=True)
    planche.save(cible, format="PNG", compress_level=6)
    return {
        "depart": depart, "arrivee": planche.size, "marge_px": marge,
        "dpi_avant": depart[0] / charte.GABARIT_INTERIEUR.largeur,
        "dpi_apres": cote / charte.GABARIT_INTERIEUR.largeur,
        "fond": fond,
    }


def _adoucir_le_raccord(planche: Image.Image, marge: int, utile: int, rayon: int = 6) -> None:
    bande = rayon * 2
    for boite in (
        (0, max(0, marge - bande), planche.width, marge + bande),
        (0, marge + utile - bande, planche.width, min(planche.height, marge + utile + bande)),
        (max(0, marge - bande), 0, marge + bande, planche.height),
        (marge + utile - bande, 0, min(planche.width, marge + utile + bande), planche.height),
    ):
        morceau = planche.crop(boite).filter(ImageFilter.GaussianBlur(rayon / 2))
        planche.paste(morceau, boite[:2])


if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--source", required=True)
    a.add_argument("--vers", required=True)
    a.add_argument("--rentree", type=float, default=RENTREE)
    args = a.parse_args()

    source, vers = Path(args.source), Path(args.vers)
    fichiers = sorted(p for p in source.iterdir()
                      if p.suffix.lower() in (".webp", ".jpg", ".jpeg", ".png"))
    for f in fichiers:
        r = normaliser(f, vers / f"{f.stem}.png", args.rentree)
        print(f"  {f.name:50s} {r['depart'][0]:>4}px ({r['dpi_avant']:>3.0f} DPI) "
              f"-> {r['arrivee'][0]}px ({r['dpi_apres']:.0f} DPI)  fond {r['fond']}")
    print(f"\n{len(fichiers)} planche(s) normalisée(s) dans {vers}")
