#!/usr/bin/env python3
"""Lettrage vectoriel d'une planche 2 × 2 générée sans texte.

C'est la leçon la plus chère du tome 1, écrite dans `kdp/CLAUDE.md` : **un texte
généré dans l'image impose de tout refaire à la moindre coquille.** Il y en a eu
trois, chacune payée d'une réémission de planche. Un texte tracé se corrige en
une ligne et reste net à n'importe quelle taille.

Le module ne connaît aucune histoire : il lit le dossier de production
(`kdp/tome1/DOSSIER.md`, `kdp/tome2/DOSSIER.md`) et lettre ce qu'il y trouve —
titre, bulles, parchemin, médaillons numérotés. Ajouter une histoire ne le
touche pas.

Trois décisions valent d'être expliquées.

**La bulle est taillée sur son texte, puis resserrée tant que cela n'ajoute pas
de ligne.** Une boîte fixe laisse sous les répliques courtes un vide qui masque
du dessin pour rien ; une bulle large d'une case entière lit comme un bandeau.

**Les placements sont déduits du nombre de répliques**, pas déclarés page par
page. Une case à une réplique la centre en haut ; à deux, elle les pose en
quinconce, la seconde plus bas. `PLACEMENTS` ne sert qu'aux exceptions — une
case où le personnage occupe le haut. Déclarer les vingt-sept pages aurait
produit une table fausse dès la première planche redessinée.

**`--reperes` dessine les boîtes à vide.** Une bulle mal placée couvre le
personnage qui parle, et aucun chiffre ne le dit : cela ne se voit qu'à l'œil.
"""

from __future__ import annotations

import io
import os
import re
import sys
from pathlib import Path

import fitz
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import charte  # noqa: E402

# Le chemin par défaut n'existe qu'à l'intérieur d'une session Claude Code. Les
# tests de lettrage passaient donc dans la session qui les écrivait et
# échouaient partout ailleurs — `main` est resté rouge cinq exécutions durant
# sur six erreurs « cannot open Lora-Regular.ttf ». D'où `KDP_POLICES` : la CI
# pose la police où elle veut et le dit, sans qu'on ait à versionner un binaire.
POLICES = Path(os.environ.get("KDP_POLICES",
                              "/mnt/skills/examples/canvas-design/canvas-fonts"))
CORPS, ITALIQUE = POLICES / "Lora-Regular.ttf", POLICES / "Lora-Italic.ttf"

BRUN = (0.36, 0.24, 0.12)
ENCRE = (0.11, 0.10, 0.09)
CREME = (0.988, 0.976, 0.949)

# Cases de la grille, en fractions de page. Relevées sur les planches du tome 1.
CASES = [(0.075, 0.095, 0.487, 0.485), (0.513, 0.095, 0.925, 0.485),
         (0.075, 0.505, 0.487, 0.885), (0.513, 0.505, 0.925, 0.885)]

# Boîtes offertes aux bulles d'une case, selon leur nombre, en fractions de case.
# La hauteur n'est qu'un plafond : la bulle se replie sur son texte.
# Le coin haut-gauche appartient au médaillon : aucune bulle n'y commence,
# sans quoi le numéro et la bulle se recouvrent l'un l'autre selon l'ordre de
# tracé, et l'ordre de lecture des quatre cases se perd.
MEDAILLON = 0.115
OFFRE = {
    1: [(MEDAILLON, 0.04, 0.94, 0.34)],
    2: [(MEDAILLON, 0.04, 0.50, 0.34), (0.53, 0.11, 0.98, 0.42)],
    3: [(MEDAILLON, 0.03, 0.47, 0.30), (0.56, 0.03, 0.98, 0.30),
        (0.18, 0.33, 0.82, 0.60)],
}

# Exceptions seulement : (tome, page, numéro de case) → boîtes de remplacement.
PLACEMENTS: dict[tuple[int, int, int], list[tuple[float, float, float, float]]] = {}

