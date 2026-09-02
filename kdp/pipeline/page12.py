#!/usr/bin/env python3
"""Page 12 — « Le secret de l'hermine », composée en attendant sa planche.

Cette histoire est annoncée sur la quatrième de couverture et inscrite au
sommaire, mais elle n'a jamais été illustrée. Le PDF portait donc un carton
d'attente, et le livre mentait à son lecteur dès le dos.

On la compose en prose plutôt que de laisser un trou. Trois décisions, chacune
prise contre une solution plus courte :

- **Pas de vignette prélevée sur la page 17.** L'hermine y existe déjà, et la
  tentation était de la découper. À la taille utile elle sortirait à 94 DPI :
  ce serait reculer, pas dépanner.
- **Tout en vectoriel**, texte et ornement compris. Cette page-ci sera la plus
  nette du volume, ce qui est un comble mais vaut mieux que l'inverse.
- **En prose, pas en page de titre.** Une page de titre laisserait le sommaire
  mentir. La prose raconte vraiment l'histoire ; elle change de registre, et
  c'est assumé.

Cette page reste un **provisoire**. Le jour où la planche 2 × 2 existe, elle la
remplace et ce module ne sert plus.
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import pymupdf
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import charte  # noqa: E402
from pipeline.bordure import fond_charte  # noqa: E402

POLICES = charte.POLICES
CORPS, ITALIQUE, GRAS = (POLICES / f"Lora-{n}.ttf" for n in ("Regular", "Italic", "Bold"))

BRUN, BRUN_PALE, ENCRE = (0.36, 0.24, 0.12), (0.45, 0.34, 0.20), (0.16, 0.13, 0.11)

TITRE = "Le secret de l’hermine"

CONTE = """Il y avait, en travers du chemin creux, une ornière pleine de boue. Roussy s’arrêta net.

— Je ne bouge pas. L’hermine, elle, ne se salit jamais. Alors si je fais une tache, tout est raté.

Zéphy prit son élan et atterrit à plat dans la boue. SPLATCH. Il en ressortit entièrement marron, avec seulement les dents et les yeux blancs.

— Ah bon ? Alors je viens de tout rater onze fois en une seule seconde !

C’est là qu’une petite hermine sortit des fougères. Toute blanche — sauf ses quatre pattes, noires jusqu’en haut.

— Qui raconte que je ne me salis jamais ? Je suis blanche, je ne suis pas magique.

— Et le secret, alors ? demanda Zéphy.

— Le ruisseau est juste derrière.

Roussy regarda la boue un long moment. Puis il sauta dedans à pieds joints, et courut se rincer en riant.

— J’ai une tache ! Et je sais où elle s’en va !

— Attention, dit Zéphy, moi j’en ai partout. Il va me falloir toute la Bretagne."""

PARCHEMIN = ("Le secret de l’hermine, ce n’est pas de n’avoir jamais de tache.\n"
             "C’est de savoir qu’une tache, ça s’en va.")


def _fond(bordure: Path, cote: int = 2600) -> bytes:
    tampon = io.BytesIO()
    # Fond en JPEG et non en PNG, à l'inverse des planches. Ce fond-ci n'est
    # pas une illustration : c'est un aplat crème au grain calculé, que le PNG
    # stocke à 5,9 Mo là où un JPEG de haute qualité tient en un demi-mégaoctet
    # sans différence visible. La règle « aucune compression destructive » vaut
    # pour le dessin de l'auteur, pas pour un fond que ce dépôt fabrique.
    fond_charte(bordure, cote).save(tampon, format="JPEG", quality=94,
                                    optimize=True, subsampling=0)
    return tampon.getvalue()


def _triskell(page: pymupdf.Page, centre: pymupdf.Point, rayon: float,
              tours: float = 0.95, points: int = 44) -> None:
    """Triskell tracé, et non posé en image : net à toute échelle.

    Trois spirales calculées, et non trois courbes de Bézier aux points de
    contrôle devinés. Les deux essais précédents donnaient un trèfle puis un
    gribouillis : une spirale ne s'approxime pas au jugé, elle s'écrit — le
    rayon croît avec l'angle, et c'est tout.
    """
    import math
    forme = page.new_shape()
    for tour in range(3):
        depart = tour * 2 * math.pi / 3
        ligne = []
        for i in range(points):
            t = i / (points - 1)
            angle = depart + t * tours * 2 * math.pi
            r = rayon * (0.08 + 0.92 * t ** 0.75)
            ligne.append(centre + pymupdf.Point(math.cos(angle) * r, math.sin(angle) * r))
        forme.draw_polyline(ligne)
    forme.finish(color=BRUN_PALE, width=1.4, closePath=False, lineCap=1, lineJoin=1)
    forme.commit()


def composer(bordure: Path, cible: Path, gabarit: charte.Gabarit | None = None) -> None:
    gabarit = gabarit or charte.GABARIT_INTERIEUR
    largeur, hauteur = gabarit.points
    document = pymupdf.open()
    page = document.new_page(width=largeur, height=hauteur)
    page.insert_image(pymupdf.Rect(0, 0, largeur, hauteur), stream=_fond(bordure))
    page.insert_font(fontname="corps", fontfile=str(CORPS))
    page.insert_font(fontname="ital", fontfile=str(ITALIQUE))
    page.insert_font(fontname="gras", fontfile=str(GRAS))

    marge = (charte.FOND_PERDU + charte.MARGE_SECURITE + 0.14) * charte.POUCE_EN_POINTS
    gauche, droite = marge, largeur - marge

    page.insert_textbox(pymupdf.Rect(gauche, 0.115 * hauteur, droite, 0.175 * hauteur),
                        TITRE, fontname="gras", fontsize=20, color=BRUN,
                        align=pymupdf.TEXT_ALIGN_CENTER)
    _triskell(page, pymupdf.Point(largeur / 2, 0.198 * hauteur), 15)

    # Le conte se réduit jusqu'à tenir : la page ne s'agrandit pas, et une
    # colonne qui déborde sur le parchemin est pire qu'un corps plus petit.
    haut, bas = 0.235 * hauteur, 0.775 * hauteur
    for corps in (11.0, 10.5, 10.0, 9.5, 9.0, 8.5, 8.0):
        reste = page.insert_textbox(pymupdf.Rect(gauche, haut, droite, bas), CONTE,
                                    fontname="corps", fontsize=corps, lineheight=1.55,
                                    color=ENCRE, align=pymupdf.TEXT_ALIGN_JUSTIFY)
        if reste >= 0:
            break
    else:
        raise SystemExit("le conte ne tient pas dans la page, même au plus petit corps")

    _triskell(page, pymupdf.Point(largeur / 2, 0.808 * hauteur), 12)
    page.insert_textbox(pymupdf.Rect(gauche, 0.835 * hauteur, droite, 0.905 * hauteur),
                        PARCHEMIN, fontname="ital", fontsize=11.5, lineheight=1.6,
                        color=BRUN, align=pymupdf.TEXT_ALIGN_CENTER)

    document.set_metadata({"title": "Roussy & Zéphy — Le secret de l'hermine",
                           "author": "Erwann Lefouzèbreizh"})
    cible.parent.mkdir(parents=True, exist_ok=True)
    document.save(str(cible), deflate=True, garbage=4)
    document.close()
    print(f"{cible} — conte composé au corps {corps} pt, texte et ornements vectoriels")


if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--bordure", required=True)
    a.add_argument("--vers", required=True)
    args = a.parse_args()
    composer(Path(args.bordure), Path(args.vers))
