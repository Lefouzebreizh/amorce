#!/usr/bin/env python3
"""Imprimables A4 dérivés des planches d'activité de l'album.

Ce sont eux qu'on échange contre une adresse e-mail : « inscris-toi à ma
newsletter » n'est pas une raison de donner son adresse, « télécharge les
coloriages » en est une.

Trois contraintes qui expliquent la forme du fichier :

- **A4 et non carré.** Les gens impriment sur l'imprimante qu'ils ont. Une page
  carrée sortirait centrée sur du A4 avec des marges absurdes ; autant les
  composer nous-mêmes proprement.
- **Rien dans la zone que l'imprimante ne sait pas atteindre.** La plupart des
  imprimantes domestiques ne vont pas jusqu'au bord : on garde un centimètre.
- **Pas de fond crème pleine page.** Un aplat A4 vide une cartouche pour rien.
  Le coloriage part sur blanc ; les autres gardent leur fond, mais la mention de
  bas de page reste sobre.
"""

from __future__ import annotations

import io
import sys
from dataclasses import dataclass
from pathlib import Path

import pymupdf
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import charte  # noqa: E402

A4 = (595.28, 841.89)          # points
MARGE = 1.0 * 28.3465          # 1 cm, atteignable par toute imprimante domestique
POLICE = charte.POLICES / "Lora-Italic.ttf"


@dataclass
class Imprimable:
    fichier: str
    page: int
    titre: str
    consigne: str
    blanchir: bool = False     # ramener le fond au blanc, pour économiser l'encre


IMPRIMABLES = (
    Imprimable("coloriage", 19, "Roussy & Zéphy — à colorier",
               "Prends tes crayons. Il n’y a pas de mauvaise couleur.",
               blanchir=True),
    Imprimable("dessine-ton-animal", 18, "Dessine ton animal magique",
               "À quoi ressemble le tien ? Donne-lui un nom, et des ailes s’il en veut."),
    Imprimable("journal-de-lumiere", 20, "Mon journal de lumière",
               "Une page par jour. Même les jours où c’est petit."),
)


def _blanchir(image: Image.Image, seuil: int = 205) -> Image.Image:
    """Ramène le papier crème au blanc pur, sans toucher au trait.

    Un coloriage sur fond crème pleine page consomme une cartouche entière pour
    un résultat plus terne que du papier nu. On ne blanchit que ce qui est déjà
    clair : le trait, lui, ne bouge pas d'un ton.
    """
    import numpy as np
    a = np.asarray(image.convert("RGB")).astype(np.int16)
    clair = a.min(axis=2) >= seuil
    a[clair] = 255
    return Image.fromarray(a.astype("uint8"))


def composer(planches: Path, vers: Path, site: str) -> list[Path]:
    vers.mkdir(parents=True, exist_ok=True)
    faits = []

    for item in IMPRIMABLES:
        page = next(p for p in charte.TOME_1 if p.numero == item.page)
        base = charte.nom_de_page(page.numero, page.slug, "")
        source = next((planches / f"{base}{e}" for e in (".png", ".webp", ".jpg")
                       if (planches / f"{base}{e}").exists()), None)
        if source is None:
            print(f"  {item.fichier:22s} planche {item.page} absente, sautée")
            continue

        with Image.open(source) as brut:
            image = brut.convert("RGB")
        if item.blanchir:
            image = _blanchir(image)

        document = pymupdf.open()
        feuille = document.new_page(width=A4[0], height=A4[1])
        feuille.insert_font(fontname="ital", fontfile=str(POLICE))

        # Le titre en haut, la mention en bas, l'image au milieu de ce qui reste.
        haut, bas = MARGE + 34, A4[1] - MARGE - 30
        cote = min(A4[0] - 2 * MARGE, bas - haut)
        x = (A4[0] - cote) / 2
        y = haut + (bas - haut - cote) / 2

        tampon = io.BytesIO()
        image.save(tampon, format="PNG", compress_level=6)
        feuille.insert_image(pymupdf.Rect(x, y, x + cote, y + cote), stream=tampon.getvalue())

        feuille.insert_textbox(pymupdf.Rect(MARGE, MARGE, A4[0] - MARGE, MARGE + 30),
                               item.titre, fontname="ital", fontsize=15,
                               color=(0.36, 0.24, 0.12), align=pymupdf.TEXT_ALIGN_CENTER)
        feuille.insert_textbox(pymupdf.Rect(MARGE, bas + 2, A4[0] - MARGE, A4[1] - MARGE),
                               f"{item.consigne}     ·     {site}",
                               fontname="ital", fontsize=8.5,
                               color=(0.52, 0.44, 0.34), align=pymupdf.TEXT_ALIGN_CENTER)

        document.set_metadata({"title": f"{item.titre} — Roussy & Zéphy",
                               "author": "Erwann Lefouzèbreizh"})
        chemin = vers / f"roussy-et-zephy_{item.fichier}.pdf"
        document.save(str(chemin), deflate=True, garbage=4)
        document.close()
        faits.append(chemin)
        print(f"  {item.fichier:22s} A4 · {chemin.stat().st_size/1e6:.1f} Mo · {chemin.name}")

    return faits


if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--planches", required=True)
    a.add_argument("--vers", required=True)
    a.add_argument("--site", default="roussyetzephy.fr")
    args = a.parse_args()
    faits = composer(Path(args.planches), Path(args.vers), args.site)
    print(f"\n{len(faits)} imprimable(s) prêt(s) dans {args.vers}")
