#!/usr/bin/env python3
"""Remplace le QR incrusté de la page de l'hymne par un tracé vectoriel.

Un QR imprimé dans un livre engage pour des années. Deux règles en découlent, et
ce module applique les deux.

**Il ne doit jamais pointer ailleurs que vers un domaine qu'on possède.** Une
adresse de plateforme change ou disparaît, et le livre est déjà chez le lecteur.
Un domaine que l'on contrôle sert d'aiguillage : l'audio peut déménager, la
redirection se met à jour, et tous les exemplaires imprimés continuent de
fonctionner.

**Il doit être tracé, pas pixellisé.** Celui de la planche est déjà mou avant
même d'être imprimé. En vectoriel, il reste net à toute taille, et l'adresse se
change en une ligne au lieu d'une régénération.

Le module contrôle aussi la taille du plus petit carré : c'est elle, et non la
taille du code, qui décide si un téléphone lit ou renonce.
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import pymupdf
import segno
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import charte  # noqa: E402

# Encodée sans « https:// », pour deux raisons qui vont dans le même sens. Le
# préfixe coûte quatre modules de plus — 29 au lieu de 25 — et il n'y a nulle
# part où les prendre : le bloc du bas remplit déjà l'espace entre la légende
# peinte dans la planche et le cadre, et le creux au-dessus est occupé par la
# queue de Zéphy dès qu'on l'élargit à la largeur du bloc. Surtout, l'adresse
# encodée devient alors identique à celle imprimée dessous : une seule route à
# créer sur le site, rien à se rappeler dans deux ans.
ADRESSE_PAR_DEFAUT = "roussyetzephy.fr/hymne"

# Emplacement du QR incrusté, en fraction de la planche d'origine, puis reporté
# dans le repère de la planche normalisée — dont le contenu a été rentré de 7 %.
QR_PLANCHE = (0.4375, 0.8625, 0.5531, 0.9813)
RENTREE = 0.07

# En deçà de six dixièmes de millimètre par carré, un téléphone peine dès que
# l'éclairage baisse ou que la page n'est pas parfaitement à plat.
MODULE_MINIMUM_MM = 0.6

# Correction d'erreur. Le maximum (H, 30 %) est fait pour les surfaces abîmées
# ou les codes portant un logo au centre ; sur une page de livre propre il ne
# sert qu'à gonfler le nombre de modules, donc à les rétrécir. M donne 15 % de
# récupération — largement de quoi encaisser une page cornée — et tient en 25
# modules là où Q en réclame 29. Sur un emplacement qu'on ne peut pas agrandir,
# ces quatre modules valent plus que les dix points de récupération : ils font
# passer le carré de 0,63 à 0,73 mm.
CORRECTION = "m"

POLICES = charte.POLICES
BRUN_PALE = (0.45, 0.34, 0.20)


def _teinte_du_papier(image: Image.Image, boite) -> tuple[int, int, int]:
    import numpy as np
    marge = 24
    cadre = image.crop((max(0, boite[0] - marge), max(0, boite[1] - marge),
                        min(image.width, boite[2] + marge),
                        min(image.height, boite[3] + marge)))
    a = np.asarray(cadre.convert("RGB")).reshape(-1, 3)
    clairs = a[a.mean(axis=1) > 190]
    return tuple(int(v) for v in np.median(clairs if len(clairs) > 50 else a, axis=0))


def composer(planche: Path, cible: Path, adresse: str = ADRESSE_PAR_DEFAUT,
             gabarit: charte.Gabarit | None = None,
             correction: str = CORRECTION) -> None:
    gabarit = gabarit or charte.GABARIT_INTERIEUR
    largeur, hauteur = gabarit.points

    with Image.open(planche) as brut:
        image = brut.convert("RGB")
    w, h = image.size

    # La rentrée de 7 % a déplacé le contenu : on reporte le repère plutôt que
    # de le mesurer une seconde fois sur la planche agrandie.
    def report(f: float) -> float:
        return RENTREE / 2 + f * (1 - RENTREE)

    x0, y0 = report(QR_PLANCHE[0]), report(QR_PLANCHE[1])
    x1, y1 = report(QR_PLANCHE[2]), report(QR_PLANCHE[3])

    boite = (int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h))
    image.paste(_teinte_du_papier(image, boite), boite)

    tampon = io.BytesIO()
    image.save(tampon, format="JPEG", quality=95, optimize=True, subsampling=0)

    document = pymupdf.open()
    page = document.new_page(width=largeur, height=hauteur)
    page.insert_image(pymupdf.Rect(0, 0, largeur, hauteur), stream=tampon.getvalue())

    code = segno.make(adresse, error=correction)
    modules = code.symbol_size(scale=1, border=0)[0]

    # Le code occupe la boîte moins la place de l'adresse écrite dessous : un QR
    # que l'appareil ne lit pas doit rester recopiable à la main.
    cote_boite = (x1 - x0) * largeur
    hauteur_texte = 11
    cote = cote_boite - hauteur_texte - 4
    gauche = (largeur - cote) / 2
    haut = y0 * hauteur

    pas = cote / modules
    for ligne, rangee in enumerate(code.matrix):
        for colonne, noir in enumerate(rangee):
            if noir:
                page.draw_rect(pymupdf.Rect(gauche + colonne * pas, haut + ligne * pas,
                                         gauche + (colonne + 1) * pas,
                                         haut + (ligne + 1) * pas),
                               color=None, fill=(0, 0, 0))

    page.insert_font(fontname="corps", fontfile=str(POLICES / "Lora-Regular.ttf"))
    lisible = adresse.replace("https://", "").replace("http://", "")
    page.insert_textbox(pymupdf.Rect(0, haut + cote + 3, largeur, haut + cote + hauteur_texte + 6),
                        lisible, fontname="corps", fontsize=7.5, color=BRUN_PALE,
                        align=pymupdf.TEXT_ALIGN_CENTER)

    document.set_metadata({"title": "Roussy & Zéphy — L'hymne",
                           "author": "Erwann Lefouzèbreizh"})
    cible.parent.mkdir(parents=True, exist_ok=True)
    document.save(str(cible), deflate=True, garbage=4)
    document.close()

    mm = pas / charte.POUCE_EN_POINTS * 25.4
    print(f"{cible} — QR vectoriel vers {adresse}")
    print(f"  {modules} x {modules} modules, {mm:.2f} mm par carré, "
          f"code de {cote / charte.POUCE_EN_POINTS * 25.4:.1f} mm")
    if mm < MODULE_MINIMUM_MM:
        print(f"  ATTENTION : sous {MODULE_MINIMUM_MM} mm par carré, la lecture "
              f"devient incertaine. Raccourcir l'adresse réduit le nombre de modules.")


if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--planche", required=True, help="planche de l'hymne, normalisée")
    a.add_argument("--vers", required=True)
    a.add_argument("--adresse", default=ADRESSE_PAR_DEFAUT)
    a.add_argument("--correction", default=CORRECTION, choices=list("lmqh"),
                   help="correction d'erreur : plus elle est haute, plus les "
                        "carrés sont petits")
    args = a.parse_args()
    composer(Path(args.planche), Path(args.vers), args.adresse,
             correction=args.correction)
