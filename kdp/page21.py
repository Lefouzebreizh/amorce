#!/usr/bin/env python3
"""Recompose la page 21 en texte réel plutôt qu'en image de texte.

    python3 kdp/page21.py --source nommes/ --vers page21.pdf

Pourquoi cette page seule échappe au générateur : c'est la seule du volume dont
le contenu est du texte suivi, et le générateur le rend en script manuscrite
avec des graisses qui changent d'un mot à l'autre — un artefact, pas un effet.
À 186 DPI, sur quinze lignes, la lecture décroche.

Le tracé vectoriel n'a pas de résolution : ce texte-ci sortira net quel que soit
le sort des illustrations. L'aquarelle et la bordure, elles, sont reprises telles
quelles depuis la planche d'origine — on ne redessine que ce qui doit être lu.
"""

from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

import fitz
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import charte  # noqa: E402

POLICES = charte.POLICES
CORPS = POLICES / "Lora-Regular.ttf"
CORPS_ITALIQUE = POLICES / "Lora-Italic.ttf"
TITRE = POLICES / "Lora-Bold.ttf"

TITRE_TEXTE = "Mon histoire"
SIGNATURE = "Erwann Lefouzèbreizh"

# Texte relu : « Je suis breton » en minuscule (attribut de nationalité), et la
# ponctuation reprise aux règles françaises.
TEXTE = """Je suis breton. J’ai connu une enfance pas toujours facile, des moments où je me suis senti différent, à part. Pendant longtemps, j’ai cherché ma place.

J’ai traversé des tempêtes, j’ai fait des changements profonds dans ma vie. J’ai appris que tomber n’était pas un échec. Un jour, j’ai compris que ce qui me faisait me sentir à part était aussi ma plus grande force : ma sensibilité, mon cœur qui ressent fort.

De ce chemin est né un groupe, une famille de 48 000 cœurs qui s’entraident chaque jour. Roussy, c’est un peu moi petit. Zéphy, c’est l’ami que j’aurais aimé avoir, et que je suis devenu pour les autres.

Ce livre, c’est pour te dire que peu importe d’où tu viens, tu peux toujours choisir où tu vas."""

CHUTE = "Ta résilience est plus forte que tes tempêtes."

# Fractions de la planche d'origine, mesurées sur l'image.
# L'aquarelle occupe la moitié haute et ne laisse au texte que le quart de la
# page : c'est la vraie cause de l'illisibilité, avant même la résolution. On
# rend donc de la place au texte en réduisant la vignette — c'est la seule
# page du volume où l'illustration n'est pas le propos.
VIGNETTE_SOURCE = (0.085, 0.055, 0.915, 0.545)   # à extraire de la planche
INTERIEUR = (0.075, 0.070, 0.925, 0.930)         # à reboucher, bordure préservée
BANDE_IMAGE = (0.085, 0.435)                     # haut / bas de la vignette posée
BANDE_TEXTE = (0.470, 0.915)


def _papier(image: Image.Image, cote: int = 220) -> Image.Image:
    """Cherche le carré de papier le plus uni, pour reboucher sans motif visible.

    Un échantillon fixé d'avance emporte toujours une tache ou un grain marqué,
    que le pavage répète ensuite à intervalle régulier — l'œil ne voit plus que
    ça. On balaie donc la marge basse à la recherche du carré le moins texturé.
    """
    w, h = image.size
    gris = image.convert("L")
    meilleur, score = None, float("inf")
    for y in range(int(0.87 * h), int(0.94 * h) - cote, 20):
        for x in range(int(0.10 * w), int(0.90 * w) - cote, 20):
            histo = gris.crop((x, y, x + cote, y + cote)).histogram()
            total = sum(histo) or 1
            moyenne = sum(i * n for i, n in enumerate(histo)) / total
            variance = sum((i - moyenne) ** 2 * n for i, n in enumerate(histo)) / total
            if variance < score:
                score, meilleur = variance, (x, y)
    if meilleur is None:                    # planche trop étroite : repli simple
        meilleur = (int(0.30 * w), int(0.90 * h))
    x, y = meilleur
    return image.crop((x, y, x + cote, y + cote))


