#!/usr/bin/env python3
"""Où poser un texte sur un plan : la bande la plus calme de la zone sûre.

Un sous-titre posé à une hauteur fixe finit par tomber sur ce qu'il ne faut pas
cacher. Mesuré sur ce montage : à 42 % de la hauteur — une valeur pourtant
choisie exprès — le texte couvrait la **bouche du druide** pendant qu'il parle,
et se retrouvait **dans la gueule du dragon** sur le carton de fin. Deux fois
l'endroit précis que le spectateur regarde.

La zone sûre ne se discute pas : entre **12 et 45 %** de la hauteur, c'est
l'intersection des habillages de TikTok, Instagram et Facebook relevés sur le
terrain de référence — au-dessus, TikTok mange ; en dessous, Instagram ferme
dès 63 % et Facebook occupe la gauche. Le choix se fait donc **dans** cette
bande, jamais en dehors.

À l'intérieur, on cherche la ligne la plus **calme** : peu de détail, peu de
contraste, pas de visage. C'est là qu'un texte se lit sans rien effacer.

Le sujet se repère par son agitation locale — l'écart-type des luminances sur
une bande horizontale. Un visage, une gueule ouverte, une main : beaucoup de
détail. Un ciel, une capuche, un fond sombre : très peu. Aucun modèle, aucun
téléchargement ; c'est une mesure d'image, pas une reconnaissance.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

import numpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from monter_episode import ffmpeg

ZONE = (0.12, 0.45)   # la zone sûre, en fraction de hauteur


def agitation(image: Path, hauteur_texte: int = 110) -> list[tuple[int, float]]:
    """Rend, pour chaque hauteur candidate, l'agitation de la bande occupée."""
    from PIL import Image
    gris = numpy.asarray(Image.open(image).convert("L"), dtype=float)
    h, l = gris.shape
    # Seul le tiers central compte : le texte est centré, ce qui vit sur les
    # bords ne sera pas recouvert.
    centre = gris[:, int(l * 0.20):int(l * 0.80)]
    profil = []
    for y in range(int(h * ZONE[0]), int(h * ZONE[1]) - hauteur_texte, 10):
        bande = centre[y:y + hauteur_texte]
        # L'agitation combine le DÉTAIL (écart-type) et la LUMIÈRE (moyenne) :
        # une bande claire et unie gêne autant qu'une bande sombre et chargée,
        # parce qu'un texte clair y perd son contraste.
        profil.append((y, float(bande.std()) + float(bande.mean()) * 0.35))
    return profil


def poser(media: Path, instant: float, hauteur_texte: int = 110) -> tuple[int, float]:
    """Relève l'image à `instant` et rend la meilleure hauteur, en pixels."""
    tampon = Path(f"/tmp/_placer_{abs(hash((str(media), instant))) % 10**8}.png")
    subprocess.run([ffmpeg(), "-y", "-v", "error", "-i", str(media),
                    "-ss", f"{instant:.3f}", "-frames:v", "1", str(tampon)],
                   check=True)
    profil = agitation(tampon, hauteur_texte)
    tampon.unlink(missing_ok=True)
    if not profil:
        raise SystemExit(f"{media} : zone sûre trop courte pour {hauteur_texte} px")
    return min(profil, key=lambda x: x[1])


def principal(argv=None) -> int:
    a = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("media", type=Path)
    a.add_argument("instants", type=float, nargs="+")
    a.add_argument("--hauteur-texte", type=int, default=110)
    o = a.parse_args(argv)
    from PIL import Image
    for instant in o.instants:
        y, score = poser(o.media, instant, o.hauteur_texte)
        tampon = Path("/tmp/_p.png")
        subprocess.run([ffmpeg(), "-y", "-v", "error", "-i", str(o.media),
                        "-ss", f"{instant:.3f}", "-frames:v", "1", str(tampon)],
                       check=True)
        h = Image.open(tampon).size[1]
        print(f"  {instant:6.2f} s → y = {y:4d} px  ({y / h * 100:4.1f} %)  "
              f"agitation {score:5.1f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
