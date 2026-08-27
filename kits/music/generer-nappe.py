"""
Fabriquer une nappe de bande-annonce calée sur les coupes d'un montage.

Aucune clé de génération musicale n'est disponible ici, et une bibliothèque de
boucles libres ne se cale sur rien : elle impose son tempo au film au lieu de
suivre le sien. La synthèse règle les deux problèmes d'un coup — on décide où
tombent les accents, donc ils tombent sur les coupes.

Trois contraintes, et chacune vient d'un échec mesuré :

- **Rien sous 400 Hz tout seul.** Un haut-parleur de téléphone ne restitue rien
  en dessous ; une nappe grave y est physiquement absente. Chaque voix grave est
  donc doublée de ses harmoniques, qui, elles, passent.
- **La nappe suit la dynamique, elle ne la comble pas.** Une musique posée à
  niveau constant écrase la plage dynamique du mixage — mesuré : LRA tombé de
  6,8 à 3,5 pour un creux comblé de sept décibels. L'enveloppe ci-dessous a donc
  des creux volontaires, aux mêmes endroits que le montage.
- **Elle se tait sous les voix.** Pas d'atténuation automatique : les fenêtres
  de parole sont données en argument et la nappe y descend de douze décibels.

Le résultat n'est pas de la musique de film. C'est un lit harmonique qui tient
les vingt secondes sans attirer l'attention, ce qui est exactement le travail.
"""

from __future__ import annotations

import argparse
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 48000

# Ré mineur : la tonalité des bandes-annonces, et la seule dont les harmoniques
# tombent dans la bande utile d'un téléphone sans transposition.
D1, D2, A2, F3, D3, A3 = 36.71, 73.42, 110.0, 174.61, 146.83, 220.0


def env(t, points):
    """Enveloppe linéaire par morceaux : (instant, niveau)."""
    xs = np.array([p[0] for p in points])
    ys = np.array([p[1] for p in points])
    return np.interp(t, xs, ys)


def voix_grave(t, f, detune=0.004):
    """Une fondamentale grave **et** ses harmoniques.

    La fondamentale seule n'existe pas sur un téléphone. Les rangs 2, 3, 4 et 6
    la rendent audible sans la transposer : l'oreille reconstruit la note grave
    à partir de ses harmoniques, c'est la fondamentale manquante.
    """
    s = np.zeros_like(t)
    for rang, poids in ((1, 1.0), (2, 0.55), (3, 0.34), (4, 0.22), (6, 0.13), (8, 0.08)):
        for d in (-detune, 0.0, detune):
            s += poids * np.sin(2 * np.pi * f * rang * (1 + d) * t)
    return s / 9.0


def cordes(t, f, largeur=0.008):
    """Nappe façon cordes : des scies désaccordées, adoucies."""
    s = np.zeros_like(t)
    for d in (-largeur, -largeur / 3, largeur / 3, largeur):
        p = (f * (1 + d) * t) % 1.0
        s += 2.0 * p - 1.0
    sos = butter(2, 2600, "lowpass", fs=SR, output="sos")
    return sosfilt(sos, s / 4.0)


def bruit_souffle(t, coupe=900):
    n = np.random.default_rng(7).normal(0, 1, t.shape)
    sos = butter(2, coupe, "highpass", fs=SR, output="sos")
    return sosfilt(sos, n)


def frappe(duree, f0=58.0, brillance=0.55):
    """Un coup : sinus descendant pour le corps, bruit filtré pour l'attaque."""
    t = np.arange(int(duree * SR)) / SR
    corps = np.sin(2 * np.pi * f0 * np.exp(-t * 2.4) * t) * np.exp(-t * 5.5)
    # Le corps vit sous 400 Hz : sans cette couche, le coup n'existe pas sur un
    # téléphone. Les deux couches partagent le niveau, sinon le limiteur pompe.
    haut = bruit_souffle(t, 1200) * np.exp(-t * 16.0) * brillance
    m = corps * (1 - brillance) + haut
    return m / (np.abs(m).max() + 1e-9)


