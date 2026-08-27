#!/usr/bin/env python3
"""Nappe de bande-annonce calée sur les coupes d'un montage.

Cousine de `.claude/skills/bande-son/scripts/musique.py`, dont elle reprend les
outils et la théorie — modes, progressions écrites en degrés, `porter_sur_telephone`
— mais dont elle **inverse une contrainte**, et il faut dire laquelle.

`musique.py` fabrique un fond qui passe sous une voix pour un public
hypersensible : étendue dynamique volontairement faible, aucune montée qui
force. C'est juste pour ce qu'elle vise, et faux pour une bande-annonce, dont
le travail est précisément de monter. Ici on garde donc :

- **le creux de voix** — la bande 1,5–4 kHz porte l'intelligibilité des
  consonnes, on l'évide de 5 dB pendant que quelqu'un parle ;
- **`porter_sur_telephone`** pour la basse, faute de quoi elle n'existe pas sur
  l'appareil où la vidéo sera vue ;
- **les enveloppes en cosinus**, jamais linéaires : une rampe droite laisse un
  angle qu'on prend pour un défaut du fichier ;
- **la nappe une octave et demie au-dessus de la basse**, une tierce sous
  200 Hz donnant une bouillie que ni le mode ni le timbre ne rattrapent.

Et on abandonne la dynamique plate. À la place, l'enveloppe se **déduit des
coupes** qu'on lui passe : creux juste avant chacune, crête à la coupe. Une
enveloppe écrite à la main ne survit pas au premier remontage — on change
l'ordre des plans et la musique continue de gonfler aux anciens instants.

Ce que ça a coûté d'apprendre, et qui tient en une phrase : ce ne sont pas les
crêtes qui font une montée, ce sont les creux. Un premier réglage remplissait
tout l'espace entre les accents ; la plage dynamique du mixage est tombée de
4,9 à 3,5 LU sans qu'un seul niveau ait bougé.

Usage :
    python3 generer-nappe.py sortie.wav --duree 20 \\
        --coupes 1.4:0.3,7.9:0.45,12.9:0.85,17.8:1.0 --voix 1.4:7.9
"""

from __future__ import annotations

import argparse
import sys
import wave
from pathlib import Path

import numpy
from scipy import signal as filtres

# Les outils du dépôt plutôt que les miens : `porter_sur_telephone` est mesurée
# — 0,6 à 1,2 dB de perte une fois filtrée comme le fait un téléphone — quand
# ma propre saturation en perdait 3,4.
_OUTILS = Path(__file__).resolve().parents[2] / ".claude" / "skills" / "bande-son" / "scripts"
sys.path.insert(0, str(_OUTILS))
from bruitages import TAUX, _bande, _bas, porter_sur_telephone  # noqa: E402

# Éolien : le mineur naturel. C'est le mode des bandes-annonces, et ce n'est pas
# une mode — sa sixte et sa septième mineures évitent toute couleur de
# résolution, donc rien n'y sonne « conclu » avant la fin.
EOLIEN = (0, 2, 3, 5, 7, 8, 10)
# 110 Hz, et non 55. Le premier réglage descendait deux octaves « parce que
# c'est une bande-annonce » — et posait la nappe, une octave et demie plus haut,
# à 155 Hz : sous le plancher d'un haut-parleur de téléphone. Mesuré : 12,2 dB
# de perte, contre 0,6 pour `musique.py`. Le poids d'une bande-annonce se
# fabrique par les harmoniques du grave, jamais en descendant le registre.
FONDAMENTALE = 110.0         # la2
PROGRESSION = (0, 5, 3, 6)   # i — VI — iv — VII, en degrés


def hauteur(demi_tons: float, reference: float = FONDAMENTALE) -> float:
    return reference * 2.0 ** (demi_tons / 12.0)


