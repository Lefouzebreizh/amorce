"""
Fabriquer le cri soutenu d'une grande créature, à partir de prises trop courtes.

Une bibliothèque de bruitages livre des souffles de deux secondes dont toute
l'énergie tient dans les sept premiers dixièmes. Posé sous un plan de trois
secondes, un tel fichier s'entend comme un coup suivi d'un trou — mesuré ici :
attaque à −12,9 dB sur la bande d'un téléphone, corps à −21,6, fin à −30,3.
L'auteur dit alors « on n'entend pas le dragon », et il a raison : ce qu'on
entend n'est pas une créature, c'est un impact.

Ce qui donne sa taille à une bête n'est pas le niveau de son attaque mais la
**longueur de sa tenue**. On la fabrique en trois couches :

- **le grondement**, une pile d'harmoniques modulée en amplitude à une dizaine
  de hertz — c'est cette modulation lente qui s'entend comme une gorge, et non
  comme une nappe ;
- **le souffle**, du bruit filtré qui donne la matière de l'air expulsé ;
- **les prises**, superposées et décalées pour que la queue de l'une couvre
  l'attaque de la suivante.

Comme partout ici, rien ne vit sous 400 Hz tout seul : un haut-parleur de
téléphone n'en restitue rien, et une créature inaudible sur l'appareil où la
vidéo est regardée n'existe pas.

**Avertissement payé cher.** Le grondement de ce fichier est une pile
d'harmoniques : sur un spectrogramme il dessine des bandes parallèles, et à
l'oreille il s'entend comme un orgue, pas comme une gorge. Désaccorder les
rangs de un ou deux pour cent n'y change rien.

Et l'issue évidente — retirer la synthèse, ne garder que des prises réelles —
échoue autrement : les prises graves d'une bibliothèque sont du grave *pur*,
et les saturer pour leur fabriquer des harmoniques audibles sur téléphone
recrée exactement le même peigne, puisqu'un grondement basse fréquence est
lui-même presque harmonique.

**La seule sortie est le matériau.** Chercher dans le lot la prise qui porte
déjà du vrai aigu — se mesurer au-dessus de 400 Hz sans traitement — et la
décliner : transposée vers le bas, transposée vers le haut, ralentie. Les
prises graves ne servent alors qu'au poids, filtrées sous 400 Hz, là où elles
vivent. Mesuré sur un dragon : −13,0 / −12,4 / −12,8 / −13,4 dB sur trois
secondes, contre onze décibels d'affaissement par toutes les autres méthodes.

Ce module reste utile quand aucune prise du lot n'a d'aigu — mais son
grondement doit alors rester minoritaire dans le mixage.
"""

from __future__ import annotations

import argparse
import subprocess
import shutil
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 48000


def ffmpeg():
    c = shutil.which("ffmpeg")
    if c:
        return c
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def lire(chemin):
    """Relire n'importe quel format en mono 48 kHz, sans supposer le codec."""
    p = subprocess.run(
        [ffmpeg(), "-v", "error", "-i", str(chemin), "-f", "f32le",
         "-ar", str(SR), "-ac", "1", "-"],
        capture_output=True)
    return np.frombuffer(p.stdout, dtype=np.float32).astype(np.float64)


