#!/usr/bin/env python3
"""Creuser un lit sonore DANS LA BANDE DE LA VOIX, et seulement là.

    python3 montage-auto/creuser_pour_la_voix.py --media rushes/dragon-hook.mp4 \\
        --voix 0.25:2.12 --intact 0.30 --sortie rushes/dragon-hook-creuse.mp4

POURQUOI CE SCRIPT EXISTE.

« On n'entend pas ma voix, le dragon couvre. » Le premier réflexe est le
fader : baisser le rush, monter la voix. Mesuré, il n'y avait rien à corriger
— au-dessus de 400 Hz la voix était déjà 5 dB plus haut que le dragon, et
`entendu()` le disait. Le fader ne pouvait donc que dégrader les deux.

La faute était dans le spectre. Sur la fenêtre de la réplique, par bandes :

      Hz          20-120  120-300  300-700  700-1k6  1k6-3k5  3k5-8k
      dragon        29.3     15.2     15.2     12.5     11.7     8.1
      la voix        4.1     16.6     27.4     12.8      9.5     2.2

Le dragon est 25 dB au-dessus dans le grave — un grondement de ce niveau
masque la parole vers le haut, c'est le masquage ascendant, et aucun niveau
moyen ne le voit. Et surtout il est 2 dB AU-DESSUS de la voix entre 1,6 et
3,5 kHz : la bande des consonnes, celle qui distingue un mot d'un autre.
D'où « il manque des mots » — ils étaient prononcés, ils étaient masqués.

Ce qu'il faut n'est pas de baisser le lit mais d'y CREUSER la forme de la
voix : un creux dans le grave et un creux dans la présence, pendant qu'elle
parle, et rien ailleurs. C'est l'esquive du mixage de cinéma faite par bande
au lieu d'être faite au fader. Le rush garde son poids partout où la voix
se tait, et son entrée — les trois premiers dixièmes, `--intact` — n'est
jamais touchée : c'est là qu'est son impact.

Le traitement se fait par transformée à court terme, fenêtre de Hann de 2048
avec un saut de 512 (recouvrement 4, somme des fenêtres constante). Un filtre
fixe ne conviendrait pas : le creux doit s'ouvrir et se refermer avec la voix.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy

TAUX = 48000
FENETRE = 2048
SAUT = 512


def ffmpeg() -> str:
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def lire(media: Path) -> numpy.ndarray:
    """Le son en stéréo entrelacé, 48 kHz, flottant."""
    brut = subprocess.run(
        [ffmpeg(), "-v", "error", "-i", str(media),
         "-f", "f32le", "-ac", "2", "-ar", str(TAUX), "-"],
        capture_output=True).stdout
    return numpy.frombuffer(brut, dtype="<f4").astype(numpy.float64).reshape(-1, 2)


def enveloppe(total: int, fenetres: list[tuple[float, float]],
              intact: float, montee: float) -> numpy.ndarray:
    """De 0 (lit intact) à 1 (creux plein), avec des flancs adoucis.

    Un créneau net produit un souffle qui s'ouvre et se ferme — on l'entend
    comme une porte. Les flancs durent `montee` et sont en cosinus surélevé.
    """
    e = numpy.zeros(total)
    for debut, fin in fenetres:
        a, b = int(max(debut, intact) * TAUX), int(fin * TAUX)
        if b <= a:
            continue
        e[a:b] = 1.0
    n = max(1, int(montee * TAUX))
    noyau = numpy.hanning(2 * n + 1)
    noyau /= noyau.sum()
    return numpy.convolve(e, noyau, mode="same")


def creuser(son: numpy.ndarray, forme: numpy.ndarray,
            creux: list[tuple[float, float, float]]) -> numpy.ndarray:
    """Applique un gain par bande, variable dans le temps, par TFCT."""
    total = len(son)
    fen = numpy.hanning(FENETRE + 1)[:FENETRE]
    frq = numpy.fft.rfftfreq(FENETRE, 1 / TAUX)

    sortie = numpy.zeros((total + FENETRE, son.shape[1]))
    poids = numpy.zeros(total + FENETRE)
    rembourre = numpy.vstack([son, numpy.zeros((FENETRE, son.shape[1]))])
    forme = numpy.concatenate([forme, numpy.zeros(FENETRE)])

    for debut in range(0, total, SAUT):
        part = forme[debut:debut + FENETRE].mean()
        gains = numpy.ones(len(frq))
        if part > 0.001:
            for bas, haut, db in creux:
                bande = (frq >= bas) & (frq < haut)
                gains[bande] *= 10 ** ((db * part) / 20)
        for voie in range(son.shape[1]):
            bloc = rembourre[debut:debut + FENETRE, voie] * fen
            sortie[debut:debut + FENETRE, voie] += numpy.fft.irfft(
                numpy.fft.rfft(bloc) * gains, FENETRE) * fen
        poids[debut:debut + FENETRE] += fen ** 2

    poids[poids < 1e-9] = 1.0
    return (sortie[:total] / poids[:total, None])


def main() -> None:
    a = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("--media", required=True, type=Path)
    a.add_argument("--sortie", required=True, type=Path)
    a.add_argument("--voix", nargs="+", required=True,
                   help="fenêtres « début:fin » en secondes, où la voix parle")
    a.add_argument("--intact", type=float, default=0.0,
                   help="secondes de tête qu'on ne touche jamais — l'attaque du rush")
    a.add_argument("--montee", type=float, default=0.10,
                   help="durée des flancs du creux, en secondes")
    a.add_argument("--grave", type=float, default=-9.0,
                   help="dB sous 130 Hz : le grondement qui masque la parole vers le haut")
    a.add_argument("--presence", type=float, default=-7.0,
                   help="dB entre 700 et 3500 Hz : la bande des consonnes")
    o = a.parse_args()

    fenetres = []
    for f in o.voix:
        d, _, fin = f.partition(":")
        fenetres.append((float(d), float(fin)))

    son = lire(o.media)
    if not len(son):
        sys.exit(f"{o.media} n'a pas de son")
    forme = enveloppe(len(son), fenetres, o.intact, o.montee)
    creuse = creuser(son, forme, [(0.0, 130.0, o.grave),
                                  (700.0, 3500.0, o.presence)])

    atelier = Path(tempfile.mkdtemp(prefix="creux-"))
    try:
        piste = atelier / "creuse.wav"
        crete = float(numpy.abs(creuse).max())
        if crete > 0.999:
            creuse *= 0.999 / crete
        import wave
        with wave.open(str(piste), "wb") as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(TAUX)
            w.writeframes((numpy.clip(creuse, -1, 1) * 32767).astype("<i2").tobytes())
        o.sortie.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([ffmpeg(), "-y", "-v", "error", "-i", str(o.media),
                        "-i", str(piste), "-map", "0:v", "-map", "1:a",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
                        "-shortest", str(o.sortie)], check=True)
    finally:
        shutil.rmtree(atelier, ignore_errors=True)
    print(f"  écrit {o.sortie}")
    print(f"  creux : {o.grave:+.0f} dB sous 130 Hz, {o.presence:+.0f} dB de 700 à 3500 Hz")
    print(f"  intact : les {o.intact:.2f} premières secondes")


if __name__ == "__main__":
    main()
