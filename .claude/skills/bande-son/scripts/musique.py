#!/usr/bin/env python3
"""Musique de fond fabriquée sur la machine, à partir d'une intention.

Aucun fichier n'est importé, rien à licencier, rien à retrouver dans six mois —
même principe que `bruitages.py`, et pour les mêmes raisons.

Trois contraintes gouvernent ce fichier, et aucune n'est musicale. Ce sont elles
qui expliquent les choix qui paraîtraient timides ailleurs.

1. **Ça passe sous une voix off.** Une musique de fond n'a pas à être belle
   seule : elle a à ne pas manger la parole. La bande 1,5–4 kHz porte
   l'intelligibilité des consonnes ; la musique y est creusée de 5 dB, ce qui
   ne s'entend pas isolément et change tout au mixage. C'est aussi pourquoi il
   n'y a ni percussion sèche ni attaque brutale : un transitoire fait plonger
   la voix à chaque coup si un compresseur les partage.

2. **Ça sort d'un haut-parleur de téléphone.** Rien sous 400 Hz n'est restitué.
   La basse est donc portée par ses harmoniques (`porter_sur_telephone`), et le
   registre utile est posé entre 200 Hz et 5 kHz plutôt qu'étalé « joliment »
   sur tout le spectre.

3. **Le public est hypersensible.** Pas de montée qui force, pas de battement
   rapide, pas de crête qui surprend. Une nappe qui respire lentement, une
   basse qui tient, quelques notes espacées. L'étendue dynamique est
   volontairement faible : ce qui fait un bon disque fait une mauvaise musique
   de fond, parce qu'on monte le volume sur les passages doux et qu'on sursaute
   ensuite.

Le reste est de la théorie ordinaire : un mode, une progression d'accords, un
arpège pris dans la pentatonique du mode. Les voicings évitent la tierce en bas
du spectre — deux notes rapprochées sous 200 Hz donnent une bouillie, quel que
soit le talent de l'harmonie.

Usage :
    python3 musique.py --ambiance calme --duree 30 --sortie fond.wav
    python3 musique.py --liste
"""

from __future__ import annotations

import argparse
import sys
import wave
from pathlib import Path

import numpy
from scipy import signal as filtres

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bruitages import TAUX, _bande, _bas, porter_sur_telephone  # noqa: E402

# Intervalles en demi-tons depuis la fondamentale. Le mode fait plus pour la
# couleur d'une musique que n'importe quel réglage de synthèse : un même
# arpège en éolien et en lydien ne raconte pas la même chose.
MODES = {
    "eolien": (0, 2, 3, 5, 7, 8, 10),      # mineur naturel — grave, posé
    "dorien": (0, 2, 3, 5, 7, 9, 10),      # mineur à sixte majeure — moins triste
    "ionien": (0, 2, 4, 5, 7, 9, 11),      # majeur
    "lydien": (0, 2, 4, 6, 7, 9, 11),      # majeur à quarte augmentée — ouvert
}

# Chaque ambiance est un mode, un tempo, une progression en degrés, et deux
# réglages de timbre. Les progressions sont écrites en degrés et non en accords
# pour rester justes quel que soit le mode.
AMBIANCES = {
    "calme": {
        "mode": "dorien", "tempo": 64, "progression": (0, 3, 5, 4),
        "eclat": 0.35, "densite": 0.5,
        "pour": "fond de voix off posée, tutoriel, témoignage",
    },
    "melancolie": {
        "mode": "eolien", "tempo": 58, "progression": (0, 5, 2, 6),
        "eclat": 0.28, "densite": 0.4,
        "pour": "récit personnel, ce qui s'est mal passé",
    },
    "lumineux": {
        "mode": "lydien", "tempo": 72, "progression": (0, 4, 5, 3),
        "eclat": 0.55, "densite": 0.7,
        "pour": "ouverture, ce qui va mieux, fin d'épisode",
    },
    "espoir": {
        "mode": "ionien", "tempo": 68, "progression": (0, 4, 5, 3),
        "eclat": 0.45, "densite": 0.6,
        "pour": "conclusion, appel doux, remerciement",
    },
    "attente": {
        "mode": "eolien", "tempo": 60, "progression": (0, 6, 0, 6),
        "eclat": 0.30, "densite": 0.35,
        "pour": "suspension, question laissée ouverte",
    },
}


def hauteur(demi_tons: float, reference: float = 220.0) -> float:
    """Fréquence d'une note donnée en demi-tons depuis un la3 à 220 Hz."""
    return reference * 2.0 ** (demi_tons / 12.0)