def enveloppe_cosinus(n: int, attaque: float, chute: float) -> numpy.ndarray:
    """Attaque et extinction en cosinus — la règle de `musique.py`, reprise."""
    e = numpy.ones(n)
    a = min(int(attaque * TAUX), n // 2)
    c = min(int(chute * TAUX), n // 2)
    if a:
        e[:a] = 0.5 - 0.5 * numpy.cos(numpy.linspace(0, numpy.pi, a))
    if c:
        e[-c:] = 0.5 + 0.5 * numpy.cos(numpy.linspace(0, numpy.pi, c))
    return e


def note(frequence: float, duree: float, eclat: float, graine: int) -> numpy.ndarray:
    """Une note : quelques harmoniques, deux voix désaccordées.

    Le désaccord n'est pas décoratif. Deux voix exactement accordées se somment
    en une seule, et la pile d'harmoniques qui en résulte dessine un peigne
    régulier — visible en bandes parallèles sur un spectrogramme, audible comme
    un orgue. C'est le défaut qui a fait rejeter une version entière.
    """
    n = int(duree * TAUX)
    t = numpy.arange(n) / TAUX
    rng = numpy.random.default_rng(graine)
    s = numpy.zeros(n)
    for voie, ecart in enumerate((-0.004, 0.004)):
        for rang in range(1, 9):
            poids = eclat ** (rang - 1) / rang
            derive = 1.0 + ecart + 0.0006 * rng.standard_normal()
            s += poids * numpy.sin(2 * numpy.pi * frequence * rang * derive * t
                                   + rng.uniform(0, 2 * numpy.pi))
    return s / 12.0 * enveloppe_cosinus(n, 0.12, 0.35)


def enveloppe_des_coupes(t, coupes, duree):
    """Creux avant chaque coupe, crête à la coupe.

    C'est la seule partie qui n'existe pas dans `musique.py`, et c'est ce qui
    distingue une bande-annonce d'un fond : la forme suit le montage au lieu de
    tenir un niveau.
    """
    points = [(0.0, 0.24)]
    for i, (instant, force) in enumerate(coupes):
        plancher = 0.15 + 0.20 * (instant / duree)
        points.append((max(0.0, instant - 0.14), plancher))
        points.append((instant, min(1.0, 0.32 + 0.74 * force)))
        suivante = coupes[i + 1][0] if i + 1 < len(coupes) else duree
        creux = instant + min(1.4, (suivante - instant) * 0.55)
        if creux < suivante:
            points.append((creux, plancher + 0.14))
    points.append((duree, 0.0))
    points.sort(key=lambda p: p[0])
    return numpy.interp(t, [p[0] for p in points], [p[1] for p in points])


def creuser_pour_la_voix(mix, fenetres, duree):
    """Évide 1,5–4 kHz de 5 dB pendant qu'on parle, et baisse l'ensemble.

    La bande 1,5–4 kHz porte l'intelligibilité des consonnes. L'évider ne
    s'entend pas sur la musique seule et change tout au mixage — c'est la règle
    de `musique.py`, et elle vaut ici d'autant plus que la voix est la seule
    chose que le spectateur doit comprendre.
    """
    if not fenetres:
        return mix
    t = numpy.arange(len(mix)) / TAUX
    consonnes = _bande(mix, 1500, 4000)
    masque = numpy.zeros(len(mix))
    for debut, fin in fenetres:
        masque += ((t > debut - 0.3) & (t < fin + 0.3)).astype(float)
    masque = numpy.clip(masque, 0.0, 1.0)
    lissage = numpy.ones(int(0.18 * TAUX)) / int(0.18 * TAUX)
    masque = numpy.convolve(masque, lissage, mode="same")
    # 5 dB de moins sur la bande, et un tiers de moins sur l'ensemble.
    mix = mix - consonnes * masque * (1.0 - 10 ** (-5.0 / 20.0))
    return mix * (1.0 - 0.62 * masque)


def construire(duree, coupes, fenetres_voix, sortie):
    n = int(duree * TAUX)
    t = numpy.arange(n) / TAUX
    mix = numpy.zeros(n)

    # Un accord tous les quarts de la durée, en boucle sur la progression.
    par_accord = duree / max(1, round(duree / 4.0))
    debut = 0.0
    k = 0
    while debut < duree - 0.05:
        degre = PROGRESSION[k % len(PROGRESSION)]
        longueur = min(par_accord, duree - debut)
        i = int(debut * TAUX)
        racine = EOLIEN[degre % 7] + 12 * (degre // 7)

        # La basse tient la fondamentale, portée sur téléphone.
        basse = note(hauteur(racine), longueur, 0.55, 100 + k)
        basse = porter_sur_telephone(basse, poids=0.9)

        # La nappe prend la triade **deux octaves plus haut**, soit autour de
        # 440 Hz : la règle de `musique.py` veut une tierce loin du grave, et
        # celle du téléphone veut le registre utile entre 200 Hz et 5 kHz. Les
        # deux tombent d'accord ici.
        nappe = numpy.zeros(int(longueur * TAUX))
        for intervalle in (0, EOLIEN[(degre + 2) % 7] - EOLIEN[degre % 7],
                           EOLIEN[(degre + 4) % 7] - EOLIEN[degre % 7]):
            nappe += note(hauteur(racine + intervalle + 24), longueur, 0.46, 200 + k + intervalle)
            # Une octave encore au-dessus, discrète : c'est elle qui reste
            # quand le téléphone a coupé tout le reste.
            nappe += note(hauteur(racine + intervalle + 36), longueur, 0.38,
                          300 + k + intervalle) * 0.34

        bloc = basse * 0.42 + nappe * 0.38
        m = min(len(bloc), n - i)
        mix[i:i + m] += bloc[:m]
        debut += longueur
        k += 1

    mix *= enveloppe_des_coupes(t, coupes, duree)
    mix = creuser_pour_la_voix(mix, fenetres_voix, duree)

    crete = numpy.max(numpy.abs(mix))
    if crete > 0:
        mix = mix / crete * 0.86

    gauche = mix
    droite = numpy.roll(mix, 210)          # une largeur discrète, sans phase folle
    entrelace = numpy.empty(n * 2)
    entrelace[0::2] = gauche
    entrelace[1::2] = droite
    with wave.open(str(sortie), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(TAUX)
        f.writeframes((numpy.clip(entrelace, -1, 1) * 32767).astype("<i2").tobytes())

    # Ce que le téléphone en gardera, dit tout de suite plutôt qu'après coup.
    perte = 20 * numpy.log10(
        (numpy.sqrt(numpy.mean(_bande(mix, 400, 16000) ** 2)) + 1e-12)
        / (numpy.sqrt(numpy.mean(mix ** 2)) + 1e-12))
    print(f"{sortie} — {duree:.1f} s · perte sur téléphone {perte:+.1f} dB")


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("sortie")
    p.add_argument("--duree", type=float, default=20.0)
    p.add_argument("--coupes", default="1.4:0.30,7.9:0.45,12.9:0.85,17.8:1.0",
                   help="instant:force, séparés par des virgules")
    p.add_argument("--voix", default="", help="debut:fin des fenêtres de parole")
    a = p.parse_args()
    coupes = sorted((float(x.split(":")[0]), float(x.split(":")[1]))
                    for x in a.coupes.split(",") if x)
    voix = [(float(x.split(":")[0]), float(x.split(":")[1]))
            for x in a.voix.split(",") if x] if a.voix else []
    construire(a.duree, coupes, voix, a.sortie)


if __name__ == "__main__":
    main()
