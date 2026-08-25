#!/usr/bin/env python3
"""Rendre à une planche la bordure végétale de la charte.

Le gabarit du recueil impose « fond papier crème vintage, bordure végétale
d'automne ». Dix-neuf planches sur vingt la portent ; la page 17 ne porte qu'un
filet. Sur un volume qui se feuillette d'une traite, cette page-là décroche.

On ne redessine pas la bordure : on la prélève sur une planche qui l'a, en
n'emportant que les feuilles, glands, plumes et brindilles — c'est-à-dire les
pixels qui s'écartent du papier. Le papier de la planche receveuse est conservé,
seuls les motifs viennent d'ailleurs. Le contenu de la page est réduit d'autant
pour lui faire place.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.normaliser import couleur_du_fond  # noqa: E402

# Part du côté occupée par la grappe d'angle : feuilles d'érable et de chêne,
# glands, plumes violettes et brindilles.
COIN = 0.155
# Écart au papier à partir duquel un pixel est tenu pour un motif, et non pour
# du grain. Trop bas, on emporte la texture du papier donneur et le raccord se
# voit ; trop haut, les brindilles pâles disparaissent.
SEUIL_MOTIF = 26


def extraire_coin(donneuse: Path, coin: float = COIN) -> Image.Image:
    """Grappe d'angle de la planche donneuse, en RVBA, papier rendu transparent.

    On ne prélève qu'un angle, et non tout le pourtour : toutes les planches
    portent leur titre en haut et leur parchemin en bas, dans la marge même.
    Un anneau complet les emporterait avec les feuilles — l'essai l'a montré,
    « Mon Journal de Lumière » s'est retrouvé en surimpression du Goûter des
    menhirs. L'angle, lui, est toujours net.
    """
    with Image.open(donneuse) as brut:
        image = brut.convert("RGB")
    w, h = image.size
    grappe = image.crop((0, 0, int(w * coin), int(h * coin)))

    papier = np.array(couleur_du_fond(image), dtype=np.float32)
    ecart = np.abs(np.asarray(grappe).astype(np.float32) - papier).max(axis=2)
    alpha = np.clip((ecart - SEUIL_MOTIF) / 30.0, 0, 1)

    # La planche donneuse porte son propre filet de cadre à l'extrême bord.
    # Prélevé tel quel puis miré, il donne quatre bouts de trait qui ne se
    # rejoignent pas : on éteint donc la lisière avant de composer.
    lisiere = max(2, int(min(grappe.size) * 0.24))
    alpha[:lisiere, :] = 0
    alpha[:, :lisiere] = 0

    couche = Image.fromarray((alpha * 255).astype(np.uint8), "L")
    couche = couche.filter(ImageFilter.GaussianBlur(0.6))
    sortie = grappe.convert("RGBA")
    sortie.putalpha(couche)
    return sortie


def _fond_papier(contenu: Image.Image, papier: tuple[int, int, int]) -> Image.Image:
    """Canevas rempli du papier de la planche elle-même, grain compris.

    Un aplat de la bonne couleur ne suffit pas : le papier crème du recueil est
    moucheté, et l'œil repère la zone lisse bien avant de repérer une nuance.
    On tuile donc en miroir une bande prélevée dans la marge — la seule surface
    de papier nu dont la planche dispose.
    """
    w, h = contenu.size
    bande = contenu.crop((0, 0, w, max(8, int(h * 0.028))))
    retournee = bande.transpose(Image.FLIP_TOP_BOTTOM)
    canevas = Image.new("RGB", (w, h), papier)
    for i, y in enumerate(range(0, h, bande.height)):
        canevas.paste(bande if i % 2 == 0 else retournee, (0, y))
    return canevas


def fond_charte(donneuse: Path, cote: int, coin: float = COIN) -> Image.Image:
    """Fond de page conforme à la charte : papier nu et grappes aux quatre angles.

    Sert aux pages composées (faux-titre, mentions légales, conte de l'hermine,
    solutions), qui n'ont pas d'illustration mais doivent porter le même cadre
    que le reste du volume.

    Pourquoi ne pas simplement reboucher l'intérieur d'une planche existante :
    parce qu'une planche normalisée a vu ses motifs de bordure rentrer de 7 %,
    si bien que le rebouchage les emporte et ne laisse qu'un filet et des
    débris. Reconstruire le fond à partir de la seule grappe d'angle est plus
    long à écrire et donne un résultat propre à toutes les résolutions.
    """
    with Image.open(donneuse) as brut:
        modele = brut.convert("RGB")
    canevas = _papier_procedural(couleur_du_fond(modele), cote)

    grappe = extraire_coin(donneuse, coin)
    grappe = grappe.resize((round(cote * coin), round(cote * coin)), Image.LANCZOS)
    gw, gh = grappe.size
    for miroir_x, miroir_y, position in ((False, False, (0, 0)),
                                         (True, False, (cote - gw, 0)),
                                         (False, True, (0, cote - gh)),
                                         (True, True, (cote - gw, cote - gh))):
        motif = grappe
        if miroir_x:
            motif = motif.transpose(Image.FLIP_LEFT_RIGHT)
        if miroir_y:
            motif = motif.transpose(Image.FLIP_TOP_BOTTOM)
        canevas.paste(motif, position, motif)
    return canevas


def _papier_procedural(papier: tuple[int, int, int], cote: int,
                       grain: int = 4) -> Image.Image:
    """Papier crème au grain tiré au sort, sans motif répété.

    Prélever une bande sur une planche existante puis la paver semblait plus
    fidèle. En pratique la bande emporte ce qui traîne dans la marge — les
    lignes du journal de la page 20, par exemple — et le pavage les répète en
    rayures sur toute la hauteur. Un bruit calculé n'a pas ce défaut, et à cette
    amplitude il se lit comme du grain de papier, pas comme du bruit.
    """
    generateur = np.random.default_rng(1789)
    bruit = generateur.normal(0, grain, (cote, cote, 1))
    fond = np.array(papier, dtype=np.float32) + bruit
    return Image.fromarray(fond.clip(0, 255).astype(np.uint8))


def poser(receveuse: Path, donneuse: Path, cible: Path, rentree: float = 0.135) -> None:
    """Réduit le contenu de la planche receveuse et lui pose la bordure."""
    with Image.open(receveuse) as brut:
        contenu = brut.convert("RGB")
    w, h = contenu.size
    papier = couleur_du_fond(contenu)

    planche = _fond_papier(contenu, papier)
    utile = (round(w * (1 - rentree)), round(h * (1 - rentree)))
    reduit = contenu.resize(utile, Image.LANCZOS)

    # Raccord fondu entre la planche réduite et le papier ajouté. Sans lui, le
    # bord déchiré de la planche d'origine dessine un rectangle net au milieu
    # du fond uni — la marche se voit bien plus que la bordure ne se remarque.
    masque = Image.new("L", utile, 255)
    fondu = max(6, int(min(utile) * 0.012))
    rampe = np.minimum(
        np.clip(np.minimum(np.arange(utile[1]), utile[1] - 1 - np.arange(utile[1])) / fondu, 0, 1)[:, None],
        np.clip(np.minimum(np.arange(utile[0]), utile[0] - 1 - np.arange(utile[0])) / fondu, 0, 1)[None, :])
    masque = Image.fromarray((rampe * 255).astype(np.uint8), "L")
    planche.paste(reduit, ((w - utile[0]) // 2, (h - utile[1]) // 2), masque)

    # La même grappe aux quatre angles, retournée à chaque fois : la bordure
    # de la charte est symétrique, et un seul prélèvement suffit à la refaire.
    grappe = extraire_coin(donneuse)
    grappe = grappe.resize((round(w * COIN), round(h * COIN)), Image.LANCZOS)
    gw, gh = grappe.size
    for miroir_x, miroir_y, position in (
            (False, False, (0, 0)),
            (True, False, (w - gw, 0)),
            (False, True, (0, h - gh)),
            (True, True, (w - gw, h - gh))):
        motif = grappe
        if miroir_x:
            motif = motif.transpose(Image.FLIP_LEFT_RIGHT)
        if miroir_y:
            motif = motif.transpose(Image.FLIP_TOP_BOTTOM)
        planche.paste(motif, position, motif)

    cible.parent.mkdir(parents=True, exist_ok=True)
    planche.save(cible, compress_level=6)
    print(f"  bordure de {donneuse.name} posée sur {receveuse.name} "
          f"(contenu réduit de {rentree:.0%}) -> {cible}")


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--planche", required=True)
    p.add_argument("--bordure", required=True)
    p.add_argument("--vers", required=True)
    p.add_argument("--rentree", type=float, default=0.135)
    a = p.parse_args()
    poser(Path(a.planche), Path(a.bordure), Path(a.vers), a.rentree)
