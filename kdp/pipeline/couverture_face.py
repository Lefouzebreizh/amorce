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

POLICES = charte.POLICES
CORPS, ITALIQUE, GRAS = (POLICES / f"Lora-{n}.ttf" for n in ("Regular", "Italic", "Bold"))

BRUN, BRUN_PALE, ENCRE = (0.34, 0.22, 0.10), (0.45, 0.34, 0.20), (0.16, 0.13, 0.11)

# Vignette empruntée à la page 21, dans les proportions de cette planche.
VIGNETTE = (0.085, 0.055, 0.915, 0.545)

SURTITRE = "Les Merveilleuses Aventures de"
TITRE = "Roussy & Zéphy"
ACCROCHE = "Et si ta différence était ta plus grande force ?"
AUTEUR = "Erwann Lefouzèbreizh"
TOME = "Tome 1"

# Deux mises en page, selon ce que fournit l'illustration.
#
# « vignette » pose un dessin cadré au milieu du papier crème de la charte.
# « pleine page » laisse l'illustration couvrir tout le panneau et pose le
# texte par-dessus — c'est la forme des couvertures d'album, et celle que
# demande la scène de falaise retenue.
#
# Le texte reste vectoriel dans les deux cas. C'est ce qui le rend net en
# vignette de cent cinquante pixels, là où tout se joue, et corrigeable en une
# ligne plutôt qu'en une régénération.
CLAIR = (0.99, 0.97, 0.93)
CREME = (0.957, 0.933, 0.878)      # le papier de la charte
OR_SOURD = (0.72, 0.58, 0.30)
# Le bandeau commence sous les pattes des personnages, pas dessus. À 0,878 il
# tombait pile sur elles et donnait l'impression d'un muret ; l'herbe est plus
# bas. La contrainte inverse est la zone de sécurité : le texte doit finir à
# 0,375 po du trait de coupe, ce qui interdit de descendre davantage.
BANDEAU = 0.888
SOMBRE = (0.20, 0.13, 0.06)


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


def _couvrir(image: Image.Image, largeur: float, hauteur: float) -> Image.Image:
    """Recadre au centre pour remplir le panneau, sans jamais déformer."""
    cible = largeur / hauteur
    rapport = image.width / image.height
    if rapport > cible:
        neuve = round(image.height * cible)
        marge = (image.width - neuve) // 2
        return image.crop((marge, 0, marge + neuve, image.height))
    neuve = round(image.width / cible)
    marge = (image.height - neuve) // 2
    return image.crop((0, marge, image.width, marge + neuve))


def _voile(page: fitz.Page, cadre: fitz.Rect, force: float) -> None:
    """Éclaircit doucement le ciel derrière le titre.

    Un titre sombre sur un ciel mauve tient à l'écran et se perd en vignette,
    où l'écart de clarté s'écrase. Le voile ne se voit pas à taille réelle et
    sauve la lisibilité là où elle compte.
    """
    if force <= 0:
        return
    bandes = 26
    pas = cadre.height / bandes
    for i in range(bandes):
        # Opacité maximale au centre du bandeau, nulle à ses bords : sans ce
        # dégradé, le voile dessinerait un rectangle sur le ciel.
        t = 1 - abs(i / (bandes - 1) - 0.5) * 2
        page.draw_rect(fitz.Rect(cadre.x0, cadre.y0 + i * pas,
                                 cadre.x1, cadre.y0 + (i + 1) * pas),
                       color=None, fill=CLAIR, fill_opacity=force * t)