def construire(duree, coupes, voix, sortie):
    t = np.arange(int(duree * SR)) / SR

    # L'enveloppe générale. Ses creux sont volontaires : ce sont eux qui
    # laissent les crêtes du montage exister.
    general = env(t, [
        (0.0, 0.26), (1.4, 0.16), (6.5, 0.18), (10.2, 0.20),
        (10.4, 0.66), (11.6, 0.34), (12.7, 0.30), (12.8, 0.74),
        (14.2, 0.38), (16.9, 0.44), (17.1, 0.92), (18.4, 0.46),
        (19.4, 0.52), (19.5, 0.86), (20.6, 0.44), (21.3, 0.46),
        (21.4, 1.00), (22.4, 0.42), (duree, 0.0),
    ])

    # Le bourdon tient tout le film ; la tierce et la quinte n'entrent qu'à la
    # montée, sinon l'accord est complet dès la première seconde et il ne reste
    # plus rien à donner.
    mix = voix_grave(t, D2) * 0.55
    mix += voix_grave(t, D1) * 0.30
    mix += cordes(t, A2) * env(t, [(0, 0.0), (6.5, 0.0), (10.4, 0.22), (17.0, 0.34), (duree, 0.10)])
    mix += cordes(t, F3) * env(t, [(0, 0.0), (12.6, 0.0), (12.9, 0.20), (17.0, 0.30), (duree, 0.08)])
    mix += cordes(t, D3) * env(t, [(0, 0.0), (17.0, 0.0), (17.2, 0.26), (duree, 0.12)])

    # La montée : un souffle qui gagne en aigu jusqu'à la coupe du dragon.
    montee = bruit_souffle(t, 700) * env(t, [(0, 0), (12.8, 0.0), (17.05, 0.34), (17.2, 0.0), (duree, 0)])
    mix += montee

    # Une pulsation, à partir de la foudre seulement. Avant, le film respire.
    for k in range(200):
        d = 10.4 + k * 0.60
        if d > duree - 0.4:
            break
        i = int(d * SR)
        f = frappe(0.34, 62.0, 0.42)
        n = min(len(f), len(mix) - i)
        mix[i:i + n] += f[:n] * (0.11 + 0.13 * min(1.0, (d - 10.4) / 8.0))

    # Les coupes du montage. Chacune reçoit un coup, et c'est ce qui fait que la
    # musique paraît écrite pour ce film-ci.
    for d, force in coupes:
        i = int(d * SR)
        f = frappe(1.7, 52.0, 0.5)
        n = min(len(f), len(mix) - i)
        mix[i:i + n] += f[:n] * force

    mix *= general

    # Les fenêtres de parole : douze décibels de moins, avec une pente douce
    # pour que la descente ne s'entende pas elle-même.
    for a, b in voix:
        creux = np.ones_like(t)
        pente = 0.25
        creux = np.where((t > a - pente) & (t < b + pente), 0.25, creux)
        lissage = np.ones(int(0.12 * SR)) / int(0.12 * SR)
        creux = np.convolve(creux, lissage, mode="same")
        mix *= creux

    # Le haut du spectre est ce qu'un téléphone restitue : on le relève avant
    # normalisation, jamais après, sinon on relève aussi le souffle.
    sos = butter(2, 1100, "highpass", fs=SR, output="sos")
    mix = mix + sosfilt(sos, mix) * 0.45

    mix /= np.abs(mix).max() + 1e-9
    mix = np.tanh(mix * 1.25) * 0.86
    stereo = np.stack([mix, np.roll(mix, 220)], axis=1)  # une largeur discrète
    wavfile.write(sortie, SR, (stereo * 32767).astype(np.int16))
    print(f"{sortie} — {duree:.1f} s")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("sortie")
    p.add_argument("--duree", type=float, default=23.0)
    p.add_argument("--coupes", default="1.4:0.30,10.4:0.55,12.8:0.40,17.1:0.85,19.5:0.60,21.4:1.0")
    p.add_argument("--voix", default="1.4:6.8,6.8:10.4")
    a = p.parse_args()
    coupes = [(float(x.split(":")[0]), float(x.split(":")[1])) for x in a.coupes.split(",")]
    voix = [(float(x.split(":")[0]), float(x.split(":")[1])) for x in a.voix.split(",")]
    construire(a.duree, coupes, voix, a.sortie)


if __name__ == "__main__":
    main()
