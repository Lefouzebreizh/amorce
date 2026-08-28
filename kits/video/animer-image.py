#!/usr/bin/env python3
"""Donner du mouvement apparent à une image fixe, par parallaxe et non par zoom.

Un zoom, même lent, même en diagonale, se lit toujours comme une photographie
qu'on agrandit. Mesuré sur ce dépôt : un plan tiré d'une image fixe et animé au
zoom rendait **4,1** d'écart moyen entre images consécutives, quand les vrais
rushes du même montage rendaient de 10,5 à 22,8. L'auteur disait « l'image n'est
toujours pas animée », et le chiffre lui donnait raison.

Ce qui manque à un zoom, c'est la **parallaxe** : dans un vrai plan, ce qui est
proche se déplace plus vite que ce qui est loin, et c'est cet écart — pas le
déplacement lui-même — que l'œil lit comme une caméra qui bouge. On découpe donc
l'image en profondeurs et on les déplace à des vitesses différentes.

Le découpage se fait par **masques verticaux à bords fondus**, jamais par
bandes. Une bande laisse une couture qui se voit d'autant plus que les couches
bougent différemment — le défaut saute aux yeux là où la parallaxe devait
passer inaperçue.

Deuxième source de mouvement, et souvent la meilleure : **ce qui brille**. Un
éclair, un feu, une enseigne clignotent dans la réalité. On les repère par
seuil de luminance et on module leur intensité — en multipliant les trois
canaux par le même facteur, jamais un seul. Trois tentatives précédentes ont
échoué exactement là : moduler la luminance calculée faisait virer l'image au
violet, et moduler l'image entière la faisait battre au lieu de scintiller.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys

import numpy


def ffmpeg() -> str:
    c = shutil.which("ffmpeg")
    if c:
        return c
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def lire_image(chemin, largeur, hauteur):
    """Relit l'image en RVB à la taille de travail, quel que soit son format."""
    p = subprocess.run(
        [ffmpeg(), "-v", "error", "-i", str(chemin),
         "-vf", f"scale={largeur}:{hauteur}:force_original_aspect_ratio=increase,"
                f"crop={largeur}:{hauteur}",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True)
    if not p.stdout:
        raise SystemExit(f"lecture impossible : {p.stderr.decode()[:300]}")
    return numpy.frombuffer(p.stdout, dtype=numpy.uint8).reshape(hauteur, largeur, 3).astype(numpy.float32)


def masque_vertical(hauteur, debut, fin, fondu):
    """Masque 0→1 sur la hauteur, avec des bords en cosinus.

    Le fondu est ce qui distingue une parallaxe d'un collage : sans lui, les
    deux couches se rencontrent sur une ligne droite, et cette ligne se voit.
    """
    y = numpy.arange(hauteur, dtype=numpy.float32)
    m = numpy.ones(hauteur, dtype=numpy.float32)
    m[y < debut] = 0.0
    m[y > fin] = 0.0
    if fondu > 0:
        haut = (y >= debut) & (y < debut + fondu)
        m[haut] = 0.5 - 0.5 * numpy.cos(numpy.pi * (y[haut] - debut) / fondu)
        bas = (y > fin - fondu) & (y <= fin)
        m[bas] = 0.5 + 0.5 * numpy.cos(numpy.pi * (y[bas] - (fin - fondu)) / fondu)
    return m[:, None, None]


def echantillonner(source, largeur, hauteur, echelle, dx, dy):
    """Découpe une fenêtre de la source, décalée et mise à l'échelle.

    On travaille sur une source plus grande que la sortie : c'est cette marge
    qui permet de déplacer la fenêtre sans jamais manquer de pixels.
    """
    hs, ls = source.shape[:2]
    lf, hf = int(largeur / echelle), int(hauteur / echelle)
    x0 = int((ls - lf) / 2 + dx)
    y0 = int((hs - hf) / 2 + dy)
    x0 = max(0, min(ls - lf, x0))
    y0 = max(0, min(hs - hf, y0))
    fenetre = source[y0:y0 + hf, x0:x0 + lf]
    # Rééchantillonnage par indices : suffisant ici, et sans dépendance.
    yi = (numpy.linspace(0, hf - 1, hauteur)).astype(numpy.int32)
    xi = (numpy.linspace(0, lf - 1, largeur)).astype(numpy.int32)
    return fenetre[yi][:, xi]


def tremblement(image, u, amplitude, longueur=190.0, vitesse=1.6):
    """Déplace chaque pixel de quelques unités, selon une onde lente.

    Deux couches rigides qui glissent ne font bouger que deux blocs ; un vrai
    plan fait bouger **tout**. Mesuré : la parallaxe seule plafonnait à 6,8
    d'écart entre images, contre 10,5 pour le rush le plus calme du montage.

    Ce n'est pas un effet décoratif : au-dessus d'un incendie, l'air chaud
    déplace réellement l'image, et c'est ce tremblement que l'œil attend. Le
    déplacement est vertical seulement — un décalage horizontal sur une ville
    donne une ondulation de gelée, qu'on repère aussitôt comme un traitement.
    """
    h, l = image.shape[:2]
    y = numpy.arange(h, dtype=numpy.float32)[:, None]
    x = numpy.arange(l, dtype=numpy.float32)[None, :]
    onde = numpy.sin(2 * numpy.pi * (x / longueur + y / (longueur * 2.4) + u * vitesse))
    # L'amplitude croît vers le haut : c'est là qu'est la chaleur, et le bas de
    # cadre porte des visages qu'une ondulation trahirait.
    poids = numpy.clip(1.0 - y / (h * 0.72), 0.0, 1.0)
    decalage = (onde * poids * amplitude).astype(numpy.int32)
    yi = numpy.clip(y.astype(numpy.int32) + decalage, 0, h - 1)
    xi = numpy.broadcast_to(x.astype(numpy.int32), (h, l))
    return image[yi, xi]


def construire(source_chemin, sortie, duree, largeur, hauteur, images_par_seconde,
               seuil_eclat, force_eclat, graine, tremble):
    n = int(duree * images_par_seconde)
    # La source est lue deux fois plus grande que la sortie : la marge sert au
    # déplacement des couches.
    src = lire_image(source_chemin, largeur * 2, hauteur * 2)

    # Ce qui brille : repéré une seule fois, sur la source.
    luminance = src @ numpy.array([0.2126, 0.7152, 0.0722], dtype=numpy.float32)
    eclat = numpy.clip((luminance - seuil_eclat) / max(1.0, 255.0 - seuil_eclat), 0, 1)
    eclat = eclat[:, :, None]

    rng = numpy.random.default_rng(graine)
    # Un scintillement d'éclair n'est pas une sinusoïde : quelques secousses
    # brèves sur un fond calme. On tire les instants, on lisse à peine.
    secousses = numpy.zeros(n, dtype=numpy.float32)
    for _ in range(max(2, int(duree * 2.5))):
        i = rng.integers(0, n)
        largeur_s = rng.integers(2, 6)
        secousses[max(0, i - largeur_s):i + largeur_s] += rng.uniform(0.5, 1.0)
    secousses = numpy.convolve(secousses, numpy.ones(3) / 3.0, mode="same")
    # Centré sur zéro, sans quoi le scintillement **éclaircit** en moyenne — et
    # comme il ne touche que les pixels brillants, ici orange, il fait virer
    # toute l'image au rouge. Mesuré : la composante V montait de 4 points.
    secousses = secousses - secousses.mean()

    proche = masque_vertical(hauteur, hauteur * 0.55, hauteur, hauteur * 0.16)
    lointain = 1.0 - proche

    p = subprocess.Popen(
        [ffmpeg(), "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{largeur}x{hauteur}", "-r", str(images_par_seconde), "-i", "-",
         "-c:v", "libx264", "-crf", "17", "-preset", "slow",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(sortie)],
        stdin=subprocess.PIPE)

    for k in range(n):
        u = k / max(1, n - 1)
        # Le fond dérive à peine et s'éloigne ; le premier plan va trois fois
        # plus vite et dans l'autre sens. C'est cet écart qui fait la caméra.
        # Les amplitudes ci-dessous sont en pixels **de la source**, donc
        # deux fois la sortie. Un premier réglage déplaçait de 34 pixels sur
        # deux secondes, soit trois dixièmes de pixel par image : sous le pas
        # de l'échantillonnage, donc invisible — mouvement mesuré à 2,45 contre
        # 4,14 pour le simple zoom qu'il devait remplacer.
        fond = echantillonner(src, largeur, hauteur,
                              1.02 + 0.07 * u, -240 * u, -95 * u)
        avant = echantillonner(src, largeur, hauteur,
                               1.10 + 0.12 * u, 560 * u, 200 * u)
        image = fond * lointain + avant * proche

        # Le scintillement : les trois canaux multipliés par le même facteur,
        # sur les seuls pixels déjà lumineux. Toucher un seul canal fait virer
        # la couleur ; toucher toute l'image la fait battre.
        f = 1.0 + force_eclat * secousses[k]
        masque_eclat = echantillonner(eclat, largeur, hauteur, 1.02 + 0.07 * u, -240 * u, -95 * u)
        image = image * (1.0 + (f - 1.0) * masque_eclat)
        if tremble > 0:
            image = tremblement(image, u, tremble)

        p.stdin.write(numpy.clip(image, 0, 255).astype(numpy.uint8).tobytes())
    p.stdin.close()
    p.wait()
    print(f"{sortie} — {duree:.2f} s, {n} images")


def main():
    a = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("source")
    a.add_argument("sortie")
    a.add_argument("--duree", type=float, default=2.0)
    a.add_argument("--largeur", type=int, default=1080)
    a.add_argument("--hauteur", type=int, default=1920)
    a.add_argument("--images", type=int, default=30)
    a.add_argument("--seuil-eclat", type=float, default=150.0,
                   help="luminance au-dessus de laquelle un pixel scintille")
    a.add_argument("--force-eclat", type=float, default=0.55)
    a.add_argument("--graine", type=int, default=7)
    a.add_argument("--tremble", type=float, default=5.0,
                   help="amplitude du tremblement d'air, en pixels")
    v = a.parse_args()
    construire(v.source, v.sortie, v.duree, v.largeur, v.hauteur, v.images,
               v.seuil_eclat, v.force_eclat, v.graine, v.tremble)


if __name__ == "__main__":
    main()
