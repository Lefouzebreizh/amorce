#!/usr/bin/env python3
"""Comparer une planche refaite à celle qu'elle remplace.

Régénérer une planche en plus haute définition n'est pas l'agrandir : le
générateur redessine, et il dérive. Un renard change de pose, une écharpe change
de couleur, un personnage disparaît d'un coin. Sur vingt planches reprises,
personne ne repère les trois qui ont bougé — on s'en aperçoit sur le livre
imprimé.

Ce script compare l'ancienne et la nouvelle, et dit **où** ça a bougé.

Trois décisions le gouvernent, dont deux tirées d'erreurs :

**On ne compare pas les pixels.** La similarité structurelle (SSIM) a été
écrite, essayée, puis jetée : deux images de la même scène redessinées
séparément n'ont aucun pixel en commun — chaque feuille, chaque brin d'herbe est
retracé. Mesuré sur les deux panneaux d'un jeu des sept différences, que l'œil
dit identiques : 0,15, soit la note de deux planches étrangères. Le SSIM répond
à « est-ce la même image », jamais à « est-ce la même scène ».

**On compare des masses.** Ramenées à une grille de huit par huit, les moyennes
de valeur décrivent la composition sans la texture. Sur le même couple : 0,87 de
corrélation, contre 0,18 pour deux planches sans rapport. La question devient
séparable.

**La note d'ensemble ne suffit jamais.** Une planche dont un seul quart a changé
garde une bonne note globale — c'est le cas où l'on valide sans regarder. Le
rapport nomme donc toujours la zone la plus divergente, en clair.

Ce qu'il ne dit pas : si la nouvelle planche est meilleure. Une dérive peut être
un progrès ; l'outil signale, l'auteur tranche.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

CADRAGE = 512        # définition de travail pour le recalage
GRILLE = 8           # côté de la grille de masses
ZONES = 4            # grille de nommage : seize zones nommables en français
CORRELATION = 0.80   # en deçà, ce n'est plus la même scène
ECART = 20.0         # écart moyen de valeur toléré, sur 255
ZONE_SUSPECTE = 34.0 # écart d'une zone au-delà duquel elle a changé

HAUTEURS = ('en haut', 'au deuxième quart', 'au troisième quart', 'en bas')
LARGEURS = ('à gauche', 'au centre gauche', 'au centre droit', 'à droite')


@dataclass
class Ecart:
    correlation: float
    moyen: float
    zones: np.ndarray

    @property
    def pire(self) -> tuple[float, str]:
        index = int(np.argmax(self.zones))
        ligne, colonne = divmod(index, self.zones.shape[1])
        return float(self.zones[ligne, colonne]), f'{HAUTEURS[ligne]} {LARGEURS[colonne]}'

    @property
    def tenue(self) -> bool:
        return (self.correlation >= CORRELATION and self.moyen <= ECART
                and self.pire[0] <= ZONE_SUSPECTE)


def _gris(chemin: Path, cote: int) -> np.ndarray:
    return np.asarray(Image.open(chemin).convert('L').resize((cote, cote), Image.BOX),
                      dtype=np.float64)


def decalage(a: np.ndarray, b: np.ndarray) -> tuple[int, int]:
    """Décalage de `b` par rapport à `a`, par corrélation de phase.

    Une reprise est rarement cadrée au pixel près. On ne rattrape que la
    translation entière : une planche refaite n'est pas tournée, et corriger une
    rotation qui n'existe pas fabriquerait des différences.
    """
    fa, fb = np.fft.fft2(a), np.fft.fft2(b)
    croise = fa * np.conj(fb)
    module = np.abs(croise)
    module[module == 0] = 1
    pic = np.fft.ifft2(croise / module).real
    y, x = np.unravel_index(int(np.argmax(pic)), pic.shape)
    return (y - a.shape[0] if y > a.shape[0] // 2 else y,
            x - a.shape[1] if x > a.shape[1] // 2 else x)


def masses(image: np.ndarray, grille: int = GRILLE) -> np.ndarray:
    """Moyennes de valeur par tuile : la composition, débarrassée de la texture."""
    cote = image.shape[0] // grille * grille
    return image[:cote, :cote].reshape(grille, cote // grille, grille, cote // grille).mean(axis=(1, 3))


def correlation(a: np.ndarray, b: np.ndarray) -> float:
    """Corrélation de deux grilles de masses, centrées réduites."""
    x, y = a.ravel() - a.mean(), b.ravel() - b.mean()
    denominateur = np.sqrt((x * x).sum() * (y * y).sum())
    return float((x * y).sum() / denominateur) if denominateur else 0.0


def zones(a: np.ndarray, b: np.ndarray, zones_par_cote: int = ZONES) -> np.ndarray:
    """Écart moyen par zone nommable, agrégé depuis la grille de masses."""
    pas = a.shape[0] // zones_par_cote
    difference = np.abs(a - b)
    return np.array([[difference[l * pas:(l + 1) * pas, c * pas:(c + 1) * pas].mean()
                      for c in range(zones_par_cote)] for l in range(zones_par_cote)])


def comparer(ancienne: Path, nouvelle: Path) -> Ecart:
    avant, apres = _gris(ancienne, CADRAGE), _gris(nouvelle, CADRAGE)
    dy, dx = decalage(avant, apres)
    apres = np.roll(apres, (dy, dx), axis=(0, 1))

    a, b = masses(avant), masses(apres)
    return Ecart(correlation=correlation(a, b), moyen=float(np.abs(a - b).mean()),
                 zones=zones(a, b))


def rapporter(nom: str, ecart: Ecart) -> bool:
    pire, ou = ecart.pire
    print(f'\n{nom} — composition {ecart.correlation:.3f}, écart moyen {ecart.moyen:.1f}, '
          f'zone la plus divergente {pire:.1f} ({ou})')
    if ecart.tenue:
        print('  ✓ La planche refaite raconte la même chose.')
    else:
        print(f'  ✗ Quelque chose a changé {ou}. Regarder les deux côte à côte avant '
              'de remplacer — une dérive peut être un progrès, mais elle se décide.')
    for ligne in ecart.zones:
        print('    ' + ' '.join(f'{v:5.1f}' for v in ligne))
    return ecart.tenue


def main() -> int:
    analyse = argparse.ArgumentParser(
        description='Compare des planches refaites à celles qu’elles remplacent, '
                    'et dit où la composition a dérivé.')
    analyse.add_argument('--avant', required=True, type=Path, help='Planche ou dossier d’origine.')
    analyse.add_argument('--apres', required=True, type=Path, help='Planche ou dossier refait.')
    arguments = analyse.parse_args()

    if arguments.avant.is_file():
        paires = [(arguments.avant.name, arguments.avant, arguments.apres)]
    else:
        # L'appariement se fait sur le nom sans extension : une reprise sort
        # souvent en PNG là où l'originale était en WebP.
        apres = {f.stem: f for f in arguments.apres.iterdir()}
        origines = sorted(f for f in arguments.avant.iterdir() if f.is_file())
        paires = [(f.stem, f, apres[f.stem]) for f in origines if f.stem in apres]
        orphelines = [f.stem for f in origines if f.stem not in apres]
        if orphelines:
            print(f'Sans reprise : {", ".join(orphelines)}')

    if not paires:
        print('Aucune paire à comparer.', file=sys.stderr)
        return 2

    derives = [nom for nom, avant, apres in paires if not rapporter(nom, comparer(avant, apres))]
    print(f'\n--- {len(paires) - len(derives)}/{len(paires)} planches tiennent leur composition ---')
    for nom in derives:
        print(f'    à regarder côte à côte : {nom}')
    return 1 if derives else 0


if __name__ == '__main__':
    raise SystemExit(main())