def composer(source: Path, cible: Path, gabarit: charte.Gabarit) -> None:
    with Image.open(source) as brut:
        planche = brut.convert("RGB")
    w, h = planche.size

    vignette = planche.crop((int(VIGNETTE_SOURCE[0] * w), int(VIGNETTE_SOURCE[1] * h),
                             int(VIGNETTE_SOURCE[2] * w), int(VIGNETTE_SOURCE[3] * h)))

    # Reboucher l'intérieur avec du papier prélevé sur la planche elle-même :
    # un aplat uni se verrait immédiatement au milieu d'une aquarelle.
    motif = _papier(planche)
    zone = (int(INTERIEUR[0] * w), int(INTERIEUR[1] * h),
            int(INTERIEUR[2] * w), int(INTERIEUR[3] * h))
    # Pavage en miroir : bord contre bord identique, donc aucune couture, et le
    # grain ne se répète pas à l'identique d'une case à la suivante.
    cases = (motif,
             motif.transpose(Image.FLIP_LEFT_RIGHT),
             motif.transpose(Image.FLIP_TOP_BOTTOM),
             motif.transpose(Image.FLIP_LEFT_RIGHT).transpose(Image.FLIP_TOP_BOTTOM))
    for i, y in enumerate(range(zone[1], zone[3], motif.height)):
        for j, x in enumerate(range(zone[0], zone[2], motif.width)):
            planche.paste(cases[(i % 2) * 2 + j % 2], (x, y))

    tampon = io.BytesIO()
    planche.save(tampon, format="PNG", compress_level=9)
    vig = io.BytesIO()
    vignette.save(vig, format="PNG", compress_level=9)

    largeur, hauteur = gabarit.points
    document = fitz.open()
    page = document.new_page(width=largeur, height=hauteur)
    page.insert_image(fitz.Rect(0, 0, largeur, hauteur), stream=tampon.getvalue())

    # Vignette centrée, contenue dans sa bande sans jamais être déformée.
    haut, bas = BANDE_IMAGE[0] * hauteur, BANDE_IMAGE[1] * hauteur
    dispo_h, dispo_l = bas - haut, largeur * 0.83
    rapport = vignette.width / vignette.height
    if dispo_l / dispo_h > rapport:
        ph, pl = dispo_h, dispo_h * rapport
    else:
        pl, ph = dispo_l, dispo_l / rapport
    x = (largeur - pl) / 2
    page.insert_image(fitz.Rect(x, haut, x + pl, haut + ph), stream=vig.getvalue())

    page.insert_font(fontname="corps", fontfile=str(CORPS))
    page.insert_font(fontname="corpsit", fontfile=str(CORPS_ITALIQUE))
    page.insert_font(fontname="titre", fontfile=str(TITRE))

    marge = 0.80 * charte.POUCE_EN_POINTS   # au-delà de la zone de sécurité
    gauche, droite = marge, largeur - marge

    y = BANDE_TEXTE[0] * hauteur
    page.insert_textbox(fitz.Rect(gauche, y, droite, y + 34), TITRE_TEXTE,
                        fontname="titre", fontsize=21, color=(0.36, 0.24, 0.12),
                        align=fitz.TEXT_ALIGN_CENTER)
    y += 28
    page.insert_textbox(fitz.Rect(gauche, y, droite, y + 24), SIGNATURE,
                        fontname="corpsit", fontsize=12, color=(0.45, 0.34, 0.20),
                        align=fitz.TEXT_ALIGN_CENTER)
    y += 30

    # Le corps est justifié et réduit jusqu'à tenir : la planche est de taille
    # fixe, c'est le texte qui doit céder, jamais la marge de sécurité.
    bas_texte = BANDE_TEXTE[1] * hauteur - 34
    for corps in (11.5, 11.0, 10.5, 10.0, 9.5, 9.0, 8.5):
        reste = page.insert_textbox(
            fitz.Rect(gauche, y, droite, bas_texte), TEXTE, fontname="corps",
            fontsize=corps, lineheight=1.45, color=(0.16, 0.13, 0.11),
            align=fitz.TEXT_ALIGN_JUSTIFY)
        if reste >= 0:
            break
    else:
        raise SystemExit("Le texte ne tient pas, même au plus petit corps.")

    page.insert_textbox(fitz.Rect(gauche, bas_texte + 4, droite, bas_texte + 36),
                        CHUTE, fontname="corpsit", fontsize=12,
                        color=(0.36, 0.24, 0.12), align=fitz.TEXT_ALIGN_CENTER)

    document.set_metadata({"title": "Roussy & Zéphy — page 21, Mon histoire",
                           "author": SIGNATURE})
    cible.parent.mkdir(parents=True, exist_ok=True)
    document.save(str(cible), deflate=True, garbage=4)
    document.close()
    print(f"{cible} — corps {corps} pt, texte vectoriel, "
          f"vignette reprise de {source.name}")


def main(argv: list[str] | None = None) -> int:
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--source", required=True, help="dossier des planches nommées")
    a.add_argument("--vers", default="page21.pdf")
    a.add_argument("--kdp-strict", action="store_true")
    args = a.parse_args(argv)

    page = next(p for p in charte.TOME_1 if p.numero == 21)
    base = charte.nom_de_page(page.numero, page.slug, "")
    for extension in (".webp", ".jpg", ".jpeg", ".png"):
        chemin = Path(args.source) / f"{base}{extension}"
        if chemin.exists():
            break
    else:
        raise SystemExit(f"Planche introuvable : {base}.*")

    composer(chemin, Path(args.vers),
             charte.GABARIT_INTERIEUR_KDP if args.kdp_strict else charte.GABARIT_INTERIEUR)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
