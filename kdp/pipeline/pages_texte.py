#!/usr/bin/env python3
"""Étape 4 — composer les trois pages de texte qui manquent au volume.

KDP refuse un broché de moins de vingt-quatre pages, et le volume en compte
vingt et une. Les trois qui manquent ne sont pas du remplissage : un livre sans
page de titre ni mentions légales n'est pas un livre, et un jeu sans corrigé
frustre l'enfant au lieu de l'occuper.

Ces pages-ci sont composées, pas illustrées. Le texte est donc vectoriel : il
sortira net quelle que soit la résolution des planches voisines. Seule la
bordure végétale est reprise d'une planche existante, pour que le volume garde
un seul et même cadre d'un bout à l'autre.
"""

from __future__ import annotations

import sys
from pathlib import Path

import fitz
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import charte  # noqa: E402
from pipeline.normaliser import couleur_du_fond  # noqa: E402

POLICES = Path("/mnt/skills/examples/canvas-design/canvas-fonts")
CORPS, ITALIQUE, GRAS = (POLICES / f"Lora-{n}.ttf" for n in ("Regular", "Italic", "Bold"))

# Fraction de la planche à reboucher : tout sauf la bordure végétale.
INTERIEUR = (0.075, 0.070, 0.925, 0.930)

BRUN = (0.36, 0.24, 0.12)
BRUN_PALE = (0.45, 0.34, 0.20)
ENCRE = (0.16, 0.13, 0.11)


def _fond(planche_source: Path, gabarit: charte.Gabarit) -> bytes:
    """Bordure de la charte, intérieur rendu au papier vierge."""
    with Image.open(planche_source) as brut:
        planche = brut.convert("RGB")
    w, h = planche.size
    zone = (int(INTERIEUR[0] * w), int(INTERIEUR[1] * h),
            int(INTERIEUR[2] * w), int(INTERIEUR[3] * h))
    planche.paste(couleur_du_fond(planche), zone)
    import io
    tampon = io.BytesIO()
    planche.save(tampon, format="PNG", compress_level=6)
    return tampon.getvalue()


def _page(document: fitz.Document, fond: bytes, gabarit: charte.Gabarit) -> fitz.Page:
    largeur, hauteur = gabarit.points
    page = document.new_page(width=largeur, height=hauteur)
    page.insert_image(fitz.Rect(0, 0, largeur, hauteur), stream=fond)
    page.insert_font(fontname="corps", fontfile=str(CORPS))
    page.insert_font(fontname="ital", fontfile=str(ITALIQUE))
    page.insert_font(fontname="gras", fontfile=str(GRAS))
    return page


def _cadre(gabarit: charte.Gabarit, haut: float, bas: float) -> fitz.Rect:
    """Bande de composition, toujours en deçà de la zone de sécurité."""
    largeur, hauteur = gabarit.points
    marge = (charte.FOND_PERDU + charte.MARGE_SECURITE + 0.12) * charte.POUCE_EN_POINTS
    return fitz.Rect(marge, haut * hauteur, largeur - marge, bas * hauteur)


# --- Les trois pages ---------------------------------------------------------


def faux_titre(document, fond, gabarit) -> None:
    page = _page(document, fond, gabarit)
    page.insert_textbox(_cadre(gabarit, 0.40, 0.52), "Roussy & Zéphy",
                        fontname="gras", fontsize=34, color=BRUN,
                        align=fitz.TEXT_ALIGN_CENTER)
    page.insert_textbox(_cadre(gabarit, 0.53, 0.60), "Tome 1",
                        fontname="ital", fontsize=17, color=BRUN_PALE,
                        align=fitz.TEXT_ALIGN_CENTER)


def mentions_legales(document, fond, gabarit, annee: int, pages: int) -> None:
    page = _page(document, fond, gabarit)
    page.insert_textbox(_cadre(gabarit, 0.18, 0.28), "Roussy & Zéphy",
                        fontname="gras", fontsize=28, color=BRUN,
                        align=fitz.TEXT_ALIGN_CENTER)
    page.insert_textbox(_cadre(gabarit, 0.28, 0.35),
                        "Douze aventures pour apprivoiser ses émotions\n"
                        "et quatre histoires bonus en Bretagne",
                        fontname="ital", fontsize=12.5, lineheight=1.5,
                        color=BRUN_PALE, align=fitz.TEXT_ALIGN_CENTER)
    page.insert_textbox(_cadre(gabarit, 0.38, 0.44),
                        "Texte et illustrations\nErwann Lefouzèbreizh",
                        fontname="corps", fontsize=13, lineheight=1.6,
                        color=ENCRE, align=fitz.TEXT_ALIGN_CENTER)

    legal = (
        f"© {annee} Erwann Lefouzèbreizh. Tous droits réservés.\n\n"
        "Aucune partie de cet ouvrage ne peut être reproduite, transmise ou "
        "diffusée sous quelque forme que ce soit, électronique ou mécanique, "
        "sans l’autorisation écrite préalable de l’auteur, hors les courtes "
        "citations permises par la loi.\n\n"
        "ISBN : ____________________\n"
        f"Dépôt légal : {annee}\n\n"
        "Achevé d’imprimer à la demande.\n"
        f"Format 21,6 × 21,6 cm — {pages} pages — impression couleur."
    )
    page.insert_textbox(_cadre(gabarit, 0.60, 0.90), legal,
                        fontname="corps", fontsize=8.6, lineheight=1.55,
                        color=ENCRE, align=fitz.TEXT_ALIGN_CENTER)


