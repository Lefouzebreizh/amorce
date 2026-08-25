#!/usr/bin/env python3
"""Émet un prompt prêt à coller par planche, depuis le dossier.

Le bloc de style et le prompt de chaque page vivent séparément dans le dossier,
ce qui est bien pour le lire et mauvais pour le produire : à seize planches, on
oublie une fois de préfixer le style, et Zéphy repart avec un torse humain.

Un fichier par page, autonome, avec le style déjà en tête et le texte des bulles
en clair sous le prompt — pour que celui qui lettre ait la forme exacte sous les
yeux, insécables comprises, sans revenir au dossier.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import charte  # noqa: E402

TITRE = re.compile(r"^##\s+Page\s+(\d+)\s+—\s+(.+?)\s*$")
REPLIQUE = re.compile(r"^\|\s*\*\*(\d)\*\*\s*\|(.+?)\|\s*$")
PARCHEMIN = re.compile(r"^>\s+\*(.+?)\*\s*$")


def decouper(dossier: Path) -> tuple[str, dict[int, dict]]:
    """Bloc de style commun, et le contenu de chaque page."""
    lignes = dossier.read_text("utf-8").splitlines()
    blocs, dedans, courant = [], False, []
    for ligne in lignes:
        if ligne.startswith("```"):
            if dedans:
                blocs.append("\n".join(courant)); courant = []
            dedans = not dedans
        elif dedans:
            courant.append(ligne)
    style = blocs[0] if blocs else ""

    pages: dict[int, dict] = {}
    numero, dedans = None, False
    tampon: list[str] = []
    for ligne in lignes:
        if (t := TITRE.match(ligne)):
            numero = int(t.group(1))
            pages[numero] = {"titre": t.group(2), "repliques": [], "parchemin": "", "prompt": ""}
        elif numero is None:
            continue
        elif (r := REPLIQUE.match(ligne)):
            texte = re.sub(r"\*\*|\*", "", r.group(2)).strip()
            pages[numero]["repliques"].append((r.group(1), texte))
        elif (p := PARCHEMIN.match(ligne)) and not pages[numero]["parchemin"]:
            pages[numero]["parchemin"] = p.group(1)
        elif ligne.startswith("```"):
            if dedans:
                pages[numero]["prompt"] = "\n".join(tampon); tampon = []
            dedans = not dedans
        elif dedans:
            tampon.append(ligne)
    return style, pages


def ecrire(dossier: Path, vers: Path, tome: int = 2) -> list[Path]:
    style, pages = decouper(dossier)
    sommaire = {p.numero: p for p in charte.pages(tome)}
    vers.mkdir(parents=True, exist_ok=True)
    faits = []

    for numero, page in sorted(pages.items()):
        if not page["prompt"]:
            continue
        fiche = sommaire.get(numero)
        nom = charte.nom_de_page(numero, fiche.slug, "") if fiche else f"Page{numero:02d}"
        titre_charte = fiche.titre if fiche else page["titre"]

        corps = [f"# {nom}", f"# {titre_charte}", "",
                 style, "",
                 f'Title across the top, in the elegant brown script: "{titre_charte}"',
                 "", page["prompt"], ""]
        if page["parchemin"]:
            corps += ["Parchment scroll across the bottom, one italic line:",
                      f'"{page["parchemin"]}"', ""]
        if page["repliques"]:
            corps += ["", "— Texte des bulles, à lettrer exactement ainsi",
                      "  (espaces fines insécables avant ! ? : ; déjà posées) —", ""]
            corps += [f"Panneau {n} : {t}" for n, t in page["repliques"]]

        chemin = vers / f"{nom}.txt"
        chemin.write_text("\n".join(corps) + "\n", "utf-8")
        faits.append(chemin)
        print(f"  {chemin.name:52s} {len(page['repliques'])} réplique(s)")
    return faits


if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("dossier")
    a.add_argument("--vers", required=True)
    a.add_argument("--tome", type=int, default=2, choices=sorted(charte.TOMES))
    args = a.parse_args()
    faits = ecrire(Path(args.dossier), Path(args.vers), args.tome)
    print(f"\n{len(faits)} prompt(s) autonome(s) dans {args.vers}")
