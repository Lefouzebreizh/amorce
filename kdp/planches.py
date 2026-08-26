#!/usr/bin/env python3
"""Contrôle des planches sources, avant qu'elles n'entrent dans le volume.

`valider.py` juge les PDF finaux : il dit non quand tout est déjà assemblé.
Ce script-ci juge les planches telles qu'elles sortent du générateur, au moment
où il est encore temps d'en refaire une.

Il mesure trois choses qu'aucun œil ne juge de façon fiable sur un écran :

**La résolution effective.** Une planche n'a pas de DPI en soi : elle en a un
une fois posée sur un gabarit. Une image de 1600 px sur une page de 8,625
pouces, c'est 186 DPI — la chaîne en vise 300, et `valider.py` recalera le
volume entier pour cela. Autant le savoir avant.

**La taille du texte des bulles.** On mesure la **hauteur d'œil** — la hauteur
d'un `x`, celle qui fait qu'un texte se lit ou non —, en millimètres sur la page
imprimée. Deux mesures plus simples ont été essayées et jetées : la hauteur des
bandes d'encre par ligne, qui compte deux lignes pour une dès qu'un jambage
touche l'accent du dessous et se trompait d'un facteur deux ; et la périodicité
du profil d'encre, qui retombait sur sa borne minimale sur des bulles de trois
lignes. La médiane des hauteurs de lettres, elle, s'appuie sur des centaines de
mesures par planche et classe les planches dans le bon ordre.

**L'épaisseur du trait et la netteté des glyphes.** Le texte des bulles est dessiné par le générateur,
pas composé — c'est une décision de ce dépôt, expliquée dans `coquilles.py`, et
elle a une conséquence : la finesse du trait dépend de la planche et varie d'une
image à l'autre. On compte donc les pixels à mi-chemin entre l'encre et le
papier : là où ils débordent, le texte est déjà mou, et un agrandissement le
rendra franchement flou.

Ce qu'il ne mesure pas, et qu'il ne faut pas lui demander : si le texte est
juste (voir `coquilles.py`), si le dessin est beau, si la planche raconte
quelque chose.

Les seuils de lisibilité sont les nôtres, posés sur les vingt planches du
tome 1 ; ils se recalibrent ici, avec la raison écrite à côté.
"""

from __future__ import annotations

import argparse
import sys
from collections import deque
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import charte  # noqa: E402

# Détection des bulles.
REDUCTION = 8              # un bloc de 8 px : plus fin ne change rien, plus gros perd les petites bulles
PAPIER = 238               # luminance du papier d'une bulle, mesurée au maximum du bloc
ENCRE = 110                # en deçà, c'est de l'encre
BORD = 0.07                # bordure végétale de la charte, exclue de la recherche
AIRE = (0.003, 0.12)       # part de la planche : en deçà un reflet, au-delà le cadre
COEUR_PLEIN = 0.70         # une bulle est pleine en son centre ; un cadre y est vide
PART_ENCRE = (0.03, 0.45)  # un aplat clair sans encre n'est pas une bulle
LETTRE_MIN = (8, 4)        # aire et hauteur en deçà desquelles c'est une poussière

# Seuils de lisibilité, sur la page imprimée. La hauteur d'œil vaut environ la
# moitié du corps : 2,0 mm correspond donc à un corps 11, et 1,6 mm à un corps 9.
OEIL_CONFORTABLE_MM = 2.0    # ce qu'un lecteur de huit ans lit sans s'approcher
OEIL_MINIMUM_MM = 1.6        # en deçà, la bulle demande un effort
TRAIT_MINIMUM_MM = 0.12      # un trait plus fin se casse à l'impression à la demande
FLOU_MAXIMUM = 1.2           # pixels intermédiaires par pixel d'encre


@dataclass
class Controle:
    intitule: str
    passe: bool
    mesure: str
    conseil: str = ''


