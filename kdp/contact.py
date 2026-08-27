#!/usr/bin/env python3
"""Planches-contact : voir vingt-sept illustrations en sept regards.

Juger un recueil demande de le regarder en entier — le style qui décroche, la
bordure qui ne colle pas, la bulle posée sur un museau ne se mesurent pas. Mais
regarder les planches une à une coûte autant de lectures que de planches, et sur
un volume complet cela sature la mémoire de travail avant d'avoir tout vu.

Quatre planches par feuille à 740 pixels chacune : la composition des cases
reste lisible, et le texte des bulles aussi. Mesuré sur ce recueil — à 560 px
les bulles décrochent, à 740 elles se lisent encore. Vingt-sept planches
tiennent alors en sept feuilles.

Le cadre sombre entre les vignettes n'est pas décoratif : sans lui, deux fonds
crème voisins se lisent comme une seule image et l'on compare des cases qui
n'appartiennent pas à la même planche.
"""

from __future__ import annotations

import re
from pathlib import Path

from PIL import Image

COTE = 740          # côté d'une vignette, en pixels
ECART = 18          # gouttière sombre entre vignettes
FOND = (25, 25, 30)


def feuilles(planches: list[Path], vers: Path, par_feuille: int = 4,
             cote: int = COTE) -> list[Path]:
    vers.mkdir(parents=True, exist_ok=True)
    faites = []
    lots = [planches[i:i + par_feuille] for i in range(0, len(planches), par_feuille)]
    for rang, lot in enumerate(lots, 1):
        colonnes = 2 if len(lot) > 2 else len(lot)
        rangees = (len(lot) + colonnes - 1) // colonnes
        feuille = Image.new("RGB", (cote * colonnes + ECART * (colonnes - 1),
                                    cote * rangees + ECART * (rangees - 1)), FOND)
        for i, chemin in enumerate(lot):
            with Image.open(chemin) as brut:
                feuille.paste(brut.convert("RGB").resize((cote, cote), Image.LANCZOS),
                              ((i % colonnes) * (cote + ECART),
                               (i // colonnes) * (cote + ECART)))
        cible = vers / f"contact-{rang:02d}.png"
        feuille.save(cible, compress_level=6)
        noms = [re.sub(r".*_(Page\d+)_(.+)\.\w+$", r"\1 \2", p.name) for p in lot]
        print(f"  {cible.name}  {', '.join(noms)}")
        faites.append(cible)
    return faites


if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--planches", required=True, help="dossier des planches")
    a.add_argument("--vers", required=True)
    a.add_argument("--par-feuille", type=int, default=4, choices=(1, 2, 4))
    a.add_argument("--cote", type=int, default=COTE,
                   help="côté d'une vignette ; sous 700 le texte des bulles décroche")
    args = a.parse_args()
    trouvees = sorted(p for p in Path(args.planches).iterdir()
                      if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"))
    if not trouvees:
        raise SystemExit(f"aucune image dans {args.planches}")
    faites = feuilles(trouvees, Path(args.vers), args.par_feuille, args.cote)
    print(f"\n{len(trouvees)} planche(s) en {len(faites)} feuille(s)")