def _enveloppe(n: int, attaque: float, chute: float) -> numpy.ndarray:
    """Attaque et extinction en cosinus, jamais linéaires.

    Une rampe droite laisse un angle dans la forme d'onde, et cet angle
    s'entend : c'est le petit « clic » qu'on croit venir du fichier alors qu'il
    vient de l'enveloppe.
    """
    e = numpy.ones(n)
    a = min(int(attaque * TAUX), n // 2)
    c = min(int(chute * TAUX), n // 2)
    if a:
        e[:a] = 0.5 - 0.5 * numpy.cos(numpy.linspace(0, numpy.pi, a))
    if c:
        e[-c:] = 0.5 + 0.5 * numpy.cos(numpy.linspace(0, numpy.pi, c))
    return e


def voix_harmonique(frequence: float, duree: float, eclat: float,
                    graine: int, desaccord: float = 0.004) -> numpy.ndarray:
    """Une note : quelques harmoniques, deux voix légèrement désaccordées.

    Une sinusoïde seule sonne comme un test auditif. Ce qui fait un timbre, ce
    sont les harmoniques et leur décroissance — `eclat` règle à quelle vitesse
    elles s'éteignent, donc si l'instrument est feutré ou brillant.

    Le désaccord entre deux voix produit un battement lent qui donne l'épaisseur
    et la largeur. Au-delà de quelques millièmes il devient un vibrato, ce qui
    fatigue vite l'oreille : c'est un effet, pas une texture.
    """
    n = max(1, int(duree * TAUX))
    t = numpy.arange(n) / TAUX
    generateur = numpy.random.default_rng(graine)
    piste = numpy.zeros(n)

    for sens in (1.0, -1.0):
        f0 = frequence * (1.0 + sens * desaccord)
        phase = generateur.uniform(0, 2 * numpy.pi)
        for rang in range(1, 9):
            amplitude = eclat ** (rang - 1) / rang
            if amplitude < 0.004:
                break
            piste += amplitude * numpy.sin(2 * numpy.pi * f0 * rang * t + phase * rang)
    return piste / 2.0


def accord(degre: int, mode: tuple[int, ...]) -> tuple[int, int, int]:
    """Triade construite sur un degré du mode, en demi-tons depuis la tonique.

    Les tierces et quintes se prennent *dans le mode* (degrés +2 et +4), jamais
    en empilant des intervalles fixes : c'est ce qui fait qu'un accord reste
    dans la tonalité au lieu d'en sortir au troisième degré.
    """
    def note(i: int) -> int:
        return mode[i % 7] + 12 * (i // 7)
    return note(degre), note(degre + 2), note(degre + 4)


def fabriquer(nom: str, duree: float, graine: int = 7) -> numpy.ndarray:
    """Rend la piste complète d'une ambiance, en mono."""
    if nom not in AMBIANCES:
        raise SystemExit(f"Ambiance inconnue : « {nom} ». "
                         f"Disponibles : {', '.join(AMBIANCES)}")
    reglage = AMBIANCES[nom]
    mode = MODES[reglage["mode"]]
    battement = 60.0 / reglage["tempo"]
    mesure = battement * 4                       # quatre temps par accord
    eclat = reglage["eclat"]

    total = max(1, int(duree * TAUX))
    nappe = numpy.zeros(total)
    basse = numpy.zeros(total)
    chant = numpy.zeros(total)
    generateur = numpy.random.default_rng(graine)

    # La pentatonique du mode : on y prend le chant. Elle évite le demi-ton, donc
    # la seule note qui puisse sonner fausse sur n'importe quel accord de la
    # progression — c'est ce qui permet d'improviser sans surveiller l'harmonie.
    penta = [mode[i] for i in (0, 1, 2, 4, 5)]

    instant = 0.0
    rang_mesure = 0
    while instant < duree:
        degre = reglage["progression"][rang_mesure % len(reglage["progression"])]
        notes = accord(degre, mode)
        debut = int(instant * TAUX)
        longueur = min(mesure * 1.15, duree - instant + 0.6)   # les accords se chevauchent

        # --- la nappe : la triade, posée haut ---------------------------------
        # Écartée d'une octave et demie au-dessus de la basse : une tierce jouée
        # sous 200 Hz donne une bouillie que ni le mode ni le timbre ne rattrapent.
        for rang, demi in enumerate(notes):
            f = hauteur(demi + 12)
            voix = voix_harmonique(f, longueur, eclat, graine + rang_mesure * 5 + rang)
            voix *= _enveloppe(voix.size, attaque=battement * 0.9, chute=battement * 1.4)
            fin = min(debut + voix.size, total)
            nappe[debut:fin] += voix[:fin - debut] * (0.5 if rang else 0.62)

        # --- la basse : la fondamentale, tenue --------------------------------
        f_basse = hauteur(notes[0] - 12)
        grave = voix_harmonique(f_basse, longueur, eclat * 0.5, graine + rang_mesure)
        grave *= _enveloppe(grave.size, attaque=battement * 0.5, chute=battement * 1.2)
        fin = min(debut + grave.size, total)
        basse[debut:fin] += grave[:fin - debut]

        # --- le chant : quelques notes, jamais sur chaque temps ---------------
        for temps in range(4):
            if generateur.random() > reglage["densite"]:
                continue
            t_note = instant + temps * battement + generateur.uniform(-0.02, 0.02)
            if t_note >= duree:
                break
            demi = penta[generateur.integers(0, len(penta))] + 12 * generateur.integers(1, 3)
            n_debut = int(t_note * TAUX)
            note = voix_harmonique(hauteur(demi), battement * 1.6, eclat * 1.2,
                                   graine + n_debut)
            note *= _enveloppe(note.size, attaque=0.06, chute=battement * 1.3)
            n_fin = min(n_debut + note.size, total)
            chant[n_debut:n_fin] += note[:n_fin - n_debut] * 0.30

        instant += mesure
        rang_mesure += 1

    # L'écho du chant tient lieu de réverbération : deux répétitions espacées
    # d'une croche pointée, ce qui remplit les silences sans flouter l'attaque.
    for retard, gain in ((battement * 0.75, 0.34), (battement * 1.5, 0.16)):
        d = int(retard * TAUX)
        if d < total:
            chant[d:] += chant[:-d] * gain

    basse = porter_sur_telephone(basse, poids=0.9)
    piste = nappe * 0.55 + basse * 0.42 + chant * 0.5

    # Un souffle très bas donne de l'air : sans lui, une synthèse pure sonne
    # « propre » d'une façon qui s'entend comme du plastique.
    souffle = _bande(generateur.normal(0, 1, total), 900, 7000) * 0.012
    piste += souffle * _irregulier_lent(total, graine)

    # Le creux qui laisse passer la parole. Cinq décibels sur 1,5–4 kHz : c'est
    # peu à l'écoute seule, et c'est la différence entre une voix qui se détache
    # et une voix qu'on remonte jusqu'à ce qu'elle sature.
    creux = _bande(piste, 1500, 4000)
    piste -= creux * 0.44

    piste *= _enveloppe(total, attaque=1.2, chute=1.8)
    crete = numpy.max(numpy.abs(piste))
    return piste / crete * 0.72 if crete > 0 else piste


def _irregulier_lent(n: int, graine: int) -> numpy.ndarray:
    """Une respiration très lente, entre 0,6 et 1. Le souffle ne doit pas pulser."""
    generateur = numpy.random.default_rng(graine + 99)
    brut = generateur.normal(0, 1, n)
    lisse = _bas(brut, 0.35)
    lisse -= lisse.min()
    return 0.6 + 0.4 * lisse / (lisse.max() + 1e-9)


def ecrire(piste: numpy.ndarray, sortie: Path) -> Path:
    """Écrit un WAV stéréo. Le décalage entre canaux donne la largeur."""
    # Quelques millisecondes de retard sur la droite : l'oreille lit ce décalage
    # comme de l'espace. Un vrai stéréo décorrélé serait plus large, mais se
    # replierait mal en mono — et un haut-parleur de téléphone est mono.
    retard = int(0.008 * TAUX)
    droite = numpy.concatenate([numpy.zeros(retard), piste[:-retard]]) if retard else piste
    stereo = numpy.stack([piste, droite * 0.94], axis=1)
    entiers = (numpy.clip(stereo, -1, 1) * 32767).astype("<i2")
    sortie = Path(sortie).expanduser().resolve()
    sortie.parent.mkdir(parents=True, exist_ok=True)
    provisoire = sortie.with_suffix(sortie.suffix + ".partiel")
    with wave.open(str(provisoire), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(TAUX)
        f.writeframes(entiers.tobytes())
    provisoire.replace(sortie)
    return sortie


def main() -> int:
    a = argparse.ArgumentParser(
        description="Fabrique une musique de fond à partir d'une intention.",
        epilog="Le résultat se juge avec voir-le-son et se mixe avec monter.py.")
    a.add_argument("--ambiance", default="calme", help="voir --liste")
    a.add_argument("--duree", type=float, default=30.0, help="en secondes")
    a.add_argument("--sortie", default="musique.wav")
    a.add_argument("--graine", type=int, default=7,
                   help="change le chant sans changer l'harmonie")
    a.add_argument("--liste", action="store_true")
    args = a.parse_args()

    if args.liste:
        print("Ambiances disponibles :\n")
        for nom, r in AMBIANCES.items():
            print(f"  {nom:12} {r['mode']:9} {r['tempo']:>3} bpm   {r['pour']}")
        return 0

    piste = fabriquer(args.ambiance, args.duree, args.graine)
    chemin = ecrire(piste, Path(args.sortie))
    print(f"   {chemin} — {piste.size / TAUX:.1f} s, ambiance « {args.ambiance} »")
    return 0


if __name__ == "__main__":
    sys.exit(main())
