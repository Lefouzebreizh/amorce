#!/usr/bin/env python3
"""Étape 2 — corriger les quatre coquilles sans toucher au reste de la planche.

Le texte est pixellisé dans l'illustration. Le réécrire dans une police du
commerce se verrait : la calligraphie des bulles n'est pas une fonte
identifiable, c'est un rendu propre au générateur. On opère donc **au glyphe**,
avec de la matière prélevée sur la planche elle-même :

- une lettre juste existe déjà ailleurs dans la même bulle → on la recopie ;
- un `m` est un `n` avec une arche de plus → on duplique l'arche ;
- un tréma parasite s'efface, il ne se remplace pas ;
- un mot en double se supprime, et la ligne se recentre.

Aucune fonte extérieure n'entre dans une bulle. Le corps, la graisse, le grain
et la résolution restent ceux du reste de la phrase.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import charte  # noqa: E402

Boite = tuple[int, int, int, int]


def teinte_du_fond(image: Image.Image, boite: Boite, marge: int = 10) -> tuple[int, int, int]:
    """Couleur du papier de la bulle, mesurée autour de la zone à reboucher.

    On ne garde que les pixels clairs : l'encre du texte voisin ne doit pas
    tirer la teinte vers le gris. La médiane plutôt que la moyenne, pour la même
    raison — un jambage qui traîne ne doit pas peser.
    """
    x0, y0, x1, y1 = boite
    cadre = image.crop((max(0, x0 - marge), max(0, y0 - marge),
                        min(image.width, x1 + marge), min(image.height, y1 + marge)))
    a = np.asarray(cadre.convert("RGB")).reshape(-1, 3)
    clairs = a[a.mean(axis=1) > 170]
    if len(clairs) < 20:
        clairs = a
    return tuple(int(v) for v in np.median(clairs, axis=0))


def effacer(image: Image.Image, boite: Boite) -> None:
    """Recouvre une boîte par un aplat de la teinte du papier de la bulle.

    Un rebouchage par échantillon de texture semblait plus fin ; il rapportait
    en réalité des morceaux de la ligne du dessus et laissait une couture
    verticale pointillée. Le papier d'une bulle est uni : l'aplat est invisible.
    """
    image.paste(teinte_du_fond(image, boite), boite)


def deplacer(image: Image.Image, boite: Boite, dx: int) -> None:
    """Déplace horizontalement un bloc, et rebouche la place qu'il libère."""
    morceau = image.crop(boite)
    effacer(image, boite)
    image.paste(morceau, (boite[0] + dx, boite[1]))


def dupliquer(image: Image.Image, source: Boite, x_cible: int) -> None:
    """Recopie un morceau de dessin à une autre abscisse, même ligne."""
    image.paste(image.crop(source), (x_cible, source[1]))


@dataclass
class Correction:
    page: int
    faute: str
    juste: str
    methode: str
    operations: list[tuple]


# --- Les corrections, en coordonnées des planches d'origine -------------------
#
# Chaque abscisse vient d'une carte d'encre relevée au pixel (voir reperer.py).
# Deux pièges ont coûté un essai chacun, ils expliquent la forme des bandes :
#
#  - en italique, le point du « i » penche à DROITE de sa hampe : une boîte
#    calée sur la lettre suivante l'emporte ;
#  - une bande verticale trop haute emmène les jambages de la ligne du dessus,
#    trop basse emmène les hampes de la ligne du dessous. Les bornes sont donc
#    prises dans la gouttière d'encre, pas au jugé.

CORRECTIONS: list[Correction] = [
    Correction(
        page=4, faute="doucenent", juste="doucement",
        methode="arche du n dupliquée pour former un m",
        operations=[
            # « douce|n|ent. » : le n va de 1362 à 1376, son arche de 1369 à 1376.
            ("deplacer",  (1377, 1176, 1424, 1212), 7),
            ("dupliquer", (1369, 1176, 1377, 1212), 1376),
        ],
    ),
    Correction(
        page=4, faute="intériour", juste="intérieur",
        methode="o remplacé par le e de « avec », même ligne",
        operations=[
            ("prelever", (1645, 1113, 1658, 1157), "e"),
            ("effacer",  (1571, 1113, 1587, 1157)),
            ("deplacer", (1587, 1113, 1850, 1157), -3),
            ("coller",   "e", (1571, 1113)),
        ],
    ),
    Correction(
        page=16, faute="la la", juste="la",
        methode="mot en double supprimé, ligne recentrée",
        operations=[
            ("effacer",  (366, 213, 391, 237)),
            ("deplacer", (258, 213, 366, 237), 10),
            ("deplacer", (360, 237, 367, 241), 10),   # queue de la virgule
        ],
    ),
]

# NOTE — « lëttres » (page 14) figurait dans le rapport de relecture comme une
# quatrième coquille. Vérification faite sur la carte d'encre : il n'y a pas de
# tréma. Ce que la basse résolution donnait à voir est la barre partagée du
# double « t » surmontée de ses deux hampes. Le mot est correct, aucune
# intervention. L'erreur était dans la relecture, pas dans la planche.


def appliquer(image: Image.Image, correction: Correction) -> None:
    presse_papier: dict[str, Image.Image] = {}
    for operation in correction.operations:
        verbe = operation[0]
        if verbe == "effacer":
            effacer(image, operation[1])
        elif verbe == "deplacer":
            deplacer(image, operation[1], operation[2])
        elif verbe == "dupliquer":
            dupliquer(image, operation[1], operation[2])
        elif verbe == "prelever":
            presse_papier[operation[2]] = image.crop(operation[1])
        elif verbe == "coller":
            image.paste(presse_papier[operation[1]], operation[2])
        else:
            raise ValueError(f"opération inconnue : {verbe}")


if __name__ == "__main__":
    import argparse
    import shutil

    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--source", required=True)
    a.add_argument("--vers", required=True)
    args = a.parse_args()

    source, vers = Path(args.source), Path(args.vers)
    vers.mkdir(parents=True, exist_ok=True)

    par_page: dict[int, list[Correction]] = {}
    for c in CORRECTIONS:
        par_page.setdefault(c.page, []).append(c)

    for fichier in sorted(source.iterdir()):
        if fichier.suffix.lower() not in (".webp", ".jpg", ".jpeg", ".png"):
            continue
        page = next((p for p in charte.TOME_1
                     if charte.nom_de_page(p.numero, p.slug, "") == fichier.stem), None)
        numero = page.numero if page else None
        if numero not in par_page:
            shutil.copy2(fichier, vers / fichier.name)
            continue
        with Image.open(fichier) as brut:
            image = brut.convert("RGB")
        for c in par_page[numero]:
            appliquer(image, c)
            print(f"  page {numero:02d}  « {c.faute} » -> « {c.juste} »  ({c.methode})")
        image.save(vers / f"{fichier.stem}.png", compress_level=6)

    print(f"\n{len(CORRECTIONS)} correction(s) appliquée(s), planches écrites dans {vers}")
