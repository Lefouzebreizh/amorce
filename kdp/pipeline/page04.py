#!/usr/bin/env python3
"""Page 4 — « Faire le singe » : lettrage vectoriel sur une planche sans texte.

Cette planche est la seule du recueil encore imprimée qui cumule les deux
défauts : peu piquée, et agrandie ×2,41 — au-delà de la limite où la
calligraphie décroche. Elle est donc la seule à régénérer (voir
`kdp/relecture/PASSE-RESOLUTION.md`).

**On régénère l'illustration seule, sans aucun texte.** C'est la leçon la plus
chère du tome 1, écrite dans `kdp/CLAUDE.md` : un texte généré dans l'image
impose de tout refaire à la moindre coquille — il y en a eu trois, et chacune a
coûté une réémission. Un texte tracé se corrige en une ligne et reste net à
n'importe quelle taille.

Deux conséquences assumées :

- **Le titre est en Lora italique, pas en calligraphie.** Aucune police
  calligraphique n'est disponible ici, et une mauvaise imitation se verrait plus
  qu'un écart franc. Les autres pages composées du volume — garde, hermine,
  hymne — emploient déjà Lora : cette page rejoint leur famille plutôt que de
  singer les planches générées.
- **Les repères des bulles sont déclarés, pas devinés.** Ils sont posés en
  fractions de page dans `BULLES`, et `--reperes` les dessine à vide pour les
  ajuster sur la planche réelle avant de lettrer. Une bulle mal placée couvre le
  personnage qui parle, et cela ne se voit qu'à l'œil.
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import fitz
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import charte  # noqa: E402

POLICES = Path("/mnt/skills/examples/canvas-design/canvas-fonts")
CORPS, ITALIQUE = POLICES / "Lora-Regular.ttf", POLICES / "Lora-Italic.ttf"

BRUN = (0.36, 0.24, 0.12)
ENCRE = (0.11, 0.10, 0.09)
CREME = (0.988, 0.976, 0.949)

TITRE = "Roussy & Zéphy - Faire le singe"
PARCHEMIN = ("Faire le singe, ce n’est pas être bête, "
             "c’est offrir son visage au sourire des autres.")

# Cases de la grille 2 × 2, en fractions de page. Relevées sur la planche du
# tome 1 ; à revérifier avec --reperes sur toute planche régénérée.
CASES = [(0.075, 0.095, 0.487, 0.485), (0.513, 0.095, 0.925, 0.485),
         (0.075, 0.505, 0.487, 0.885), (0.513, 0.505, 0.925, 0.885)]

# Une bulle par entrée : le numéro de case, la boîte en fractions DE LA CASE,
# le texte, et la direction de la queue — vers où pointe le locuteur.
BULLES = [
    (0, (0.06, 0.04, 0.94, 0.30), "Pfff… Aujourd’hui, je suis tout gris à l’intérieur…", "bas"),
    (1, (0.06, 0.04, 0.94, 0.28), "Attention, spectacle de singe savant ! Interdit de ne pas rire !", "bas"),
    (2, (0.10, 0.04, 0.90, 0.26), "Hahaha ! Mais t’es un vrai singe, Zéphy !", "bas"),
    (3, (0.02, 0.04, 0.46, 0.30), "Bon ok, faire le singe, c’est contagieux !", "bas"),
    (3, (0.54, 0.10, 0.98, 0.36), "Et c’est beaucoup plus joli qu’une tête qui boude ! HI HI !", "bas"),
]


def _fond(planche: Path, cote: int) -> bytes:
    """La planche régénérée, en JPEG de qualité — c'est un fond, pas du trait."""
    with Image.open(planche) as brut:
        image = brut.convert("RGB")
    if image.size != (cote, cote):
        image = image.resize((cote, cote), Image.LANCZOS)
    tampon = io.BytesIO()
    image.save(tampon, format="JPEG", quality=95, optimize=True, subsampling=0)
    return tampon.getvalue()


def _hauteur_utile(gabarit: charte.Gabarit, largeur: float, texte: str,
                   corps: float) -> float:
    """Hauteur minimale où le texte tient, mesurée sur une page jetable.

    On taille la bulle sur le texte, et non l'inverse. Une boîte fixe laisse un
    vide sous les répliques courtes, et ce vide masque du dessin pour rien.
    """
    brouillon = fitz.open()
    page = brouillon.new_page(width=gabarit.points[0], height=gabarit.points[1])
    page.insert_font(fontname="corps", fontfile=str(CORPS))
    haut = corps
    while haut < gabarit.points[1] * 0.5:
        reste = page.insert_textbox(fitz.Rect(0, 0, largeur, haut), texte,
                                    fontname="corps", fontsize=corps,
                                    align=fitz.TEXT_ALIGN_CENTER, lineheight=1.25)
        if reste >= 0:
            brouillon.close()
            return haut
        haut += corps * 0.2
    brouillon.close()
    return haut


