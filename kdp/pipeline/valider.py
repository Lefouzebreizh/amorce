#!/usr/bin/env python3
"""Contrôle de conformité KDP des deux PDF finaux.

Ce script est le seul juge. Il ne fabrique rien : il ouvre les fichiers tels
qu'ils partiront chez l'imprimeur et vérifie, un par un, les points sur
lesquels KDP refuse un dépôt ou sur lesquels un livre revient massicoté de
travers. Il sort en erreur dès qu'un seul contrôle échoue — un rapport qui
finit toujours en vert ne sert à rien.

Ce qu'il ne peut pas voir, et qu'aucun script ne verra : si le dessin est beau,
si le texte est juste, si l'histoire tient. Cela reste du ressort de la
relecture.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

import fitz

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import charte  # noqa: E402

TAILLE_MAX_MO = 650          # limite de dépôt KDP pour un intérieur


@dataclass
class Controle:
    intitule: str
    passe: bool
    detail: str


def _o(intitule, detail=""): return Controle(intitule, True, detail)
def _n(intitule, detail=""): return Controle(intitule, False, detail)


def controler_interieur(chemin: Path) -> list[Controle]:
    if not chemin.exists():
        return [_n("le fichier existe", str(chemin))]
    document = fitz.open(str(chemin))
    resultats: list[Controle] = []
    attendu = charte.GABARIT_INTERIEUR

    total = len(document)
    resultats.append(
        _o(f"{total} pages ≥ {charte.PAGES_MINIMUM_KDP}") if total >= charte.PAGES_MINIMUM_KDP
        else _n("nombre de pages", f"{total} < {charte.PAGES_MINIMUM_KDP} exigées par KDP"))
    resultats.append(
        _o(f"{total} pages, nombre pair") if total % 2 == 0
        else _n("parité", f"{total} pages : un intérieur se compte en pages paires"))

    mauvaises = [i for i, p in enumerate(document, 1)
                 if abs(p.rect.width - attendu.points[0]) > 0.5
                 or abs(p.rect.height - attendu.points[1]) > 0.5]
    resultats.append(
        _o(f"toutes les pages en {attendu.largeur} × {attendu.hauteur} po") if not mauvaises
        else _n("format des pages", f"pages hors gabarit : {mauvaises}"))

    faibles = []
    for i, page in enumerate(document, 1):
        images = page.get_images(full=True)
        if not images:
            continue
        info = document.extract_image(images[0][0])
        dpi = info["width"] / (page.rect.width / charte.POUCE_EN_POINTS)
        if dpi < charte.DPI_CIBLE - 1:
            faibles.append((i, round(dpi)))
    resultats.append(
        _o(f"toutes les images ≥ {charte.DPI_CIBLE} DPI") if not faibles
        else _n("résolution", f"pages sous la cible : {faibles}"))

    # Un carton d'attente est un rectangle magenta plein page : on le repère à
    # sa couleur de remplissage, qui n'existe nulle part ailleurs dans l'album.
    cartons = []
    for i, page in enumerate(document, 1):
        for dessin in page.get_drawings():
            f = dessin.get("fill")
            if f and abs(f[0] - 1) < 0.02 and abs(f[1] - 0.93) < 0.02 and abs(f[2] - 0.98) < 0.02:
                cartons.append(i)
                break
    resultats.append(
        _o("aucun carton d'attente") if not cartons
        else _n("planches manquantes", f"cartons d'attente aux pages {cartons}"))

    poids = chemin.stat().st_size / 1e6
    resultats.append(
        _o(f"{poids:.0f} Mo ≤ {TAILLE_MAX_MO} Mo") if poids <= TAILLE_MAX_MO
        else _n("taille du fichier", f"{poids:.0f} Mo > {TAILLE_MAX_MO} Mo"))

    document.close()
    return resultats


def controler_couverture(chemin: Path, pages: int) -> list[Controle]:
    if not chemin.exists():
        return [_n("le fichier existe", str(chemin))]
    document = fitz.open(str(chemin))
    resultats: list[Controle] = []
    attendu, tranche = charte.gabarit_couverture(pages)

    resultats.append(_o("une seule page") if len(document) == 1
                     else _n("nombre de pages", f"{len(document)} pages, il en faut une"))

    r = document[0].rect
    largeur, hauteur = r.width / charte.POUCE_EN_POINTS, r.height / charte.POUCE_EN_POINTS
    juste = abs(largeur - attendu.largeur) < 0.002 and abs(hauteur - attendu.hauteur) < 0.002
    resultats.append(
        _o(f"{largeur:.4f} × {hauteur:.4f} po, tranche {tranche * 25.4:.2f} mm pour {pages} pages")
        if juste else
        _n("format", f"{largeur:.4f} × {hauteur:.4f} po, attendu "
                     f"{attendu.largeur:.4f} × {attendu.hauteur:.4f}"))

    cartons = [1 for d in document[0].get_drawings()
               if (f := d.get("fill")) and abs(f[0] - 1) < 0.02
               and abs(f[1] - 0.93) < 0.02 and abs(f[2] - 0.98) < 0.02]
    resultats.append(_o("aucun carton d'attente") if not cartons
                     else _n("panneaux manquants", "carton d'attente sur la couverture"))

    document.close()
    return resultats


def main(argv: list[str] | None = None) -> int:
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--dossier", required=True, help="dossier des PDF finaux")
    args = a.parse_args(argv)
    dossier = Path(args.dossier)

    interieur = dossier / "interieur_kdp.pdf"
    pages = len(fitz.open(str(interieur))) if interieur.exists() else charte.PAGES_MINIMUM_KDP

    tout: list[Controle] = []
    for titre, controles in (("INTÉRIEUR", controler_interieur(interieur)),
                             ("COUVERTURE", controler_couverture(dossier / "couverture_kdp.pdf", pages))):
        print(f"\n{titre}")
        for c in controles:
            marque = "  ok  " if c.passe else "ÉCHEC "
            print(f"  {marque} {c.intitule}" + (f" — {c.detail}" if c.detail else ""))
        tout += controles

    echecs = [c for c in tout if not c.passe]
    print(f"\n{len(tout) - len(echecs)}/{len(tout)} contrôles passés.")
    if echecs:
        print("NON PUBLIABLE en l'état :")
        for c in echecs:
            print(f"  - {c.intitule} : {c.detail}")
        return 1
    print("PUBLIABLE — les deux fichiers satisfont les contraintes de dépôt KDP.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
