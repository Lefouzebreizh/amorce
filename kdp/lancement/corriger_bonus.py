#!/usr/bin/env python3
"""Corrige les coquilles de l'histoire bonus « Têtu comme un bourricot ».

Le texte est pixellisé dans la planche, et la fonte des bulles n'est aucune de
celles dont on dispose : à hauteur de capitale égale, la plus proche est vingt
pour cent trop large, et les facteurs de condensation relevés d'une ligne à
l'autre ne concordent pas assez pour retypographier sans que le raccord se
voie.

On travaille donc **uniquement avec la matière de la planche** :

- ce qui est en trop se supprime, et la ligne se recentre ;
- ce qui manque se construit avec des lettres prélevées dans la même bulle,
  à la même taille et au même rendu — le « ne » qui manquait à la négation
  vient du « n » de « Un » et du « e » de « de », deux lignes plus haut.

Le décalage vertical entre deux lignes est mesuré sur leurs lignes de base
respectives, pas estimé : trente-deux pixels entre la première et la deuxième
ligne du panneau 4.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.coquilles import teinte_du_fond  # noqa: E402

# --- Relevés au pixel sur la planche d'origine (1600 × 1600) -----------------
#
# Chaque bande verticale est prise dans la gouttière d'encre entre deux lignes :
# trop haute elle emmène les jambages de la ligne du dessus, trop basse les
# hampes de celle du dessous.

SUPPRESSIONS = (
    # (libellé, bande, début du texte conservé, fin utile, encre d'origine)
    ("panneau 3, ligne 1 : « Ok ! » supprimé",
     (305, 803, 706, 843), 374, 680, (319, 680)),
    ("panneau 3, ligne 3 : points de suspension en tête supprimés",
     (287, 872, 707, 910), 323, 700, (295, 700)),
)


def _feutre(largeur: int, hauteur: int, marge: int = 4) -> Image.Image:
    """Masque à bords fondus : un rectangle de papier posé net se voit.

    Le fondu doit rester étroit et la bande large : à dix pixels de rampe, le
    premier et le dernier glyphe de la ligne tombaient dans la zone à demi
    effacée et laissaient un fantôme. La règle est que la rampe ne rencontre
    jamais d'encre.
    """
    y = np.minimum(np.arange(hauteur), hauteur - 1 - np.arange(hauteur))
    x = np.minimum(np.arange(largeur), largeur - 1 - np.arange(largeur))
    rampe = np.minimum(np.clip(y / marge, 0, 1)[:, None], np.clip(x / marge, 0, 1)[None, :])
    return Image.fromarray((rampe * 255).astype(np.uint8), "L")


def _effacer(image: Image.Image, boite) -> None:
    aplat = Image.new("RGB", (boite[2] - boite[0], boite[3] - boite[1]),
                      teinte_du_fond(image, boite))
    image.paste(aplat, boite[:2], _feutre(*aplat.size))


def supprimer_et_recentrer(image: Image.Image, bande, garde_de: int,
                           garde_a: int, encre) -> int:
    """Retire le début d'une ligne, puis recentre ce qui reste sur l'ancien axe."""
    bloc = image.crop((garde_de, bande[1], bande[2], bande[3]))
    axe = (encre[0] + encre[1]) / 2
    largeur = garde_a - garde_de
    cible = round(axe - largeur / 2)
    _effacer(image, bande)
    image.paste(bloc, (cible, bande[1]))
    return cible - garde_de


def inserer_ne(image: Image.Image) -> None:
    """Rétablit la négation du panneau 4 : « ça compte pas » -> « ça ne compte pas ».

    Le « n » et le « e » sont prélevés sur la première ligne de la même bulle.
    Ils y reposent trente-deux pixels plus haut ; c'est de cet écart de lignes
    de base, et de lui seul, que dépend l'alignement du mot ajouté.
    """
    ECART = 32                      # ligne de base 869 -> 901
    BANDE = (890, 878, 1102, 912)
    ESPACE, LIAISON = 9, 2          # espace-mot et approche, relevés dans la bulle

    n = image.crop((915, 853, 930, 873))     # le « n » de « Un »
    e = image.crop((990, 853, 1004, 873))    # le « e » de « de »
    ca = image.crop((911, 878, 939, 912))    # « ça »
    reste = image.crop((941, 878, 1075, 912))  # « compte pas ! »

    # Largeurs d'encre, et non de rognure : c'est l'encre qui doit être centrée.
    l_ca, l_ne, l_reste = 935 - 914, (927 - 917) + LIAISON + (1001 - 992), 1071 - 944
    total = l_ca + ESPACE + l_ne + ESPACE + l_reste
    depart = round((914 + 1071) / 2 - total / 2)

    _effacer(image, BANDE)
    image.paste(ca, (depart - 3, 878))
    x = depart + l_ca + ESPACE
    image.paste(n, (x - 2, 853 + ECART))
    image.paste(e, (x + (927 - 917) + LIAISON - 2, 853 + ECART))
    image.paste(reste, (depart + total - l_reste - 3, 878))


# --- Le regard du panneau 3 ---------------------------------------------------
#
# Zéphy y a les yeux grands ouverts, mais ses pupilles mesurent six pixels sur
# six dans un œil de cinquante sur quarante, et se serrent contre le coin
# interne. À taille réelle, le regard paraît vide. On les redessine à une
# proportion de dessin animé, orientées vers Roussy, qui est en bas à gauche.

REGARD = (
    # (centre x, centre y, rayon horizontal, rayon vertical)
    (519, 1100, 9.0, 9.5),      # œil gauche
    (562, 1103, 10.0, 10.5),    # œil droit
)
PUPILLE = (17, 11, 5)           # relevé sur le trait de la planche
REFLET = (250, 248, 244)


def redessiner_le_regard(image: Image.Image, echelle: int = 4) -> None:
    """Agrandit les pupilles du panneau 3 et leur rend un reflet.

    Tracé à quatre fois la taille puis réduit : une ellipse dessinée directement
    à cette échelle-là sortirait crénelée, et une pupille crénelée se voit plus
    qu'une pupille trop petite.
    """
    from PIL import ImageDraw
    for cx, cy, rx, ry in REGARD:
        boite = (round(cx - rx - 3), round(cy - ry - 3),
                 round(cx + rx + 4), round(cy + ry + 4))
        morceau = image.crop(boite).resize(
            ((boite[2] - boite[0]) * echelle, (boite[3] - boite[1]) * echelle),
            Image.LANCZOS)
        d = ImageDraw.Draw(morceau)
        ox, oy = (cx - boite[0]) * echelle, (cy - boite[1]) * echelle
        d.ellipse([ox - rx * echelle, oy - ry * echelle,
                   ox + rx * echelle, oy + ry * echelle], fill=PUPILLE)
        # Reflet en haut à gauche : c'est lui qui rend l'œil vivant.
        r = rx * echelle * 0.30
        d.ellipse([ox - rx * echelle * 0.42 - r, oy - ry * echelle * 0.40 - r,
                   ox - rx * echelle * 0.42 + r, oy - ry * echelle * 0.40 + r],
                  fill=REFLET)
        image.paste(morceau.resize((boite[2] - boite[0], boite[3] - boite[1]),
                                   Image.LANCZOS), boite[:2])


def corriger(source: Path, cible: Path) -> None:
    with Image.open(source) as brut:
        image = brut.convert("RGB")
    for libelle, bande, de, a, encre in SUPPRESSIONS:
        decalage = supprimer_et_recentrer(image, bande, de, a, encre)
        print(f"  {libelle} (recentrage {decalage:+d} px)")
    inserer_ne(image)
    print("  panneau 4, ligne 2 : « ne » rétabli, bâti avec le « n » et le « e » de la bulle")
    redessiner_le_regard(image)
    print("  panneau 3 : pupilles de Zéphy agrandies et pourvues d’un reflet")
    cible.parent.mkdir(parents=True, exist_ok=True)
    image.save(cible, compress_level=6)
    print(f"\n{cible}")


if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--source", required=True)
    a.add_argument("--vers", required=True)
    args = a.parse_args()
    corriger(Path(args.source), Path(args.vers))
