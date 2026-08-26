#!/usr/bin/env python3
"""Contrôle de lisibilité d'une couverture réduite à la taille d'une vignette.

Sur la boutique Amazon, personne ne voit la couverture. On voit une vignette de
la largeur d'un pouce, au milieu de vingt autres. Un album illustré y perd
d'abord ses personnages : les traits fusionnent, le sujet se fond dans le décor,
et il ne reste qu'une tache colorée. C'est invisible sur l'écran où la
couverture a été dessinée, et irrattrapable une fois le livre en vente.

Ce script fabrique donc la vignette et la juge — sur des mesures, pas sur une
impression. Deux familles de contrôles, à ne pas confondre :

**Les règles de KDP** (résolution, mode colorimétrique) sont des refus de dépôt.
Elles ne se discutent pas.

Une mesure a été essayée puis retirée : la variance du laplacien, censée dire ce
qui reste de trait après réduction. Elle récompense le grain — une couverture
tramée, sans le moindre contraste, la passait mieux qu'une couverture franche.
Un contrôle qui ne peut pas échouer là où l'œil échoue n'en est pas un.

**Les seuils de lisibilité** sont les nôtres. Ils traduisent en nombres ce que
l'œil constate à 150 pixels, et ils sont *provisoires* : ils ont été posés sur
des images d'essai, pas sur une bibliothèque de couvertures réelles. Quand un
contrôle échoue sur une couverture que l'œil trouve pourtant claire, c'est le
seuil qu'il faut corriger ici — et noter pourquoi. Un rapport qui finit toujours
en vert ne sert à rien, mais un rapport qui crie au loup non plus.

La vignette est écrite à côté du rapport : les chiffres disent où regarder,
l'œil tranche.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageStat

LARGEUR_VIGNETTE = 150       # la largeur d'affichage d'une couverture en liste
COTE_MINIMUM_KDP = 1000      # plus petit côté long accepté par KDP

# Seuils de lisibilité, sur la vignette et non sur la source.
CONTRASTE_GLOBAL = 40.0      # écart-type de la luminance (0-255)
CONTRASTE_SUJET = 40.0       # écart de valeur entre le sujet et ce qui l'entoure
MASSES_MINIMUM = 3           # aplats distincts après quantification

# Zone du sujet par défaut : le centre, là où se place un personnage sur une
# couverture d'album. Réglable, parce qu'un personnage décentré est fréquent.
SUJET_DEFAUT = (0.20, 0.15, 0.60, 0.70)


@dataclass
class Controle:
    intitule: str
    passe: bool
    mesure: str
    conseil: str = ''


def _o(intitule, mesure): return Controle(intitule, True, mesure)
def _n(intitule, mesure, conseil): return Controle(intitule, False, mesure, conseil)


def ouvrir(chemin: Path, page: int = 0) -> Image.Image:
    """Ouvre une image, ou rend la page demandée d'un PDF.

    La chaîne de ce dépôt produit des PDF : exiger une image obligerait à
    exporter à la main la couverture qu'on vient d'assembler, et c'est
    exactement le moment où l'on oublie de refaire le contrôle.
    """
    if chemin.suffix.lower() != '.pdf':
        return Image.open(chemin)

    import fitz

    document = fitz.open(chemin)
    # 300 dpi : on juge la vignette, mais les mesures de détail se font sur une
    # réduction depuis une source fine, comme le fera la boutique.
    rendu = document[page].get_pixmap(dpi=300)
    return Image.frombytes('RGB', (rendu.width, rendu.height), rendu.samples)


def vignetter(couverture: Image.Image, largeur: int = LARGEUR_VIGNETTE) -> Image.Image:
    """Réduit la couverture à la largeur d'une vignette, en conservant le rapport.

    `LANCZOS` et non un rééchantillonnage rapide : une réduction grossière ajoute
    du crénelage qui se lit comme du détail, et flatterait la mesure de netteté.
    """
    hauteur = max(1, round(couverture.height * largeur / couverture.width))
    return couverture.convert('RGB').resize((largeur, hauteur), Image.LANCZOS)


def _luminance(image: Image.Image) -> Image.Image:
    return image.convert('L')


def _rang(histogramme: list[int], part: float) -> float:
    """Valeur de luminance sous laquelle se trouve `part` des pixels.

    On raisonne en rangs et non en moyennes : un personnage sombre sur un ciel
    clair a beau sauter aux yeux, la moyenne de sa zone — pleine de ciel elle
    aussi — se confond avec celle du reste. C'est ce qui recalait une couverture
    parfaitement franche au premier essai.
    """
    total = sum(histogramme)
    if not total:
        return 0.0
    cible, cumul = total * part, 0
    for valeur, compte in enumerate(histogramme):
        cumul += compte
        if cumul >= cible:
            return float(valeur)
    return 255.0


def controler_source(couverture: Image.Image, chemin: Path) -> list[Controle]:
    """Les règles de KDP : ce qui fait refuser un dépôt."""
    controles = []

    cote = max(couverture.width, couverture.height)
    if cote >= COTE_MINIMUM_KDP:
        controles.append(_o('Résolution de la source', f'{couverture.width}×{couverture.height} px'))
    else:
        controles.append(_n(
            'Résolution de la source', f'{couverture.width}×{couverture.height} px',
            f'KDP demande au moins {COTE_MINIMUM_KDP} px sur le côté long. '
            'Réexportez depuis la source, ne rééchantillonnez pas vers le haut.'))

    if chemin.suffix.lower() == '.pdf' or couverture.mode in ('RGB', 'RGBA', 'L', 'P'):
        controles.append(_o('Mode colorimétrique', couverture.mode))
    else:
        controles.append(_n(
            'Mode colorimétrique', couverture.mode,
            'KDP attend du RVB. Une couverture en CMJN ressort avec des couleurs '
            'ternes, sans message d’erreur.'))
    return controles


def controler_lisibilite(vignette: Image.Image, sujet=SUJET_DEFAUT) -> list[Controle]:
    """Les seuils de lisibilité, mesurés sur la vignette."""
    gris = _luminance(vignette)
    controles = []

    contraste = ImageStat.Stat(gris).stddev[0]
    if contraste >= CONTRASTE_GLOBAL:
        controles.append(_o('Contraste global', f'{contraste:.0f} (seuil {CONTRASTE_GLOBAL:.0f})'))
    else:
        controles.append(_n(
            'Contraste global', f'{contraste:.0f} (seuil {CONTRASTE_GLOBAL:.0f})',
            'La vignette s’écrase en une bouillie de valeurs proches. Assombrissez '
            'le fond ou éclaircissez le sujet — un aplat franc vaut mieux qu’un dégradé.'))

    # Le sujet contre ce qui l'entoure : un personnage qui se détache à 150 px,
    # c'est d'abord un écart de valeur, pas un écart de couleur. On compare donc
    # ses extrêmes — ce qu'il a de plus sombre et de plus clair — à la valeur
    # médiane de ce qui l'entoure, et on retient le plus grand des deux écarts :
    # un personnage clair sur fond sombre se détache aussi bien que l'inverse.
    largeur, hauteur = gris.size
    x, y, l, h = sujet
    boite = (int(x * largeur), int(y * hauteur), int((x + l) * largeur), int((y + h) * hauteur))
    dans_le_sujet = gris.crop(boite).histogram()
    entourage = [t - d for t, d in zip(gris.histogram(), dans_le_sujet)]
    mediane = _rang(entourage, 0.5)
    ecart = max(abs(_rang(dans_le_sujet, 0.10) - mediane),
                abs(_rang(dans_le_sujet, 0.90) - mediane))
    if ecart >= CONTRASTE_SUJET:
        controles.append(_o('Détachement du sujet', f'{ecart:.0f} (seuil {CONTRASTE_SUJET:.0f})'))
    else:
        controles.append(_n(
            'Détachement du sujet', f'{ecart:.0f} (seuil {CONTRASTE_SUJET:.0f})',
            'Le personnage a la même valeur que son décor : à cette taille il '
            'disparaît. Cernez-le, posez-le sur un fond plus sombre ou plus clair, '
            'ou agrandissez-le. Si le personnage n’est pas au centre, indiquez sa '
            'zone avec --sujet.'))

    # Nombre d'aplats qui pèsent vraiment : une couverture lisible en vignette se
    # résume à quelques masses. Deux masses, c'est une tache ; quinze, une purée.
    quantifiee = vignette.quantize(colors=16)
    total = vignette.width * vignette.height
    masses = sum(1 for compte in quantifiee.getcolors() or [] if compte[0] >= total * 0.03)
    if masses >= MASSES_MINIMUM:
        controles.append(_o('Masses distinctes', f'{masses} (seuil {MASSES_MINIMUM})'))
    else:
        controles.append(_n(
            'Masses distinctes', f'{masses} (seuil {MASSES_MINIMUM})',
            'La vignette se résume à trop peu de zones : elle sera confondue avec '
            'ses voisines dans une liste. Ajoutez un contraste de couleur franc '
            'entre le personnage, le décor et le ciel.'))
    return controles


def rapporter(controles: list[Controle], vignette: Path | None) -> bool:
    for controle in controles:
        marque = '✓' if controle.passe else '✗'
        print(f'{marque} {controle.intitule} — {controle.mesure}')
        if controle.conseil:
            print(f'   {controle.conseil}')
    if vignette:
        print(f'\nVignette écrite dans {vignette} — regardez-la, les chiffres ne '
              'disent pas tout.')
    return all(controle.passe for controle in controles)


def main() -> int:
    analyse = argparse.ArgumentParser(
        description='Réduit une couverture à la taille d’une vignette et contrôle '
                    'qu’on y distingue encore quelque chose.')
    analyse.add_argument('--source', required=True, type=Path,
                         help='Image ou PDF de la couverture de face.')
    analyse.add_argument('--vers', type=Path, help='Où écrire la vignette (PNG).')
    analyse.add_argument('--largeur', type=int, default=LARGEUR_VIGNETTE,
                         help=f'Largeur de la vignette (défaut {LARGEUR_VIGNETTE}).')
    analyse.add_argument('--page', type=int, default=0,
                         help='Page à rendre si la source est un PDF (défaut 0).')
    analyse.add_argument('--sujet', default=None,
                         help='Zone du personnage en fractions x,y,largeur,hauteur '
                              '(défaut 0.20,0.15,0.60,0.70).')
    arguments = analyse.parse_args()

    if not arguments.source.exists():
        print(f'Source introuvable : {arguments.source}', file=sys.stderr)
        return 2

    sujet = SUJET_DEFAUT
    if arguments.sujet:
        try:
            sujet = tuple(float(part) for part in arguments.sujet.split(','))
            if len(sujet) != 4:
                raise ValueError
        except ValueError:
            print('--sujet attend quatre fractions, par exemple 0.1,0.2,0.5,0.6',
                  file=sys.stderr)
            return 2

    couverture = ouvrir(arguments.source, arguments.page)
    vignette = vignetter(couverture, arguments.largeur)

    destination = arguments.vers
    if destination:
        destination.parent.mkdir(parents=True, exist_ok=True)
        vignette.save(destination)

    controles = (controler_source(couverture, arguments.source)
                 + controler_lisibilite(vignette, sujet))
    print(f'Couverture : {arguments.source}')
    print(f'Vignette   : {vignette.width}×{vignette.height} px\n')
    return 0 if rapporter(controles, destination) else 1


if __name__ == '__main__':
    raise SystemExit(main())
