#!/usr/bin/env python3
"""Injecte les images et les zones du jeu dans le gabarit de la page.

La page doit être un seul fichier : elle sera hébergée n'importe où, et un
site d'une page qui traîne un dossier d'images se casse au premier
déplacement. Les images partent donc en base64 dans le HTML.

Les sept zones cliquables ne sont pas recopiées à la main : elles viennent de
`kdp/pipeline/page17.py`, la même source que la planche imprimée. Si un écart
bouge, il bouge des deux côtés.
"""

from __future__ import annotations

import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "pipeline"))
import charte  # noqa: E402
from page17 import ECARTS, VIGNETTE_A, VIGNETTE_B  # noqa: E402

# La pose de bordure a réduit la planche du jeu : les vignettes ont bougé
# d'autant. Voir kdp/pipeline/bordure.py.
RENTREE_BORDURE = 0.10
APERCUS = ((10, "p10"), (8, "p08"), (11, "p11"), (13, "p13"))
# L'histoire bonus n'appartient pas au tome : elle est passée à part.
BONUS_DEFAUT = "bourricot.webp"


def _jpeg(image: Image.Image, largeur: int, qualite: int) -> str:
    image = image.resize((largeur, round(largeur * image.height / image.width)), Image.LANCZOS)
    tampon = io.BytesIO()
    image.save(tampon, "JPEG", quality=qualite, optimize=True, progressive=True)
    return "data:image/jpeg;base64," + base64.b64encode(tampon.getvalue()).decode()


def _planche(dossier: Path, numero: int) -> Path | None:
    page = next(p for p in charte.TOME_1 if p.numero == numero)
    base = charte.nom_de_page(page.numero, page.slug, "")
    return next((dossier / f"{base}{e}" for e in (".png", ".webp", ".jpg")
                 if (dossier / f"{base}{e}").exists()), None)


def fabriquer(planches: Path, vers: Path, bonus_chemin: str | None = None) -> Path:
    gabarit = (Path(__file__).parent / "page.html.gabarit").read_text()

    jeu = _planche(planches, 17)
    if jeu is None:
        raise SystemExit("planche 17 introuvable : le jeu ne peut pas être fabriqué")
    with Image.open(jeu) as brut:
        source = brut.convert("RGB")
    echelle = 1 - RENTREE_BORDURE
    decalage = source.width * RENTREE_BORDURE / 2

    def transposer(boite):
        return tuple(round(v * echelle + decalage) for v in boite)

    gabarit = gabarit.replace("{{A}}", _jpeg(source.crop(transposer(VIGNETTE_A)), 760, 82))
    gabarit = gabarit.replace("{{B}}", _jpeg(source.crop(transposer(VIGNETTE_B)), 760, 82))

    for numero, cle in APERCUS:
        chemin = _planche(planches, numero)
        if chemin is None:
            raise SystemExit(f"planche {numero} introuvable")
        with Image.open(chemin) as brut:
            gabarit = gabarit.replace("{{%s}}" % cle, _jpeg(brut.convert("RGB"), 620, 74))

    bonus = Path(bonus_chemin) if bonus_chemin else None
    if bonus and bonus.exists():
        with Image.open(bonus) as brut:
            gabarit = gabarit.replace("{{bonus}}", _jpeg(brut.convert("RGB"), 900, 78))
    else:
        raise SystemExit(f"histoire bonus introuvable : {bonus}")

    zones = [{"n": e.rang, "t": e.intitule, "ou": e.ou,
              "x": round(e.boite[0] / 727 * 100, 2), "y": round(e.boite[1] / 1310 * 100, 2),
              "w": round((e.boite[2] - e.boite[0]) / 727 * 100, 2),
              "h": round((e.boite[3] - e.boite[1]) / 1310 * 100, 2)} for e in ECARTS]
    gabarit = gabarit.replace("{{ZONES}}", json.dumps(zones, ensure_ascii=False))

    vers.mkdir(parents=True, exist_ok=True)
    page = vers / "index.html"
    page.write_text(gabarit)
    print(f"{page} — {page.stat().st_size/1e6:.2f} Mo, {len(zones)} zones cliquables")
    return page


if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--planches", required=True)
    a.add_argument("--vers", required=True)
    a.add_argument("--bonus", required=True, help="planche de l'histoire bonus")
    args = a.parse_args()
    fabriquer(Path(args.planches), Path(args.vers), args.bonus)
