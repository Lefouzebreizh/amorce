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
voix : on retire au rush les bandes où les mots vivent, pendant qu'ils sont
dits, et rien ailleurs.

ET UN CREUX PEUT ÊTRE POSITIF. Le premier réglage coupait aussi 11 dB sous
130 Hz, au nom du masquage ascendant. C'était vrai et c'était trop : le grave
EST le dragon, et le retirer l'a fait disparaître pour l'oreille alors que
les mesures de la bande des consonnes ne s'en portaient pas mieux. Une bande
peut donc porter un gain positif — on rend au rush son corps là où il ne gêne
personne, pendant qu'on lui retire la place des mots là où il gêne. C'est l'esquive du mixage de cinéma faite par bande
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


def enveloppe_suivie(total: int, prises: list[tuple[Path, float]],
                     intact: float, montee: float) -> numpy.ndarray:
    """La même, mais SUIVIE PAR LA VOIX — creusée syllabe par syllabe.

    Une fenêtre plate creuse le rush pendant toute la réplique, silences
    compris. Sur une phrase de deux secondes, cela retire le rush pendant
    deux secondes pour une seconde de parole utile, et l'auditeur ne
    l'entend plus du tout : « on n'entend plus le dragon » est le symptôme
    exact de ce réglage-là.

    L'énergie est relevée DANS LA BANDE DE LA VOIX — au-dessus de 300 Hz —
    et pas en large bande : un rush qui gronde sous les cent hertz
    déclencherait le creux aussi sûrement qu'une syllabe, et celui-ci se
    creuserait lui-même.

    Attaque courte, retour long : le creux doit être ouvert avant la
    syllabe et se refermer sans qu'on l'entende revenir. C'est la même
    asymétrie que tout esquiveur de mixage.
    """
    e = numpy.zeros(total)
    for chemin, instant in prises:
        voix = lire(chemin)[:, 0]
        # au-dessus de 300 Hz : ce que le creux protège, et rien d'autre
        spectre = numpy.fft.rfft(voix)
        frq = numpy.fft.rfftfreq(len(voix), 1 / TAUX)
        spectre[frq < 300] = 0
        haut = numpy.fft.irfft(spectre, len(voix))
        # l'énergie, fenêtre de 20 ms
        pas = int(0.020 * TAUX)
        blocs = numpy.array([numpy.sqrt((haut[d:d + pas] ** 2).mean())
                             for d in range(0, len(haut) - pas, pas)])
        if not len(blocs) or blocs.max() <= 0:
            continue
        forme = numpy.clip(blocs / blocs.max() * 3.2, 0, 1) ** 0.5
        etiree = numpy.repeat(forme, pas)
        # un instant négatif indexerait depuis la fin du tableau et creuserait
        # la queue du rush au lieu de sa tête, sans rien signaler
        debut = max(0, int(instant * TAUX))
        n = min(len(etiree), total - debut)
        if n > 0:
            e[debut:debut + n] = numpy.maximum(e[debut:debut + n], etiree[:n])
    e[:int(intact * TAUX)] = 0.0
    # attaque courte, retour long
    sortie = numpy.zeros(total)
    monte = 1 - numpy.exp(-1 / max(1, montee * TAUX))
    baisse = 1 - numpy.exp(-1 / max(1, 4 * montee * TAUX))
    v = 0.0
    for i in range(total):
        v += (e[i] - v) * (monte if e[i] > v else baisse)
        sortie[i] = v
    sortie[:int(intact * TAUX)] = 0.0
    return sortie


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
    a.add_argument("--voix", nargs="+", default=[],
                   help="fenêtres « début:fin » en secondes, où la voix parle")
    a.add_argument("--suivre", nargs="+", default=[], metavar="FICHIER:INSTANT",
                   help="la prise de voix et l'instant où elle commence. Le "
                        "creux suit alors les syllabes au lieu d'une fenêtre "
                        "plate : entre deux mots, le rush revient entier.")
    a.add_argument("--intact", type=float, default=0.0,
                   help="secondes de tête qu'on ne touche jamais — l'attaque du rush")
    a.add_argument("--montee", type=float, default=0.10,
                   help="durée des flancs du creux, en secondes")
    a.add_argument("--creux", nargs="+", metavar="BAS:HAUT:DB",
                   default=["0:130:-9", "700:3500:-7"],
                   help="les bandes à creuser, « bas:haut:dB ». Un dB POSITIF "
                        "renforce au lieu de creuser : c'est ainsi qu'on rend "
                        "au rush son corps pendant qu'on lui retire la place "
                        "des mots.")
    o = a.parse_args()

    if not o.voix and not o.suivre:
        sys.exit("il faut --voix ou --suivre : sans l'un des deux, rien à creuser")
    fenetres = []
    for f in o.voix:
        d, _, fin = f.partition(":")
        fenetres.append((float(d), float(fin)))
    prises = []
    for f in o.suivre:
        chemin, _, instant = f.rpartition(":")
        prises.append((Path(chemin).expanduser(), float(instant)))

    creux = []
    for c in o.creux:
        bas, haut, db = c.split(":")
        creux.append((float(bas), float(haut), float(db)))

    son = lire(o.media)
    if not len(son):
        sys.exit(f"{o.media} n'a pas de son")
    forme = (enveloppe_suivie(len(son), prises, o.intact, o.montee) if prises
             else enveloppe(len(son), fenetres, o.intact, o.montee))
    creuse = creuser(son, forme, creux)

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
    for bas, haut, db in creux:
        print(f"  {db:+5.1f} dB de {bas:.0f} à {haut:.0f} Hz")
    print(f"  intact : les {o.intact:.2f} premières secondes")
    ouvert = float((forme < 0.30).mean())
    print(f"  le rush revient entier sur {ouvert * 100:.0f} % de sa durée")


if __name__ == "__main__":
    main()