def solutions(document, fond, gabarit, ecarts) -> None:
    page = _page(document, fond, gabarit)
    page.insert_textbox(_cadre(gabarit, 0.100, 0.160),
                        "Les solutions du Goûter des menhirs",
                        fontname="gras", fontsize=18, color=BRUN,
                        align=fitz.TEXT_ALIGN_CENTER)
    page.insert_textbox(_cadre(gabarit, 0.158, 0.222),
                        "Sept différences, de la plus facile à la plus difficile.\n"
                        "Tu les avais toutes trouvées ?",
                        fontname="ital", fontsize=10.5, lineheight=1.5,
                        color=BRUN_PALE, align=fitz.TEXT_ALIGN_CENTER)

    # Sept fentes de hauteur égale : une liste numérotée qui déborde sur le mot
    # de fin est pire qu'une liste serrée, et la planche ne s'agrandit pas.
    cadre = _cadre(gabarit, 0.230, 0.700)
    fente = (cadre.y1 - cadre.y0) / len(ecarts)
    for i, e in enumerate(ecarts):
        haut = cadre.y0 + i * fente
        page.insert_textbox(fitz.Rect(cadre.x0, haut + 1, cadre.x0 + 20, haut + 20),
                            f"{e.rang}.", fontname="gras", fontsize=11.5, color=BRUN)
        page.insert_textbox(fitz.Rect(cadre.x0 + 22, haut, cadre.x1, haut + fente - 4),
                            # .capitalize() minusculerait « Zéphy » : on ne touche que l’initiale.
                            f"{e.intitule}.\n{e.ou[0].upper()}{e.ou[1:]}.",
                            fontname="corps", fontsize=9.8, lineheight=1.45, color=ENCRE)

    page.insert_textbox(_cadre(gabarit, 0.730, 0.782), "Merci",
                        fontname="gras", fontsize=16, color=BRUN,
                        align=fitz.TEXT_ALIGN_CENTER)
    page.insert_textbox(_cadre(gabarit, 0.780, 0.905),
                        "Merci d’avoir accompagné Roussy et Zéphy jusqu’ici.\n"
                        "Si une seule de ces histoires t’a fait sourire un jour "
                        "où c’était difficile, alors ce livre a fait son travail.\n"
                        "À bientôt pour le tome 2.",
                        fontname="corps", fontsize=10.2, lineheight=1.7,
                        color=ENCRE, align=fitz.TEXT_ALIGN_CENTER)


def fabriquer(bordure: Path, vers: Path, annee: int, pages: int,
              gabarit: charte.Gabarit | None = None) -> dict[str, str]:
    gabarit = gabarit or charte.GABARIT_INTERIEUR
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from page17 import ECARTS

    fond = _fond(bordure, gabarit)
    vers.mkdir(parents=True, exist_ok=True)
    faites = {}
    for nom, composer in (("00_faux_titre", lambda d: faux_titre(d, fond, gabarit)),
                          ("00_mentions_legales",
                           lambda d: mentions_legales(d, fond, gabarit, annee, pages)),
                          ("99_solutions", lambda d: solutions(d, fond, gabarit, ECARTS))):
        document = fitz.open()
        composer(document)
        chemin = vers / f"{nom}.pdf"
        document.save(str(chemin), deflate=True, garbage=4)
        document.close()
        faites[nom] = str(chemin)
        print(f"  {nom:22s} -> {chemin}")
    return faites


if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--bordure", required=True, help="planche dont on reprend le cadre")
    a.add_argument("--vers", required=True)
    a.add_argument("--annee", type=int, default=2026)
    a.add_argument("--pages", type=int, default=24)
    args = a.parse_args()
    fabriquer(Path(args.bordure), Path(args.vers), args.annee, args.pages)
