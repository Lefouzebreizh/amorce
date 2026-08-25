#!/usr/bin/env python3
"""Relève la part des couleurs signatures dans une planche. Sans verdict.

**Ce module ne dit pas si une planche a dérivé, et c'est délibéré.**

L'intention de départ était un contrôle automatique : le Tome 1 a vu la crinière
de Zéphy virer au moutarde en pages 6 et 9, et l'on voulait attraper ça sans
l'œil. Deux essais ont échoué, et il vaut mieux les raconter que les répéter.

Le premier comparait chaque pixel aux codes hexadécimaux de la charte, à faible
distance RVB. Il a rejeté **la planche de modèle elle-même**, celle qui définit
la palette : sur une aquarelle, presque aucun pixel ne tombe sur une valeur
exacte. Un contrôle qui recale sa propre référence est faux, pas sévère.

Le second mesurait l'équilibre entre la famille violette et la famille or. Il
est mieux fondé — mais la bande or attrape tout le feuillage d'automne, si bien
qu'une planche ensoleillée donne les mêmes chiffres qu'une crinière qui a viré.
Et la planche de modèle, sur fond blanc, ne se compare à aucune scène. Aucun
seuil ne sépare les deux cas.

Reste ce qui est vrai : les proportions elles-mêmes. Elles se lisent en tableau
et signalent une planche où le violet de Zéphy a presque disparu. C'est un
indice pour l'œil, pas un jugement — la dérive d'anatomie, elle, ne se mesure
pas du tout, et c'est l'auteur qui a repéré le regard vide du panneau 3.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import charte  # noqa: E402

# Les trois familles qui identifient les personnages. Les gris et les blancs
# sont écartés : ils sont partout et ne discriminent rien.
FAMILLES = {
    "violet": (0.740, 0.055),   # crinière, ailes, queue et yeux de Zéphy
    "or":     (0.120, 0.030),   # l'autre moitié des ailes — et tout l'automne
    "cuivre": (0.065, 0.030),   # le pelage de Roussy
}
SATURATION_MIN, CLARTE_MIN = 0.28, 0.25


def parts(planche: Path, cote: int = 500) -> dict[str, float]:
    """Part de la planche dans chaque famille de teinte, en pour mille."""
    with Image.open(planche) as brut:
        image = brut.convert("RGB")
    image.thumbnail((cote, cote), Image.LANCZOS)
    a = np.asarray(image).astype(np.float32) / 255

    maxi, mini = a.max(axis=2), a.min(axis=2)
    delta = np.maximum(maxi - mini, 1e-6)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    teinte = np.where(maxi == r, ((g - b) / delta) % 6,
                      np.where(maxi == g, (b - r) / delta + 2,
                               (r - g) / delta + 4)) / 6 % 1.0
    retenus = (delta / np.maximum(maxi, 1e-6) > SATURATION_MIN) & (maxi > CLARTE_MIN)

    return {nom: float(((np.abs(teinte - centre) < largeur) & retenus).sum())
                 / teinte.size * 1000
            for nom, (centre, largeur) in FAMILLES.items()}


if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("planches", nargs="+")
    args = a.parse_args()
    print(f"{'planche':46s}" + "".join(f"{n:>9s}" for n in FAMILLES))
    for chemin in sorted(Path(p) for p in args.planches):
        mesures = parts(chemin)
        nom = chemin.stem.replace("RoussyEtZephy_", "")[:44]
        print(f"{nom:46s}" + "".join(f"{mesures[n]:9.2f}" for n in FAMILLES))
    print("\nIndications, pas verdicts : la bande or contient aussi tout le "
          "feuillage d'automne.")