def grondement(t, f0=72.0, modulation=11.0):
    """La gorge : des harmoniques, et une modulation lente d'amplitude.

    Sans la modulation, la pile d'harmoniques s'entend comme un orgue. C'est
    l'irrégularité lente qui la fait entendre comme un souffle vivant.
    """
    s = np.zeros_like(t)
    for rang, poids in ((1, 1.0), (2, 0.72), (3, 0.62), (4, 0.56),
                        (5, 0.52), (6, 0.48), (7, 0.46), (9, 0.42),
                        (11, 0.38), (13, 0.34), (16, 0.28), (20, 0.22),
                        (25, 0.16), (31, 0.11)):
        # Un léger glissando descendant : une bête qui expire perd en hauteur.
        # Désaccord par rang et tremblement lent : sans eux, les rangs
        # s'alignent en peigne — visible en bandes parallèles sur un
        # spectrogramme, audible comme un synthétiseur.
        ecart = 1.0 + 0.014 * np.sin(rang * 2.7) + 0.006 * rang
        tremble = 1.0 + 0.010 * np.sin(2 * np.pi * (1.7 + 0.31 * rang) * t)
        f = f0 * rang * ecart * tremble * (1.0 - 0.10 * t / max(t[-1], 1e-9))
        s += poids * np.sin(2 * np.pi * f * t + poids * np.sin(2 * np.pi * 2.3 * t))
    gorge = 0.62 + 0.38 * (0.5 + 0.5 * np.sin(2 * np.pi * modulation * t))
    gorge *= 0.80 + 0.20 * np.sin(2 * np.pi * 3.7 * t + 1.1)
    return s / 5.4 * gorge


def souffle(t, rng):
    n = rng.normal(0, 1, t.shape)
    sos = butter(2, [700, 5200], "bandpass", fs=SR, output="sos")
    n = sosfilt(sos, n)
    # Le souffle enfle puis retombe : constant, il s'entend comme du bruit de
    # fond. La forme se lit sur le temps **normalisé** : posée sur des secondes,
    # elle retombait à sa dernière valeur dès la première, et la couche d'air
    # mourait au bout d'un tiers du son sans que rien ne le signale.
    u = t / max(t[-1], 1e-9)
    forme = np.interp(u, [0, 0.18, 0.55, 0.82, 1.0], [0.25, 1.0, 0.72, 0.85, 0.15])
    return n * forme


def construire(prises, duree, sortie):
    t = np.arange(int(duree * SR)) / SR
    rng = np.random.default_rng(11)

    mix = grondement(t) * 0.85
    mix += souffle(t, rng) * 0.52

    # Les prises, décalées : la queue de l'une couvre l'attaque de la suivante,
    # ce qui donne une tenue continue là où chacune, seule, laisse un trou.
    if prises:
        pas = duree / (len(prises) + 0.6)
        for k, chemin in enumerate(prises):
            s = lire(chemin)
            if s.size == 0:
                continue
            s = s / (np.abs(s).max() + 1e-9)
            i = int(k * pas * SR)
            n = min(len(s), len(mix) - i)
            if n <= 0:
                continue
            fondu = np.minimum(1.0, np.arange(n) / (0.06 * SR))
            fondu *= np.minimum(1.0, (n - np.arange(n)) / (0.25 * SR))
            mix[i:i + n] += s[:n] * fondu * (0.85 if k == 0 else 0.55)

    # Les harmoniques que le téléphone restitue. La saturation les fabrique à
    # partir du grave ; sans elles, tout ce travail reste sous 400 Hz.
    sos_bas = butter(2, 380, "lowpass", fs=SR, output="sos")
    bas = sosfilt(sos_bas, mix)
    mix += np.tanh(bas * 2.6) * 0.42

    # Enveloppe générale : attaque nette, tenue longue, chute courte. C'est la
    # tenue qui fait la taille de la bête.
    env = np.interp(t, [0, 0.09, 0.30, duree * 0.72, duree * 0.93, duree],
                    [0.0, 1.0, 0.88, 0.92, 0.70, 0.0])
    mix *= env

    mix /= np.abs(mix).max() + 1e-9
    mix = np.tanh(mix * 1.35) * 0.94
    stereo = np.stack([mix, np.roll(mix, 190)], axis=1)
    wavfile.write(sortie, SR, (stereo * 32767).astype(np.int16))
    print(f"{sortie} — {duree:.2f} s, {len(prises)} prise(s) superposée(s)")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("sortie")
    p.add_argument("--duree", type=float, default=3.0)
    p.add_argument("--prises", nargs="*", default=[])
    p.add_argument("--fondamentale", type=float, default=72.0)
    a = p.parse_args()
    construire(a.prises, a.duree, a.sortie)


if __name__ == "__main__":
    main()