def _bulle(page: fitz.Page, cadre: fitz.Rect, texte: str, queue: str,
           corps: float, gabarit: charte.Gabarit) -> fitz.Rect:
    """Dessine la bulle épousant son texte, ancrée en haut de `cadre`."""
    marge = cadre.width * 0.055
    large = cadre.width - 2 * marge
    plein = _hauteur_utile(gabarit, large, texte, corps)
    # Une bulle large d-une case entière lit comme un bandeau. On la resserre
    # tant que cela n-ajoute pas de ligne : même hauteur, forme de bulle.
    etroit = large
    essai = large
    while essai > large * 0.5:
        essai -= large * 0.05
        if _hauteur_utile(gabarit, essai, texte, corps) > plein:
            break
        etroit = essai
    haut = plein
    demi = (cadre.width - (etroit + 2 * marge)) / 2
    boite = fitz.Rect(cadre.x0 + demi, cadre.y0,
                      cadre.x1 - demi, cadre.y0 + haut + 2 * marge)

    petit = min(boite.width, boite.height)
    page.draw_rect(boite, radius=min(0.5, petit * 0.30 / petit),
                   color=BRUN, fill=CREME, width=1.1)
    if queue == "bas":
        cx = boite.x0 + boite.width * 0.5
        page.draw_polyline([fitz.Point(cx - boite.width * 0.055, boite.y1 - 1),
                            fitz.Point(cx, boite.y1 + boite.height * 0.28),
                            fitz.Point(cx + boite.width * 0.055, boite.y1 - 1)],
                           color=BRUN, fill=CREME, width=1.1, closePath=True)
    page.insert_textbox(fitz.Rect(boite.x0 + marge, boite.y0 + marge,
                                  boite.x1 - marge, boite.y1),
                        texte, fontname="corps", fontsize=corps, color=ENCRE,
                        align=fitz.TEXT_ALIGN_CENTER, lineheight=1.25)
    return boite


def _medaillon(page: fitz.Page, centre: fitz.Point, rayon: float, n: int) -> None:
    page.draw_circle(centre, rayon, color=BRUN, fill=CREME, width=1.2)
    page.insert_textbox(fitz.Rect(centre.x - rayon, centre.y - rayon * 0.75,
                                  centre.x + rayon, centre.y + rayon),
                        str(n), fontname="corps", fontsize=rayon * 1.05,
                        color=BRUN, align=fitz.TEXT_ALIGN_CENTER)


def composer(planche: Path, cible: Path, gabarit: charte.Gabarit | None = None,
             reperes: bool = False) -> None:
    gabarit = gabarit or charte.GABARIT_INTERIEUR
    largeur, hauteur = gabarit.points
    cote = int(round(largeur / charte.POUCE_EN_POINTS * 300))

    document = fitz.open()
    page = document.new_page(width=largeur, height=hauteur)
    page.insert_image(fitz.Rect(0, 0, largeur, hauteur), stream=_fond(planche, cote))
    page.insert_font(fontname="corps", fontfile=str(CORPS))
    page.insert_font(fontname="ital", fontfile=str(ITALIQUE))

    cases = [fitz.Rect(a * largeur, b * hauteur, c * largeur, d * hauteur)
             for a, b, c, d in CASES]

    if reperes:
        for i, c in enumerate(cases, 1):
            page.draw_rect(c, color=(1, 0, 0), width=2)
            _medaillon(page, fitz.Point(c.x0 + 14, c.y0 + 14), 11, i)

    page.insert_textbox(fitz.Rect(0, hauteur * 0.030, largeur, hauteur * 0.090),
                        TITRE, fontname="ital", fontsize=largeur * 0.032,
                        color=BRUN, align=fitz.TEXT_ALIGN_CENTER)

    for i, c in enumerate(cases, 1):
        _medaillon(page, fitz.Point(c.x0 + c.width * 0.055, c.y0 + c.height * 0.06),
                   c.width * 0.038, i)

    for indice, (a, b, cc, d), texte, queue in BULLES:
        c = cases[indice]
        boite = fitz.Rect(c.x0 + a * c.width, c.y0 + b * c.height,
                          c.x0 + cc * c.width, c.y0 + d * c.height)
        if reperes:
            page.draw_rect(boite, color=(0, 0.5, 1), width=1.5)
        else:
            _bulle(page, boite, texte, queue, largeur * 0.0165, gabarit)

    page.insert_textbox(fitz.Rect(largeur * 0.14, hauteur * 0.905,
                                  largeur * 0.86, hauteur * 0.960),
                        PARCHEMIN, fontname="ital", fontsize=largeur * 0.0155,
                        color=BRUN, align=fitz.TEXT_ALIGN_CENTER, lineheight=1.3)

    document.set_metadata({"title": "Roussy & Zéphy — Faire le singe",
                           "author": "Erwann Lefouzèbreizh"})
    cible.parent.mkdir(parents=True, exist_ok=True)
    document.save(str(cible), deflate=True, garbage=4)
    document.close()
    print(f"{cible} — {len(BULLES)} bulle(s) lettrée(s)"
          + (" — REPÈRES seuls" if reperes else ""))


if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--planche", required=True, help="planche régénérée, sans texte")
    a.add_argument("--vers", required=True)
    a.add_argument("--reperes", action="store_true",
                   help="dessiner les cases et les boîtes de bulles à vide, "
                        "pour les ajuster avant de lettrer")
    args = a.parse_args()
    composer(Path(args.planche), Path(args.vers), reperes=args.reperes)