def composer(bordure: Path, illustration: Path, cible: Path,
             cote_px: int = 2600, pleine_page: bool = False,
             voile: float = 0.34, voile_bas: float = 0.62) -> None:
    largeur = (charte.FORMAT_ROGNE + charte.FOND_PERDU) * charte.POUCE_EN_POINTS
    hauteur = (charte.FORMAT_ROGNE + 2 * charte.FOND_PERDU) * charte.POUCE_EN_POINTS

    document = fitz.open()
    page = document.new_page(width=largeur, height=hauteur)

    with Image.open(illustration) as brut:
        dessin = brut.convert("RGB")

    if pleine_page:
        pleine = _couvrir(dessin, largeur, hauteur)
        tampon = io.BytesIO()
        pleine.save(tampon, format="JPEG", quality=95, optimize=True, subsampling=0)
        page.insert_image(fitz.Rect(0, 0, largeur, hauteur), stream=tampon.getvalue())
        dpi = pleine.width / (largeur / charte.POUCE_EN_POINTS)
    else:
        fond = fond_charte(bordure, cote_px).resize(
            (cote_px, round(cote_px * hauteur / largeur)), Image.LANCZOS)
        tampon = io.BytesIO()
        fond.save(tampon, format="JPEG", quality=94, optimize=True, subsampling=0)
        page.insert_image(fitz.Rect(0, 0, largeur, hauteur), stream=tampon.getvalue())
        dpi = 0

    page.insert_font(fontname="corps", fontfile=str(CORPS))
    page.insert_font(fontname="ital", fontfile=str(ITALIQUE))
    page.insert_font(fontname="gras", fontfile=str(GRAS))

    marge = (charte.FOND_PERDU + charte.MARGE_SECURITE + 0.18) * charte.POUCE_EN_POINTS
    gauche, droite = marge, largeur - marge
    encre = SOMBRE if pleine_page else BRUN
    pale = SOMBRE if pleine_page else BRUN_PALE

    # Les boîtes décident du corps, pas la taille demandée : `_poser` réduit
    # jusqu'à ce que ça tienne. Le titre réclamait 46 et sortait à 42, soit 6,7 %
    # de la hauteur — au-dessus des 5 % sous lesquels un texte ne survit pas à la
    # vignette, mais de peu, sur la seule ligne qui doive absolument s'y lire.
    # Les boîtes descendent donc dans le ciel, vide jusqu'aux personnages.
    if pleine_page:
        _voile(page, fitz.Rect(gauche - 26, 0.066 * hauteur,
                               droite + 26, 0.320 * hauteur), voile)

    _poser(page, fitz.Rect(gauche, 0.072 * hauteur, droite, 0.112 * hauteur),
           SURTITRE, "ital", 17, pale)
    corps = _poser(page, fitz.Rect(gauche, 0.112 * hauteur, droite, 0.232 * hauteur),
                   TITRE, "gras", 60, encre, 1.15)
    # L'accroche est l'argument de vente, pas une légende : de 15 à 20, pour se
    # lire sur la fiche produit. Elle ne survivra pas à la vignette, et c'est
    # assumé — à cette taille, seul le titre le peut.
    _poser(page, fitz.Rect(gauche, 0.240 * hauteur, droite, 0.310 * hauteur),
           ACCROCHE, "ital", 20, pale, 1.45)

    if not pleine_page:
        haut, bas = 0.315 * hauteur, 0.755 * hauteur
        vignette = dessin.crop((int(VIGNETTE[0] * dessin.width), int(VIGNETTE[1] * dessin.height),
                                int(VIGNETTE[2] * dessin.width), int(VIGNETTE[3] * dessin.height)))
        vig = io.BytesIO()
        vignette.save(vig, format="PNG", compress_level=6)
        rapport = vignette.width / vignette.height
        dispo_l = droite - gauche
        if dispo_l / (bas - haut) > rapport:
            ph, pl = bas - haut, (bas - haut) * rapport
        else:
            pl, ph = dispo_l, dispo_l / rapport
        page.insert_image(fitz.Rect((largeur - pl) / 2, haut, (largeur + pl) / 2, haut + ph),
                          stream=vig.getvalue())
        dpi = vignette.width / (pl / charte.POUCE_EN_POINTS)
    else:
        # Bandeau crème plutôt qu'un voile. Le bas d'une couverture d'album est
        # occupé par les personnages eux-mêmes : il n'y a pas de zone calme à
        # éclaircir, et un voile assez fort pour rendre le nom lisible ternirait
        # le dessin. Le bandeau est le geste des albums jeunesse — il se lit
        # comme une intention, pas comme une rustine, et il garantit le contraste.
        page.draw_rect(fitz.Rect(0, BANDEAU * hauteur, largeur, hauteur),
                       color=None, fill=CREME)
        page.draw_line(fitz.Point(0, BANDEAU * hauteur),
                       fitz.Point(largeur, BANDEAU * hauteur),
                       color=OR_SOURD, width=1.1)

    if pleine_page:
        # Le bas du bloc auteur se déduit de la zone de sécurité au lieu de se
        # viser en fraction de hauteur. C'est en le visant à l'œil que « Tome 1 »
        # est descendu à 0,354 po du trait de coupe, sous les 0,375 po que le
        # commentaire de BANDEAU énonce pourtant deux écrans plus haut. Rien ne
        # le signalait : un texte dans la zone de sécurité s'imprime
        # normalement, jusqu'au jour où le massicot tombe mal.
        bas = hauteur - (charte.FOND_PERDU + 0.375) * charte.POUCE_EN_POINTS
        _poser(page, fitz.Rect(gauche, bas - 38, droite, bas - 16),
               AUTEUR, "corps", 16, BRUN)
        _poser(page, fitz.Rect(gauche, bas - 17, droite, bas),
               TOME, "ital", 11, BRUN_PALE)
    else:
        _poser(page, fitz.Rect(gauche, 0.805 * hauteur, droite, 0.858 * hauteur),
               AUTEUR, "corps", 16, encre)
        _poser(page, fitz.Rect(gauche, 0.864 * hauteur, droite, 0.905 * hauteur),
               TOME, "ital", 12, pale)

    document.set_metadata({"title": f"{TITRE} — première de couverture",
                           "author": AUTEUR})
    cible.parent.mkdir(parents=True, exist_ok=True)
    document.save(str(cible), deflate=True, garbage=4)
    document.close()

    print(f"{cible} — {largeur/72:.4f} x {hauteur/72:.4f} po, titre au corps {corps:.0f} pt")
    print(f"  illustration {'pleine page' if pleine_page else 'en vignette'} "
          f"depuis {illustration.name} : {dpi:.0f} DPI")
    if dpi < charte.DPI_CIBLE:
        print(f"  ATTENTION : {dpi:.0f} DPI, il en faut {charte.DPI_CIBLE}")


if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--bordure", required=True,
                   help="planche dont on reprend la bordure (mise en vignette seulement)")
    a.add_argument("--illustration", required=True)
    a.add_argument("--vers", required=True)
    a.add_argument("--pleine-page", action="store_true",
                   help="l'illustration couvre tout le panneau, le texte se pose dessus")
    a.add_argument("--voile", type=float, default=0.34,
                   help="éclaircissement du ciel derrière le titre, 0 pour aucun")
    a.add_argument("--voile-bas", type=float, default=0.62,
                   help="éclaircissement derrière le nom de l'auteur")
    args = a.parse_args()
    composer(Path(args.bordure), Path(args.illustration), Path(args.vers),
             pleine_page=args.pleine_page, voile=args.voile,
             voile_bas=args.voile_bas)
