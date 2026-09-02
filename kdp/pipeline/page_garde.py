#!/usr/bin/env python3
"""Page de garde « Ce livre appartient à », composée en vectoriel.

La planche fournie pour cette page mesurait 1024 pixels, soit 119 DPI : il
aurait fallu l'agrandir deux fois et demie pour atteindre la cible, et le trait
fin d'une page presque vide n'y aurait pas survécu.

Or cette page-là n'a presque rien à dessiner — un titre, des lignes à remplir,
un ornement. Tout cela se trace, et se trace mieux : la page devient la plus
nette du volume au lieu d'en être la plus molle.

Les lignes d'écriture sont en gris moyen continu, et non en or pâle pointillé
comme celles du journal du Tome 1 : sur du papier couleur standard, un
pointillé doré disparaît, alors que ce sont précisément ces lignes qui disent à
l'enfant où écrire.
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import charte  # noqa: E402
from pipeline.bordure import fond_charte  # noqa: E402
from pipeline.page12 import _triskell  # noqa: E402

POLICES = charte.POLICES
CORPS, ITALIQUE, GRAS = (POLICES / f"Lora-{n}.ttf" for n in ("Regular", "Italic", "Bold"))
BRUN, BRUN_PALE = (0.36, 0.24, 0.12), (0.45, 0.34, 0.20)
LIGNE = (0.55, 0.50, 0.44)          # gris moyen : visible à l'impression couleur

CHAMPS = (
    ("Ce livre appartient à", 0.255, 21, "gras"),
    ("Offert par", 0.455, 13, "ital"),
    ("Le", 0.605, 13, "ital"),
)


def composer(bordure: Path, cible: Path, gabarit: charte.Gabarit | None = None,
             cote_px: int = 2600) -> None:
    gabarit = gabarit or charte.GABARIT_INTERIEUR
    largeur, hauteur = gabarit.points

    tampon = io.BytesIO()
    fond_charte(bordure, cote_px).save(tampon, format="JPEG", quality=94,
                                       optimize=True, subsampling=0)

    document = pymupdf.open()
    page = document.new_page(width=largeur, height=hauteur)
    page.insert_image(pymupdf.Rect(0, 0, largeur, hauteur), stream=tampon.getvalue())
    page.insert_font(fontname="corps", fontfile=str(CORPS))
    page.insert_font(fontname="ital", fontfile=str(ITALIQUE))
    page.insert_font(fontname="gras", fontfile=str(GRAS))

    marge = (charte.FOND_PERDU + charte.MARGE_SECURITE + 0.30) * charte.POUCE_EN_POINTS
    gauche, droite = marge, largeur - marge

    for texte, y, corps, police in CHAMPS:
        page.insert_textbox(pymupdf.Rect(gauche, y * hauteur, droite, (y + 0.06) * hauteur),
                            texte, fontname=police, fontsize=corps,
                            color=BRUN if police == "gras" else BRUN_PALE,
                            align=pymupdf.TEXT_ALIGN_CENTER)
        # La ligne se pose sous le libellé, avec de quoi écrire dessus.
        base = (y + 0.075) * hauteur
        page.draw_line(pymupdf.Point(gauche + 18, base), pymupdf.Point(droite - 18, base),
                       color=LIGNE, width=0.9)

    _triskell(page, pymupdf.Point(largeur / 2, 0.775 * hauteur), 16)
    page.insert_textbox(pymupdf.Rect(gauche, 0.845 * hauteur, droite, 0.895 * hauteur),
                        "Roussy & Zéphy  ·  Tome 1", fontname="ital", fontsize=11,
                        color=BRUN_PALE, align=pymupdf.TEXT_ALIGN_CENTER)

    document.set_metadata({"title": "Roussy & Zéphy — page de garde",
                           "author": "Erwann Lefouzèbreizh"})
    cible.parent.mkdir(parents=True, exist_ok=True)
    document.save(str(cible), deflate=True, garbage=4)
    document.close()
    print(f"{cible} — page de garde entièrement vectorielle, "
          f"{len(CHAMPS)} champs à remplir")


if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--bordure", required=True)
    a.add_argument("--vers", required=True)
    args = a.parse_args()
    composer(Path(args.bordure), Path(args.vers))
