#!/usr/bin/env python3
"""Première de couverture provisoire, composée faute d'illustration dédiée.

À dire d'emblée : **cette couverture est un provisoire, pas une couverture.**
La première de couverture est la seule image du produit que la plupart des gens
verront — en vignette de 150 pixels, dans une liste Amazon, à côté de vingt
autres. Elle mérite une illustration faite pour elle, cadrée pour elle, lisible
à cette taille-là.

Ce module existe pour deux raisons seulement : rendre le fichier déposable, et
permettre de juger la géométrie, la tranche et les marges sur un objet complet.
La vignette est empruntée à la page 21, ce qui la ferait apparaître deux fois
dans le volume — raison de plus pour la remplacer.

Voir `kdp/relecture/COUVERTURE-FACE.md` pour ce que doit être la vraie.
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import fitz
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import charte  # noqa: E402
from pipeline.bordure import fond_charte  # noqa: E402

POLICES = Path("/mnt/skills/examples/canvas-design/canvas-fonts")
CORPS, ITALIQUE, GRAS = (POLICES / f"Lora-{n}.ttf" for n in ("Regular", "Italic", "Bold"))

BRUN, BRUN_PALE, ENCRE = (0.34, 0.22, 0.10), (0.45, 0.34, 0.20), (0.16, 0.13, 0.11)

# Vignette empruntée à la page 21, dans les proportions de cette planche.
VIGNETTE = (0.085, 0.055, 0.915, 0.545)

TITRE = "Roussy & Zéphy"
ACCROCHE = "Et si ta différence était ta plus grande force ?"
AUTEUR = "Erwann Lefouzèbreizh"
TOME = "Tome 1"


def _poser(page: fitz.Page, cadre: fitz.Rect, texte: str, police: str,
           taille: float, couleur, interligne: float = 1.3) -> float:
    """Écrit dans une boîte en réduisant le corps jusqu'à ce que ça tienne.

    PyMuPDF n'écrit rien du tout quand le texte dépasse, sans rien signaler :
    un titre absent d'une couverture est passé inaperçu jusqu'au rendu. On
    boucle donc plutôt que de faire confiance à une taille choisie à la main.
    """
    while taille > 6:
        if page.insert_textbox(cadre, texte, fontname=police, fontsize=taille,
                               lineheight=interligne, color=couleur,
                               align=fitz.TEXT_ALIGN_CENTER) >= 0:
            return taille
        taille -= 0.5
    raise SystemExit(f"texte impossible à poser : {texte[:40]}")


def composer(bordure: Path, illustration: Path, cible: Path,
             cote_px: int = 2600) -> None:
    # Le panneau de première a du fond perdu en haut, en bas et sur la tranche
    # extérieure : il est donc plus haut que large, comme le veut KDP.
    largeur = (charte.FORMAT_ROGNE + charte.FOND_PERDU) * charte.POUCE_EN_POINTS
    hauteur = (charte.FORMAT_ROGNE + 2 * charte.FOND_PERDU) * charte.POUCE_EN_POINTS

    fond = fond_charte(bordure, cote_px).resize(
        (cote_px, round(cote_px * hauteur / largeur)), Image.LANCZOS)
    tampon = io.BytesIO()
    # Fond en JPEG et non en PNG, à l'inverse des planches. Ce fond-ci n'est
    # pas une illustration : c'est un aplat crème au grain calculé, que le PNG
    # stocke à 5,9 Mo là où un JPEG de haute qualité tient en un demi-mégaoctet
    # sans différence visible. La règle « aucune compression destructive » vaut
    # pour le dessin de l'auteur, pas pour un fond que ce dépôt fabrique.
    fond.save(tampon, format="JPEG", quality=94, optimize=True, subsampling=0)

    document = fitz.open()
    page = document.new_page(width=largeur, height=hauteur)
    page.insert_image(fitz.Rect(0, 0, largeur, hauteur), stream=tampon.getvalue())
    page.insert_font(fontname="corps", fontfile=str(CORPS))
    page.insert_font(fontname="ital", fontfile=str(ITALIQUE))
    page.insert_font(fontname="gras", fontfile=str(GRAS))

    with Image.open(illustration) as brut:
        planche = brut.convert("RGB")
    w, h = planche.size
    vignette = planche.crop((int(VIGNETTE[0] * w), int(VIGNETTE[1] * h),
                             int(VIGNETTE[2] * w), int(VIGNETTE[3] * h)))
    vig = io.BytesIO()
    vignette.save(vig, format="PNG", compress_level=6)

    # Marge de sécurité prise large : sur une couverture, un titre rogné est
    # un livre refusé, pas un défaut cosmétique.
    marge = (charte.FOND_PERDU + charte.MARGE_SECURITE + 0.18) * charte.POUCE_EN_POINTS
    gauche, droite = marge, largeur - marge

    corps = _poser(page, fitz.Rect(gauche, 0.095 * hauteur, droite, 0.215 * hauteur),
                   TITRE, "gras", 44, BRUN, 1.15)
    _poser(page, fitz.Rect(gauche, 0.222 * hauteur, droite, 0.285 * hauteur),
           ACCROCHE, "ital", 15, BRUN_PALE, 1.45)

    haut, bas = 0.315 * hauteur, 0.755 * hauteur
    rapport = vignette.width / vignette.height
    dispo_l = droite - gauche
    if dispo_l / (bas - haut) > rapport:
        ph, pl = bas - haut, (bas - haut) * rapport
    else:
        pl, ph = dispo_l, dispo_l / rapport
    page.insert_image(fitz.Rect((largeur - pl) / 2, haut, (largeur + pl) / 2, haut + ph),
                      stream=vig.getvalue())

    _poser(page, fitz.Rect(gauche, 0.800 * hauteur, droite, 0.855 * hauteur),
           AUTEUR, "corps", 16, ENCRE)
    _poser(page, fitz.Rect(gauche, 0.862 * hauteur, droite, 0.905 * hauteur),
           TOME, "ital", 12, BRUN_PALE)

    document.set_metadata({"title": "Roussy & Zéphy — première de couverture (provisoire)",
                           "author": AUTEUR})
    cible.parent.mkdir(parents=True, exist_ok=True)
    document.save(str(cible), deflate=True, garbage=4)
    document.close()

    dpi = vignette.width / (pl / charte.POUCE_EN_POINTS)
    print(f"{cible} — {largeur/72:.4f} x {hauteur/72:.4f} po, titre au corps {corps:.0f} pt")
    print(f"  vignette empruntée à {illustration.name} : {dpi:.0f} DPI à la taille posée")
    print("  PROVISOIRE — à remplacer par une illustration faite pour la couverture")


if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--bordure", required=True)
    a.add_argument("--illustration", required=True)
    a.add_argument("--vers", required=True)
    args = a.parse_args()
    composer(Path(args.bordure), Path(args.illustration), Path(args.vers))
