#!/usr/bin/env python3
"""Étape 5 — corriger le sommaire de la quatrième de couverture.

Deux des quatre histoires bonus y portent un titre que les planches ne
confirment pas : « Le Phare dans la Tempête » et « La Ville d'Ys ». L'auteur a
tranché — les planches font foi —, donc c'est le dos qui se corrige.

Le texte est pixellisé : il faut le retracer. Deux partis pris, chacun contre
une solution plus évidente mais plus laide :

- **Les quatre lignes sont recomposées**, pas seulement les deux fautives.
  Aucune fonte disponible ne reproduit exactement la sans condensée d'origine ;
  corriger deux lignes sur quatre laisserait une liste bâtarde, moitié dans une
  police, moitié dans une autre. Tout recomposer garde la liste homogène.
- **La police est condensée d'un facteur unique.** À hauteur de capitale égale,
  la plus proche disponible est 23 % trop large. Le facteur est mesuré sur les
  deux lignes qu'on ne change pas, ce qui garantit qu'elles retombent
  exactement à leur place et à leur longueur.

Les puces ne sont pas touchées : elles sont hors de la zone reprise.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

POLICE = Path("/mnt/skills/examples/canvas-design/canvas-fonts/InstrumentSans-Regular.ttf")

# Relevés au pixel sur la planche d'origine (1600 x 1600).
GAUCHE = 600                       # début du texte, après la puce
LIGNES_DE_BASE = (1199, 1262, 1325, 1388)
# À reboucher : le texte, jamais les puces (qui s'arrêtent vers x 572).
# La bande commence bien avant l'encre — à 590 avec un fondu de 14, la rampe
# tombait sur le premier glyphe et n'en effaçait que la moitié : le « L » de
# « Le Phare » a laissé un filet gris devant « Tempête ». La rampe ne doit
# jamais rencontrer d'encre.
ZONE = (576, 1146, 1214, 1416)
TAILLE = 53                        # donne 38 px de hauteur de capitale
CONDENSATION = 0.792               # mesuré sur les deux lignes conservées
ENCRE = (6, 5, 3)

SOMMAIRE = (
    "Le Secret de l’Hermine",
    "Tempête et Bigorneaux",          # était « Le Phare dans la Tempête »
    "Le Secret des Vagues d’Ys",      # était « La Ville d’Ys »
    "La Magie du Fest Noz",
)


def _teinte_du_papier(image: Image.Image, zone, marge: int = 26) -> tuple[int, int, int]:
    cadre = image.crop((zone[0] - marge, zone[1] - marge, zone[2] + marge, zone[3] + marge))
    a = np.asarray(cadre.convert("RGB")).reshape(-1, 3)
    clairs = a[a.mean(axis=1) > 185]
    return tuple(int(v) for v in np.median(clairs if len(clairs) > 50 else a, axis=0))


def _ligne(texte: str, police: ImageFont.FreeTypeFont) -> tuple[Image.Image, int]:
    """Rend une ligne en RVBA et la condense. Renvoie l'image et sa ligne de base."""
    largeur = police.getbbox(texte)[2] + 20
    hauteur, base = 120, 80
    canevas = Image.new("RGBA", (largeur, hauteur), (0, 0, 0, 0))
    ImageDraw.Draw(canevas).text((0, base), texte, font=police, fill=ENCRE + (255,),
                                 anchor="ls")
    condensee = canevas.resize((max(1, round(largeur * CONDENSATION)), hauteur),
                               Image.LANCZOS)
    return condensee, base


def corriger(source: Path, cible: Path) -> None:
    with Image.open(source) as brut:
        planche = brut.convert("RGB")

    # Rebouchage à bords fondus : un rectangle de papier posé net se repère à
    # sa lisière, même quand la couleur est juste, parce que le grain s'arrête.
    largeur, hauteur = ZONE[2] - ZONE[0], ZONE[3] - ZONE[1]
    fondu = 6
    rampe = np.minimum(
        np.clip(np.minimum(np.arange(hauteur), hauteur - 1 - np.arange(hauteur)) / fondu, 0, 1)[:, None],
        np.clip(np.minimum(np.arange(largeur), largeur - 1 - np.arange(largeur)) / fondu, 0, 1)[None, :])
    aplat = Image.new("RGB", (largeur, hauteur), _teinte_du_papier(planche, ZONE))
    planche.paste(aplat, ZONE[:2], Image.fromarray((rampe * 255).astype(np.uint8), "L"))

    police = ImageFont.truetype(str(POLICE), TAILLE)
    for texte, base in zip(SOMMAIRE, LIGNES_DE_BASE):
        rendu, base_locale = _ligne(texte, police)
        planche.paste(rendu, (GAUCHE, base - base_locale), rendu)
        print(f"  ligne de base {base}  {texte}")

    cible.parent.mkdir(parents=True, exist_ok=True)
    planche.save(cible, compress_level=6)
    print(f"\nsommaire recomposé -> {cible}")


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--source", required=True)
    p.add_argument("--vers", required=True)
    a = p.parse_args()
    corriger(Path(a.source), Path(a.vers))
