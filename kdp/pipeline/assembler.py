#!/usr/bin/env python3
"""Étape 6 — assembler l'intérieur de vingt-quatre pages et la couverture.

L'ordre est celui d'un livre, pas celui du dossier d'illustrations : faux-titre,
mentions légales, les vingt et une planches, solutions du jeu. Vingt-quatre
pages exactement, ce qui satisfait à la fois le minimum de KDP et l'obligation
de compter pair.

La tranche se calcule sur ce nombre-là, et non sur le nombre d'illustrations :
c'est l'erreur qui fait revenir une couverture de l'imprimeur.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pymupdf
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import charte  # noqa: E402


def _placer(page: pymupdf.Page, rect: pymupdf.Rect, chemin: Path) -> str:
    """Pose une image dans un rectangle, sans perte et sans rééchantillonnage."""
    with Image.open(chemin) as im:
        largeur, hauteur = im.size
        rapport = largeur / hauteur
        cible = rect.width / rect.height
        if abs(rapport - cible) > 0.002:
            if rapport > cible:                     # recadrage centré, sans recalcul
                neuve = round(hauteur * cible)
                boite = ((largeur - neuve) // 2, 0, (largeur - neuve) // 2 + neuve, hauteur)
            else:
                neuve = round(largeur / cible)
                boite = (0, (hauteur - neuve) // 2, largeur, (hauteur - neuve) // 2 + neuve)
            im = im.crop(boite)
            note = "recadré, png sans perte"
        else:
            note = "png sans perte"
        import io
        tampon = io.BytesIO()
        im.convert("RGB").save(tampon, format="PNG", compress_level=6)
    page.insert_image(rect, stream=tampon.getvalue())
    return note


def _carton(page: pymupdf.Page, rect: pymupdf.Rect, libelle: str) -> None:
    page.draw_rect(rect, color=(0.85, 0, 0.5), fill=(1, 0.93, 0.98), width=3)
    page.insert_textbox(
        pymupdf.Rect(rect.x0 + 24, rect.y0 + rect.height / 2 - 60, rect.x1 - 24, rect.y1 - 24),
        f"FICHIER MANQUANT\nNE PAS PUBLIER\n\n{libelle}",
        fontname="hebo", fontsize=20, color=(0.7, 0, 0.4), align=pymupdf.TEXT_ALIGN_CENTER)


def _trouver(dossier: Path, base: str) -> Path | None:
    for ext in (".png", ".webp", ".jpg", ".jpeg"):
        p = dossier / f"{base}{ext}"
        if p.exists():
            return p
    return None


def interieur(planches: Path, complements: Path, cible: Path, tome: int = 1) -> int:
    gabarit = charte.GABARIT_INTERIEUR
    largeur, hauteur = gabarit.points
    document = pymupdf.open()

    for nom in ("00_faux_titre", "00_mentions_legales"):
        document.insert_pdf(pymupdf.open(str(complements / f"{nom}.pdf")))
        print(f"  page {len(document):02d}  {nom}")

    manquantes, composees = [], []
    for planche in charte.pages(tome):
        # Une page composée l'emporte sur la planche, et non l'inverse. Elle
        # existe pour deux raisons, et dans les deux cas elle est meilleure :
        # soit la planche manque et il faut bien raconter l'histoire annoncée
        # au sommaire, soit la planche existe mais a été refaite en vectoriel
        # — page de garde presque vide, QR code à retracer — auquel cas elle
        # est nette là où l'agrandissement rendait l'originale molle.
        composee = sorted(complements.glob(f"{planche.numero:02d}_*.pdf"))
        chemin = _trouver(planches, charte.nom_de_page(planche.numero, planche.slug, ""))
        if composee:
            document.insert_pdf(pymupdf.open(str(composee[0])))
            composees.append(planche.numero)
            etat = "composée" if chemin else "composée, en attente de planche"
            print(f"  page {len(document):02d}  {composee[0].name:52s} {etat}")
            continue
        if chemin is None:
            feuille = document.new_page(width=largeur, height=hauteur)
            _carton(feuille, pymupdf.Rect(0, 0, largeur, hauteur),
                    charte.nom_de_page(planche.numero, planche.slug))
            manquantes.append(planche.numero)
            print(f"  page {len(document):02d}  MANQUANTE — {planche.titre}")
        else:
            feuille = document.new_page(width=largeur, height=hauteur)
            note = _placer(feuille, pymupdf.Rect(0, 0, largeur, hauteur), chemin)
            print(f"  page {len(document):02d}  {chemin.name:52s} {note}")

    document.insert_pdf(pymupdf.open(str(complements / "99_solutions.pdf")))
    print(f"  page {len(document):02d}  99_solutions")

    document.set_metadata({"title": f"Roussy & Zéphy — Tome {tome}",
                           "author": "Erwann Lefouzèbreizh",
                           "subject": f"Intérieur KDP {gabarit.largeur}x{gabarit.hauteur} po, "
                                      f"300 DPI, fond perdu"})
    cible.parent.mkdir(parents=True, exist_ok=True)
    document.save(str(cible), deflate=True, garbage=4)
    total = len(document)
    document.close()

    print(f"\n{cible} — {total} pages, {gabarit.largeur} x {gabarit.hauteur} po, "
          f"{cible.stat().st_size/1e6:.1f} Mo")
    if total < charte.PAGES_MINIMUM_KDP:
        print(f"  ATTENTION : {total} pages, KDP en exige {charte.PAGES_MINIMUM_KDP}")
    if total % 2:
        print(f"  ATTENTION : {total} pages, il en faut un nombre pair")
    if composees:
        print(f"  pages composées : {composees}")
    if manquantes:
        print(f"  ATTENTION : cartons d'attente aux planches {manquantes}")
    return total


def couverture(planches: Path, cible: Path, pages: int) -> None:
    gabarit, tranche = charte.gabarit_couverture(pages)
    largeur, hauteur = gabarit.points
    p = charte.POUCE_EN_POINTS
    document = pymupdf.open()
    feuille = document.new_page(width=largeur, height=hauteur)

    bord_face = (charte.FOND_PERDU + charte.FORMAT_ROGNE + tranche) * p
    absents = []
    for nom, rect in ((charte.COUVERTURE_DOS,
                       pymupdf.Rect(0, 0, (charte.FOND_PERDU + charte.FORMAT_ROGNE) * p, hauteur)),
                      (charte.COUVERTURE_FACE,
                       pymupdf.Rect(bord_face, 0, largeur, hauteur))):
        chemin = _trouver(planches, nom)
        if chemin is None:
            _carton(feuille, rect, nom)
            absents.append(nom)
            print(f"  {nom:20s} MANQUANT")
        else:
            print(f"  {nom:20s} {chemin.name:34s} {_placer(feuille, rect, chemin)}")

    feuille.draw_rect(pymupdf.Rect((charte.FOND_PERDU + charte.FORMAT_ROGNE) * p, 0,
                                bord_face, hauteur), color=None, fill=(0.98, 0.96, 0.90))

    document.set_metadata({"title": "Roussy & Zéphy — couverture",
                           "author": "Erwann Lefouzèbreizh",
                           "subject": f"Couverture KDP, tranche {tranche:.4f} po pour {pages} pages"})
    cible.parent.mkdir(parents=True, exist_ok=True)
    document.save(str(cible), deflate=True, garbage=4)
    document.close()

    print(f"\n{cible} — {gabarit.largeur:.4f} x {gabarit.hauteur:.4f} po "
          f"({gabarit.largeur*25.4:.1f} x {gabarit.hauteur*25.4:.1f} mm)")
    print(f"  tranche {tranche:.4f} po ({tranche*25.4:.2f} mm) pour {pages} pages")
    if absents:
        print(f"  ATTENTION : cartons d'attente pour {absents}")


if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--planches", required=True)
    a.add_argument("--complements", required=True)
    a.add_argument("--vers", required=True)
    a.add_argument("--tome", type=int, default=1, choices=sorted(charte.TOMES))
    args = a.parse_args()
    vers = Path(args.vers)
    total = interieur(Path(args.planches), Path(args.complements),
                      vers / "interieur_kdp.pdf", args.tome)
    print()
    couverture(Path(args.planches), vers / "couverture_kdp.pdf", total)
