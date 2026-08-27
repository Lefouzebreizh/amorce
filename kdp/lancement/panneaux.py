#!/usr/bin/env python3
"""Découpe une planche 2 × 2 en images de réseaux sociaux.

Une histoire en quatre temps, c'est quatre publications, pas une. Un panneau
par jour pendant la semaine du compte à rebours, et la chute le quatrième
jour : les gens reviennent pour connaître la fin. À quoi s'ajoute le parchemin
seul, qui est le format qui circule le mieux — une phrase sur une image, qu'on
s'envoie entre amis.

Les gouttières ne sont pas codées en dur : sur ce gabarit, la bande qui sépare
deux panneaux est du papier nu, donc la plus claire de la planche. On la
cherche, ce qui laisse le module utilisable pour n'importe quelle histoire.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import charte  # noqa: E402
from pipeline.bordure import fond_charte  # noqa: E402
from pipeline.normaliser import couleur_du_fond  # noqa: E402

COTE = 1080          # format carré, celui que toutes les plateformes acceptent
MARGE = 0.045        # air autour du panneau, pour qu'il respire dans le fil


def _gouttiere(profil: np.ndarray, debut: float, fin: float) -> tuple[int, int]:
    """Bande la plus claire de l'intervalle : la gouttière entre deux panneaux."""
    a, b = int(len(profil) * debut), int(len(profil) * fin)
    tranche = profil[a:b]
    seuil = tranche.max() - (tranche.max() - tranche.min()) * 0.22
    clairs = [a + i for i, v in enumerate(tranche) if v >= seuil]
    if not clairs:
        return (a + b) // 2, (a + b) // 2
    groupes = [[clairs[0]]]
    for x in clairs[1:]:
        (groupes[-1].append(x) if x - groupes[-1][-1] <= 4 else groupes.append([x]))
    plus_large = max(groupes, key=len)
    return plus_large[0], plus_large[-1]


def _bords(profil: np.ndarray) -> tuple[int, int]:
    """Premier et dernier bord de panneau, c'est-à-dire les cadres sombres extrêmes."""
    seuil = profil.mean() - profil.std()
    sombres = [i for i, v in enumerate(profil) if v < seuil]
    return (sombres[0], sombres[-1]) if sombres else (0, len(profil) - 1)


def decouper(planche: Path, vers: Path, prefixe: str) -> list[Path]:
    with Image.open(planche) as brut:
        image = brut.convert("RGB")
    gris = np.asarray(image.convert("L")).astype(float)
    papier = couleur_du_fond(image)

    colonnes, lignes = gris.mean(axis=0), gris.mean(axis=1)
    gx0, gx1 = _gouttiere(colonnes, 0.42, 0.58)
    gy0, gy1 = _gouttiere(lignes, 0.42, 0.58)
    x0, x1 = _bords(colonnes)
    y0, y1 = _bords(lignes)

    cases = {
        1: (x0, y0, gx0, gy0), 2: (gx1, y0, x1, gy0),
        3: (x0, gy1, gx0, y1), 4: (gx1, gy1, x1, y1),
    }
    vers.mkdir(parents=True, exist_ok=True)
    faits = []
    for numero, boite in cases.items():
        faits.append(_poser(image.crop(boite), papier, vers / f"{prefixe}_{numero}.jpg"))
        print(f"  panneau {numero}  {boite}  -> {faits[-1].name}")

    return faits


def carte_parchemin(phrase: str, source_bordure: Path, cible: Path,
                    cote: int = COTE) -> Path:
    """Recompose la phrase de l'âme en carte carrée, plutôt que de la découper.

    Le parchemin de la planche mesure douze fois plus large que haut. Recadré
    dans un carré, il devient un ruban illisible de soixante-dix pixels. Or
    c'est le format qui circule le mieux — une phrase qu'on s'envoie. On la
    retypographie donc, dans la police et sur le papier de la charte.
    """
    from PIL import ImageDraw, ImageFont
    polices = charte.POLICES
    carte = fond_charte(source_bordure, cote)
    dessin = ImageDraw.Draw(carte)

    # On réduit le corps jusqu'à ce que la phrase tienne en trois lignes au plus :
    # au-delà, une citation cesse de se lire d'un coup d'œil.
    largeur_utile = cote * 0.68
    for taille in range(58, 22, -2):
        police = ImageFont.truetype(str(polices / "Lora-Italic.ttf"), taille)
        lignes, courante = [], ""
        for mot in phrase.split():
            essai = (courante + " " + mot).strip()
            if police.getbbox(essai)[2] <= largeur_utile:
                courante = essai
            else:
                lignes.append(courante); courante = mot
        lignes.append(courante)
        if len(lignes) <= 4:
            break

    interligne = round(taille * 1.5)
    haut = (cote - len(lignes) * interligne) / 2
    for i, ligne in enumerate(lignes):
        dessin.text((cote / 2, haut + i * interligne + interligne / 2), ligne,
                    font=police, fill=(92, 62, 30), anchor="mm")

    signature = ImageFont.truetype(str(polices / "Lora-Regular.ttf"), 22)
    dessin.text((cote / 2, cote * 0.88), "Roussy & Zéphy", font=signature,
                fill=(150, 122, 84), anchor="mm")

    carte.save(cible, "JPEG", quality=92, optimize=True, progressive=True)
    print(f"  carte parchemin, {len(lignes)} lignes au corps {taille} -> {cible.name}")
    return cible


def _poser(morceau: Image.Image, papier, cible: Path, cote: int = COTE) -> Path:
    """Centre un morceau sur un carré de papier, sans jamais le déformer."""
    marge = round(cote * MARGE)
    dispo = cote - 2 * marge
    rapport = morceau.width / morceau.height
    if rapport >= 1:
        largeur, hauteur = dispo, round(dispo / rapport)
    else:
        hauteur, largeur = dispo, round(dispo * rapport)
    carre = Image.new("RGB", (cote, cote), papier)
    carre.paste(morceau.resize((largeur, hauteur), Image.LANCZOS),
                ((cote - largeur) // 2, (cote - hauteur) // 2))
    carre.save(cible, "JPEG", quality=90, optimize=True, progressive=True)
    return cible


if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--planche", required=True)
    a.add_argument("--vers", required=True)
    a.add_argument("--prefixe", default="panneau")
    args = a.parse_args()
    faits = decouper(Path(args.planche), Path(args.vers), args.prefixe)
    print(f"\n{len(faits)} image(s) prêtes pour le compte à rebours")