# Lora ne dessine ni l'espace fine insécable ni l'espace fine : à leur place
# elle pose un glyphe parasite, et « Ouvre grand ! » sort « Ouvre grandn ! ».
# On les rend donc par l'insécable ordinaire, la seule des trois que la police
# connaisse. Le dossier garde la typographie juste ; c'est le tracé qui
# s'adapte à ce que la police sait faire, jamais l'inverse.
SANS_GLYPHE = {"\u202f": "\u00a0", "\u2009": "\u00a0"}


def rendable(texte: str) -> str:
    for absent, present in SANS_GLYPHE.items():
        texte = texte.replace(absent, present)
    return texte


# Une réplique porte parfois deux locuteurs, séparés par un tiret cadratin.
SEPARATEUR = re.compile(r"\s+—\s+(?=[A-ZÉÈÀÂÎÔÛ][^\s:]*\s*:)")
LOCUTEUR = re.compile(r"^([A-ZÉÈÀÂÎÔÛ][^\s:]*)\s*:\s*(.+)$", re.S)


def repliques(ligne: str) -> list[tuple[str, str]]:
    """Découpe « Roussy : … — Zéphy : … » en autant de bulles."""
    sorties = []
    for part in SEPARATEUR.split(ligne.strip()):
        if (m := LOCUTEUR.match(part.strip())):
            sorties.append((m.group(1), m.group(2).strip()))
        elif part.strip():
            sorties.append(("", part.strip()))
    return sorties


def _fond(planche: Path, cote: int) -> bytes:
    """La planche, en JPEG de qualité — c'est un fond, pas du trait."""
    with Image.open(planche) as brut:
        image = brut.convert("RGB")
    if image.size != (cote, cote):
        image = image.resize((cote, cote), Image.LANCZOS)
    tampon = io.BytesIO()
    image.save(tampon, format="JPEG", quality=95, optimize=True, subsampling=0)
    return tampon.getvalue()


def hauteur_utile(gabarit: charte.Gabarit, largeur: float, texte: str,
                  corps: float) -> float:
    """Hauteur minimale où le texte tient, mesurée sur une page jetable."""
    brouillon = fitz.open()
    page = brouillon.new_page(width=gabarit.points[0], height=gabarit.points[1])
    page.insert_font(fontname="corps", fontfile=str(CORPS))
    haut = corps
    while haut < gabarit.points[1] * 0.5:
        reste = page.insert_textbox(fitz.Rect(0, 0, largeur, haut), rendable(texte),
                                    fontname="corps", fontsize=corps,
                                    align=fitz.TEXT_ALIGN_CENTER, lineheight=1.25)
        if reste >= 0:
            brouillon.close()
            return haut
        haut += corps * 0.2
    brouillon.close()
    return haut


def _bulle(page: fitz.Page, cadre: fitz.Rect, texte: str, corps: float,
           gabarit: charte.Gabarit) -> fitz.Rect:
    marge = cadre.width * 0.055
    large = cadre.width - 2 * marge
    plein = hauteur_utile(gabarit, large, texte, corps)

    etroit, essai = large, large
    while essai > large * 0.5:
        essai -= large * 0.05
        if hauteur_utile(gabarit, essai, texte, corps) > plein:
            break
        etroit = essai

    demi = (cadre.width - (etroit + 2 * marge)) / 2
    boite = fitz.Rect(cadre.x0 + demi, cadre.y0,
                      cadre.x1 - demi, cadre.y0 + plein + 2 * marge)

    page.draw_rect(boite, radius=0.30, color=BRUN, fill=CREME, width=1.1)
    cx = boite.x0 + boite.width * 0.5
    page.draw_polyline([fitz.Point(cx - boite.width * 0.055, boite.y1 - 1),
                        fitz.Point(cx, boite.y1 + boite.height * 0.28),
                        fitz.Point(cx + boite.width * 0.055, boite.y1 - 1)],
                       color=BRUN, fill=CREME, width=1.1, closePath=True)
    page.insert_textbox(fitz.Rect(boite.x0 + marge, boite.y0 + marge,
                                  boite.x1 - marge, boite.y1),
                        rendable(texte), fontname="corps", fontsize=corps, color=ENCRE,
                        align=fitz.TEXT_ALIGN_CENTER, lineheight=1.25)
    return boite