@dataclass
class Mesures:
    largeur: int
    hauteur: int
    mode: str
    bulles: int
    lettres: int
    oeil_px: float
    oeil_mm: float
    trait_mm: float
    flou: float


def _blocs_max(a: np.ndarray, r: int) -> np.ndarray:
    """Maximum par bloc de `r` pixels.

    Une réduction par moyenne mélangerait l'encre au papier et ferait tomber une
    bulle sous le seuil du clair — c'est ce qui n'en repérait aucune au premier
    essai. Le maximum garde le papier tel quel.
    """
    h, w = (a.shape[0] // r) * r, (a.shape[1] // r) * r
    return a[:h, :w].reshape(h // r, r, w // r, r).max(axis=(1, 3))


def _composantes(masque: np.ndarray):
    """Régions 4-connexes du masque réduit."""
    h, w = masque.shape
    vu = np.zeros_like(masque, dtype=bool)
    for y in range(h):
        for x in range(w):
            if not masque[y, x] or vu[y, x]:
                continue
            file, region = deque([(y, x)]), []
            vu[y, x] = True
            while file:
                cy, cx = file.popleft()
                region.append((cy, cx))
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < h and 0 <= nx < w and masque[ny, nx] and not vu[ny, nx]:
                        vu[ny, nx] = True
                        file.append((ny, nx))
            yield region


def _coeur_plein(region: list[tuple[int, int]], boite: tuple[int, int, int, int]) -> float:
    """Part du cœur de la boîte que la région couvre effectivement.

    Le remplissage de la boîte entière ne suffisait pas : une bulle **à queue**
    — l'appendice qui pointe vers celui qui parle — tombe à 0,53, sous le même
    seuil qu'un cadre végétal. Le cœur les sépare franchement : une bulle y est
    pleine, un cadre y est vide par construction.
    """
    y0, y1, x0, x1 = boite
    hauteur, largeur = y1 - y0 + 1, x1 - x0 + 1
    masque = np.zeros((hauteur, largeur), dtype=bool)
    for y, x in region:
        masque[y - y0, x - x0] = True
    coeur = masque[hauteur // 4:3 * hauteur // 4 + 1, largeur // 4:3 * largeur // 4 + 1]
    return float(coeur.mean()) if coeur.size else 0.0


def bulles(gris: np.ndarray) -> list[np.ndarray]:
    """Les bulles de dialogue : des aplats clairs, pleins, et qui portent de l'encre.

    Les deux derniers critères font tout le travail. Un ciel d'hiver, une plage
    de neige et le papier de la bordure sont aussi clairs qu'une bulle ; ce qui
    distingue une bulle, c'est qu'elle est pleine en son centre et qu'on a écrit
    dedans.
    """
    petit = _blocs_max(gris, REDUCTION) > PAPIER
    bord = int(BORD * petit.shape[0])
    petit[:bord] = petit[-bord:] = False
    petit[:, :bord] = petit[:, -bord:] = False

    trouvees = []
    for region in _composantes(petit):
        if not (AIRE[0] * petit.size <= len(region) <= AIRE[1] * petit.size):
            continue
        ys, xs = zip(*region)
        y0, y1, x0, x1 = min(ys), max(ys), min(xs), max(xs)
        if _coeur_plein(region, (y0, y1, x0, x1)) < COEUR_PLEIN:
            continue
        bloc = gris[y0 * REDUCTION:(y1 + 1) * REDUCTION, x0 * REDUCTION:(x1 + 1) * REDUCTION]
        if not (PART_ENCRE[0] <= (bloc < ENCRE).mean() <= PART_ENCRE[1]):
            continue
        trouvees.append(bloc)
    return trouvees


def hauteurs_de_lettres(encre: np.ndarray) -> list[int]:
    """Hauteurs des taches d'encre d'une bulle : ses lettres.

    Écarte ce qui n'est pas une lettre par deux bouts : les poussières de
    compression en dessous, et le contour de la bulle au-dessus — un trait qui
    traverse la moitié de la bulle n'est pas un glyphe.
    """
    h, w = encre.shape
    vu = np.zeros_like(encre, dtype=bool)
    hauteurs = []
    for y in range(h):
        for x in range(w):
            if not encre[y, x] or vu[y, x]:
                continue
            file = deque([(y, x)])
            vu[y, x] = True
            y0 = y1 = y
            x0 = x1 = x
            aire = 0
            while file:
                cy, cx = file.popleft()
                aire += 1
                y0, y1, x0, x1 = min(y0, cy), max(y1, cy), min(x0, cx), max(x1, cx)
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < h and 0 <= nx < w and encre[ny, nx] and not vu[ny, nx]:
                        vu[ny, nx] = True
                        file.append((ny, nx))
            haut, large = y1 - y0 + 1, x1 - x0 + 1
            if aire < LETTRE_MIN[0] or haut < LETTRE_MIN[1]:
                continue
            if large > 0.6 * w or haut > 0.5 * h:
                continue
            hauteurs.append(haut)
    return hauteurs


def epaisseur_du_trait(encre: np.ndarray) -> float:
    """Longueur médiane d'une course d'encre sur une ligne de pixels.

    C'est le trait de plume, et c'est ce qui décide de la survie du texte à
    l'impression : sous un dixième de millimètre, une presse à la demande le
    casse par endroits. Les courses longues sont écartées, ce sont des aplats.
    """
    courses = []
    for ligne in encre:
        course = 0
        for pixel in ligne:
            if pixel:
                course += 1
            elif course:
                if course <= 12:
                    courses.append(course)
                course = 0
    return float(np.median(courses)) if courses else 0.0


def millimetres(pixels: float, largeur_planche: int, gabarit: charte.Gabarit) -> float:
    """Convertit une hauteur en pixels en millimètres sur la page imprimée."""
    return pixels * gabarit.largeur * 25.4 / largeur_planche


def mesurer(chemin: Path, gabarit: charte.Gabarit) -> Mesures:
    image = Image.open(chemin)
    gris = np.asarray(image.convert('L')).astype(np.int16)

    hauteurs, traits, flous = [], [], []
    trouvees = bulles(gris)
    for bulle in trouvees:
        encre = bulle < ENCRE
        hauteurs += hauteurs_de_lettres(encre)
        traits.append(epaisseur_du_trait(encre))
        if encre.sum():
            flous.append(float(((bulle >= ENCRE) & (bulle <= 200)).sum() / encre.sum()))

    oeil = float(np.median(hauteurs)) if hauteurs else 0.0
    trait = float(np.median(traits)) if traits else 0.0
    return Mesures(
        largeur=image.width, hauteur=image.height, mode=image.mode,
        bulles=len(trouvees), lettres=len(hauteurs), oeil_px=oeil,
        oeil_mm=millimetres(oeil, image.width, gabarit) if oeil else 0.0,
        trait_mm=millimetres(trait, image.width, gabarit) if trait else 0.0,
        flou=float(np.median(flous)) if flous else 0.0,
    )


def controler(m: Mesures, gabarit: charte.Gabarit) -> list[Controle]:
    controles = []

    dpi = m.largeur / gabarit.largeur
    if dpi >= charte.DPI_CIBLE - 1:
        controles.append(Controle('Résolution', True, f'{m.largeur} px → {dpi:.0f} DPI'))
    else:
        vise = round(gabarit.largeur * charte.DPI_CIBLE)
        controles.append(Controle(
            'Résolution', False, f'{m.largeur} px → {dpi:.0f} DPI (il en faut {charte.DPI_CIBLE})',
            f'Régénérer la planche en {vise} px de côté. Un agrandissement '
            f'n’ajoute aucun détail : il étire celui qui manque.'))

    if not m.lettres:
        controles.append(Controle(
            'Texte des bulles', True, 'aucune bulle repérée',
            'Planche sans dialogue, ou bulles non détectées — à vérifier à l’œil '
            'si cette planche en comporte.'))
        return controles

    corps = m.oeil_mm * 2 * 2.835      # hauteur d'œil ≈ moitié du corps
    if m.oeil_mm >= OEIL_CONFORTABLE_MM:
        controles.append(Controle('Hauteur d’œil', True,
                                  f'{m.oeil_mm:.2f} mm (~corps {corps:.0f})'))
    else:
        controles.append(Controle(
            'Hauteur d’œil', m.oeil_mm >= OEIL_MINIMUM_MM,
            f'{m.oeil_mm:.2f} mm (~corps {corps:.0f}), confort à {OEIL_CONFORTABLE_MM} mm',
            'Moins de texte dans la bulle, ou une bulle plus grande. Un lecteur de '
            'huit ans abandonne une phrase qu’il doit approcher de son nez.'))

    if m.trait_mm >= TRAIT_MINIMUM_MM:
        controles.append(Controle('Épaisseur du trait', True, f'{m.trait_mm:.3f} mm'))
    else:
        controles.append(Controle(
            'Épaisseur du trait', False,
            f'{m.trait_mm:.3f} mm (minimum {TRAIT_MINIMUM_MM} mm)',
            'Une presse à la demande casse un trait plus fin : le texte sortira '
            'grêlé par endroits.'))

    if m.flou <= FLOU_MAXIMUM:
        controles.append(Controle('Netteté des glyphes', True, f'{m.flou:.2f}'))
    else:
        controles.append(Controle(
            'Netteté des glyphes', False, f'{m.flou:.2f} (au-delà de {FLOU_MAXIMUM}, le trait est mou)',
            'Le texte est déjà flou à cette taille, l’agrandissement le rendra '
            'illisible. Cette planche est à refaire, pas à retoucher.'))
    return controles


def rapporter(nom: str, m: Mesures, controles: list[Controle]) -> bool:
    print(f'\n{nom} — {m.largeur}×{m.hauteur} {m.mode}, '
          f'{m.bulles} bulles, {m.lettres} lettres mesurées')
    for c in controles:
        print(f'  {"✓" if c.passe else "✗"} {c.intitule} — {c.mesure}')
        if c.conseil:
            print(f'      {c.conseil}')
    return all(c.passe for c in controles)


def main() -> int:
    analyse = argparse.ArgumentParser(
        description='Contrôle les planches sources avant assemblage : résolution '
                    'effective, taille et netteté du texte des bulles.')
    analyse.add_argument('sources', nargs='+', type=Path,
                         help='Planches, ou dossiers de planches.')
    analyse.add_argument('--couverture', action='store_true',
                         help='Juger sur le gabarit de couverture plutôt que sur l’intérieur.')
    arguments = analyse.parse_args()

    gabarit = charte.GABARIT_INTERIEUR
    if arguments.couverture:
        gabarit, _ = charte.gabarit_couverture(charte.PAGES_MINIMUM_KDP)

    fichiers: list[Path] = []
    for source in arguments.sources:
        if source.is_dir():
            fichiers += sorted(f for f in source.iterdir()
                               if f.suffix.lower() in ('.webp', '.png', '.jpg', '.jpeg'))
        else:
            fichiers.append(source)
    if not fichiers:
        print('Aucune planche à contrôler.', file=sys.stderr)
        return 2

    print(f'Gabarit : {gabarit.largeur}×{gabarit.hauteur} pouces, '
          f'{charte.DPI_CIBLE} DPI → {round(gabarit.largeur * charte.DPI_CIBLE)} px de côté')
    recalees = [f.name for f in fichiers
                if not rapporter(f.name, (m := mesurer(f, gabarit)), controler(m, gabarit))]

    print(f'\n--- {len(fichiers) - len(recalees)}/{len(fichiers)} planches passent ---')
    for nom in recalees:
        print(f'    à revoir : {nom}')
    return 1 if recalees else 0


if __name__ == '__main__':
    raise SystemExit(main())
