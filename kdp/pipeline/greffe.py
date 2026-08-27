#!/usr/bin/env python3
"""Poser le contenu d'une planche régénérée dans le cadre d'une planche du volume.

Une planche régénérée revient avec sa propre bordure, et celle-ci ne ressemble
jamais tout à fait aux autres : feuilles plus grosses, orange plus saturé,
plumes violettes en retrait. Posée entre deux planches d'origine, elle décroche
au premier feuilletage — c'est l'auteur qui l'a vu, avant toute mesure.

**On ne reconstitue pas la bordure : on greffe le contenu neuf dans un cadre
existant.** L'inverse — transplanter la bordure sur la planche neuve — a été
essayé et demande de la refabriquer à partir d'une grappe d'angle, ce qui rend
une frise mécanique là où l'originale est dispersée. Greffer dans un cadre ne
demande rien : la bordure reste celle du volume, au pixel, parce que c'est la
sienne.

Trois pièges, chacun rencontré :

- **La teinte du papier ne se déduit pas de la planche neuve.** `couleur_du_fond`
  y rend l'orange de la bordure, pas le crème. On la prélève sur la donneuse,
  dont on sait qu'elle porte le papier du volume.
- **Le titre de la donneuse doit être recouvert franchement.** Recouvert avec un
  fondu sur son bord bas, il transparaît dans la bande où ni le papier ni le
  collage ne sont opaques. Le bas de la bande ne se fond donc pas.
- **Le contenu neuf n'est pas carré.** Cases et parchemin forment un rectangle ;
  le compléter au papier avant de le mettre à l'échelle évite de l'étirer.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Zone de contenu des planches du volume — cases et parchemin, hors bordure.
CADRE = (0.062, 0.082, 0.938, 0.968)
# Bande du titre de la donneuse, à recouvrir : il sera retracé en vectoriel.
TITRE = (0.130, 0.016, 0.870, 0.100)
# Contenu utile d'une planche régénérée, sa propre bordure retirée.
CONTENU = (0.105, 0.100, 0.895, 0.965)


def creme(planche: Image.Image) -> tuple[int, int, int]:
    """Teinte du papier, prélevée sur les pixels clairs."""
    a = np.asarray(planche.convert("RGB")).reshape(-1, 3)
    clairs = a[a.mean(axis=1) > 205]
    return tuple(int(v) for v in np.median(clairs if len(clairs) > 500 else a, axis=0))


def _rampe(taille: tuple[int, int], fondu: int, bas: bool = True) -> Image.Image:
    largeur, hauteur = taille
    vertical = np.minimum(np.arange(hauteur), hauteur - 1 - np.arange(hauteur))
    if not bas:                       # bord inférieur franc, pas fondu
        vertical = np.minimum(np.arange(hauteur), hauteur).astype(float)
    r = np.minimum(np.clip(vertical / fondu, 0, 1)[:, None],
                   np.clip(np.minimum(np.arange(largeur),
                                      largeur - 1 - np.arange(largeur)) / fondu, 0, 1)[None, :])
    return Image.fromarray((r * 255).astype(np.uint8), "L")


def greffer(neuve: Path, donneuse: Path, cible: Path) -> None:
    with Image.open(donneuse) as d:
        cadre = d.convert("RGB")
    cote = cadre.size[0]
    papier = creme(cadre)

    with Image.open(neuve) as brut:
        image = brut.convert("RGB")
    n = image.size[0]
    contenu = image.crop(tuple(round(f * n) for f in
                               (CONTENU[0], CONTENU[1], CONTENU[2], CONTENU[3])))
    carre = Image.new("RGB", (max(contenu.size),) * 2, papier)
    carre.paste(contenu, ((max(contenu.size) - contenu.size[0]) // 2,
                          (max(contenu.size) - contenu.size[1]) // 2))

    boite = tuple(round(f * cote) for f in CADRE)
    taille = (boite[2] - boite[0], boite[3] - boite[1])
    carre = carre.resize(taille, Image.LANCZOS)
    fondu = max(8, int(min(taille) * 0.010))
    cadre.paste(carre, boite[:2],
                _rampe(taille, fondu).filter(ImageFilter.GaussianBlur(2)))

    tb = tuple(round(f * cote) for f in TITRE)
    bande = Image.new("RGB", (tb[2] - tb[0], tb[3] - tb[1]), papier)
    cadre.paste(bande, tb[:2],
                _rampe(bande.size, max(6, int(bande.size[1] * 0.14)), bas=False))

    cible.parent.mkdir(parents=True, exist_ok=True)
    cadre.save(cible, compress_level=6)
    print(f"  {neuve.name} greffée dans le cadre de {donneuse.name} "
          f"-> {cible} ({cote}×{cote}, papier {papier})")


if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--neuve", required=True, help="planche régénérée, sans texte")
    a.add_argument("--donneuse", required=True, help="planche du volume, pour son cadre")
    a.add_argument("--vers", required=True)
    args = a.parse_args()
    greffer(Path(args.neuve), Path(args.donneuse), Path(args.vers))