def _medaillon(page: fitz.Page, centre: fitz.Point, rayon: float, n: int) -> None:
    page.draw_circle(centre, rayon, color=BRUN, fill=CREME, width=1.2)
    page.insert_textbox(fitz.Rect(centre.x - rayon, centre.y - rayon * 0.75,
                                  centre.x + rayon, centre.y + rayon),
                        str(n), fontname="corps", fontsize=rayon * 1.05,
                        color=BRUN, align=fitz.TEXT_ALIGN_CENTER)


def composer(planche: Path, cible: Path, page_dossier: dict, tome: int,
             numero: int, gabarit: charte.Gabarit | None = None,
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

    page.insert_textbox(fitz.Rect(0, hauteur * 0.030, largeur, hauteur * 0.090),
                        rendable(f"Roussy & Zéphy - {page_dossier['titre']}"),
                        fontname="ital", fontsize=largeur * 0.032,
                        color=BRUN, align=fitz.TEXT_ALIGN_CENTER)

    posees = 0
    for indice, case in enumerate(cases):
        ligne = next((t for n, t in page_dossier["repliques"]
                      if int(n) == indice + 1), "")
        if not ligne:
            continue
        bulles = repliques(ligne)
        offre = PLACEMENTS.get((tome, numero, indice + 1)) or OFFRE.get(len(bulles))
        if offre is None:
            raise ValueError(f"page {numero}, case {indice+1} : "
                             f"{len(bulles)} bulles, aucun placement connu")
        for (a, b, c, d), (_, texte) in zip(offre, bulles):
            cadre = fitz.Rect(case.x0 + a * case.width, case.y0 + b * case.height,
                              case.x0 + c * case.width, case.y0 + d * case.height)
            if reperes:
                page.draw_rect(cadre, color=(0, 0.5, 1), width=1.5)
            else:
                _bulle(page, cadre, texte, largeur * 0.0165, gabarit)
            posees += 1
        if reperes:
            page.draw_rect(case, color=(1, 0, 0), width=2)

    # Après les bulles : une bulle posée par-dessus effacerait le numéro, et
    # avec lui l'ordre de lecture des quatre cases.
    for indice, case in enumerate(cases):
        _medaillon(page, fitz.Point(case.x0 + case.width * 0.055,
                                    case.y0 + case.height * 0.06),
                   case.width * 0.038, indice + 1)

    if page_dossier["parchemin"]:
        page.insert_textbox(fitz.Rect(largeur * 0.14, hauteur * 0.905,
                                      largeur * 0.86, hauteur * 0.960),
                            rendable(page_dossier["parchemin"]), fontname="ital",
                            fontsize=largeur * 0.0155, color=BRUN,
                            align=fitz.TEXT_ALIGN_CENTER, lineheight=1.3)

    document.set_metadata({"title": f"Roussy & Zéphy — {page_dossier['titre']}",
                           "author": "Erwann Lefouzèbreizh"})
    cible.parent.mkdir(parents=True, exist_ok=True)
    document.save(str(cible), deflate=True, garbage=4)
    document.close()
    print(f"{cible} — « {page_dossier['titre']} », {posees} bulle(s)"
          + (" — REPÈRES seuls" if reperes else ""))


def _dossier(chemin: Path) -> dict[int, dict]:
    import importlib.util
    prompts = chemin.parent / "prompts.py"
    source = prompts if prompts.exists() else Path(__file__).parents[1] / "tome2/prompts.py"
    spec = importlib.util.spec_from_file_location("_prompts", source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.decouper(chemin)[1]


if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--planche", required=True, help="planche générée, sans texte")
    a.add_argument("--dossier", required=True, help="DOSSIER.md du tome")
    a.add_argument("--page", type=int, required=True)
    a.add_argument("--tome", type=int, default=1, choices=sorted(charte.TOMES))
    a.add_argument("--vers", required=True)
    a.add_argument("--reperes", action="store_true",
                   help="dessiner les boîtes à vide, pour les ajuster à l'œil")
    args = a.parse_args()
    pages = _dossier(Path(args.dossier))
    if args.page not in pages:
        raise SystemExit(f"page {args.page} absente de {args.dossier}")
    composer(Path(args.planche), Path(args.vers), pages[args.page],
             args.tome, args.page, reperes=args.reperes)
