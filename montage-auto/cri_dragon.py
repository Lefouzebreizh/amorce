#!/usr/bin/env python3
"""Le cri d'une créature, synthétisé comme un appareil vocal — pas comme un son.

Le `rugissement` de la banque de bruitages échoue pour une raison précise :
c'est une porteuse à 62 Hz modulée et saturée, sans conduit vocal. Or ce qui
fait qu'une oreille entend « animal » plutôt que « synthétiseur », ce sont les
**formants** — les résonances d'une gorge et d'une gueule, qui se déplacent
quand la mâchoire s'ouvre. Sans eux, on obtient un moteur.

Trois mécanismes construisent ici la crédibilité, et chacun a une raison :

**La source est glottique, pas sinusoïdale.** Une impulsion asymétrique répétée
— montée lente, fermeture brutale — porte naturellement toutes les harmoniques.
C'est ce que fait un larynx, et c'est ce qui donne de la matière à filtrer.

**Le sous-harmonique fait le grognement.** Une corde vocale poussée se met à
vibrer une fois sur deux : la fréquence perçue chute d'une octave et le timbre
se déchire. C'est le mécanisme du growl chez tous les gros animaux, et aucune
distorsion ajoutée après coup ne l'imite.

**Les formants suivent l'ouverture de la gueule.** Fermée, ils sont bas et
serrés ; ouverte, le premier monte et le troisième s'écarte. Les faire bouger
avec l'enveloppe suffit à ce qu'on « voie » la gueule s'ouvrir.

Le cri est ensuite porté dans la bande qu'un téléphone restitue. Un rugissement
dont toute l'énergie vit sous 400 Hz est un silence sur l'appareil où la vidéo
sera regardée : ce sont les formants, entre 1,5 et 4 kHz, qui portent
l'agressivité — et c'est exactement là que la membrane est la plus efficace.

Usage :
    python3 cri_dragon.py --ecouter          # les cinq caractères, à la suite
    python3 cri_dragon.py --caractere colere --duree 2.0 --sortie cri.wav
"""

from __future__ import annotations

import argparse
import math
import wave
from pathlib import Path

import numpy as np

TAUX = 48000

# Cinq caractères, et ce qui les distingue vraiment.
#
# Ce ne sont pas des réglages de goût : chaque ligne décrit une anatomie. Une
# grosse bête a une gorge longue — formants bas, fondamentale basse, descente
# lente. Une bête vive a une gorge courte — tout monte, et la déchirure aussi.
CARACTERES = {
    "colere":   dict(f0=78,  glissando=-0.34, formants=(320, 1150, 2600), ouverture=1.00,
                     sous_harmonique=0.62, souffle=0.30, attaque=0.05),
    "abyssal":  dict(f0=46,  glissando=-0.22, formants=(210,  780, 1900), ouverture=0.75,
                     sous_harmonique=0.78, souffle=0.20, attaque=0.14),
    "strident": dict(f0=132, glissando=+0.18, formants=(520, 1700, 3600), ouverture=1.20,
                     sous_harmonique=0.34, souffle=0.46, attaque=0.03),
    "machine":  dict(f0=61,  glissando=-0.10, formants=(280, 1400, 3100), ouverture=0.85,
                     sous_harmonique=0.90, souffle=0.14, attaque=0.02),
    "blesse":   dict(f0=94,  glissando=-0.52, formants=(400, 1250, 2350), ouverture=0.90,
                     sous_harmonique=0.50, souffle=0.55, attaque=0.09),
}


def _glotte(n: int, f0: np.ndarray, sous: float, graine: int) -> np.ndarray:
    """Une source glottique : impulsions asymétriques, et une sur deux affaiblie.

    L'asymétrie — montée en puissance 2, fermeture abrupte — est ce qui crée le
    spectre riche d'une vraie corde vocale. Le sous-harmonique s'obtient en
    atténuant une période sur deux : la hauteur perçue tombe d'une octave sans
    que la fondamentale bouge, et c'est ce dédoublement qu'on entend comme un
    grognement plutôt que comme une note.
    """
    rng = np.random.default_rng(graine)
    # Un peu de tremblement : une fréquence parfaitement stable sonne électronique.
    jitter = 1 + 0.022 * np.cumsum(rng.normal(0, 1, n)) / max(math.sqrt(n), 1)
    phase = np.cumsum(f0 * jitter) / TAUX
    cycle = phase % 1.0
    onde = np.where(cycle < 0.62, (cycle / 0.62) ** 2, 1 - (cycle - 0.62) / 0.38)
    onde = onde * 2 - 1
    if sous > 0:
        pair = (np.floor(phase) % 2 == 0)
        onde = onde * np.where(pair, 1.0, 1.0 - sous)
    return onde


def _formant(x: np.ndarray, centre: np.ndarray, q: float) -> np.ndarray:
    """Un formant qui **se déplace** : filtre résonant à deux pôles, par échantillon.

    Un filtre fixe donnerait une voyelle tenue. Ici le centre suit l'ouverture
    de la gueule, et c'est ce mouvement qui se lit comme un mouvement de mâchoire.
    """
    y = np.zeros_like(x)
    y1 = y2 = 0.0
    for i in range(len(x)):
        w = 2 * math.pi * centre[i] / TAUX
        r = math.exp(-w / (2 * q))
        a1 = 2 * r * math.cos(w)
        a2 = -r * r
        y0 = (1 - r) * x[i] + a1 * y1 + a2 * y2
        y[i] = y0
        y2, y1 = y1, y0
    return y



def _espace(duree_s: float, taille: float, graine: int) -> np.ndarray:
    """La réponse d'un lieu : quelques réflexions franches, puis une traîne.

    C'est ce qui manque le plus à un cri de synthèse. Un son sec se lit comme
    un échantillon posé sur l'image ; le même son dans un lieu se lit comme un
    animal *quelque part*. Les premières réflexions donnent la taille du lieu —
    plus elles tardent, plus il est grand — et la traîne exponentielle filtrée
    donne sa matière : la roche renvoie le médium, elle avale l'aigu.

    On la fabrique plutôt que de l'échantillonner : aucun fichier à versionner,
    et la taille du lieu devient un réglage.
    """
    n = int(duree_s * TAUX)
    rng = np.random.default_rng(graine)
    ri = np.zeros(n)

    # Les réflexions franches : les murs, à des distances irrégulières.
    for retard_ms, gain in ((17, 0.62), (29, 0.48), (41, 0.39), (67, 0.31),
                            (89, 0.24), (127, 0.18)):
        i = int(retard_ms * taille * TAUX / 1000)
        if i < n:
            ri[i] += gain * (1 if rng.random() > 0.3 else -1)

    # La traîne : un bruit qui s'éteint, et dont l'aigu s'éteint plus vite.
    t = np.arange(n) / TAUX
    traine = rng.normal(0, 1, n) * np.exp(-3.2 * t / max(duree_s * taille, 0.1))
    sp = np.fft.rfft(traine)
    f = np.fft.rfftfreq(n, 1 / TAUX)
    sp *= 1 / (1 + (f / 2600) ** 1.5)      # la roche mange le haut
    sp *= np.where(f < 90, (f / 90) ** 2, 1.0)
    ri += np.fft.irfft(sp, n) * 0.5

    return ri / (np.max(np.abs(ri)) or 1)


def _convoluer(x: np.ndarray, ri: np.ndarray) -> np.ndarray:
    """Convolution par FFT : une multiplication vaut mieux qu'un million de tours."""
    n = 1
    while n < len(x) + len(ri):
        n *= 2
    y = np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ri, n), n)[:len(x) + len(ri)]
    return y


def _inspiration(duree: float, graine: int) -> np.ndarray:
    """Le souffle qui précède. Deux dixièmes de seconde qui changent tout.

    Une bête inspire avant de crier. Sans cette prise d'air, le cri commence
    de nulle part et l'oreille le classe comme un effet ; avec elle, elle le
    classe comme un être vivant. C'est le détail le moins cher du métier.
    """
    n = int(duree * TAUX)
    rng = np.random.default_rng(graine)
    t = np.arange(n) / TAUX
    air = rng.normal(0, 1, n)
    sp = np.fft.rfft(air)
    f = np.fft.rfftfreq(n, 1 / TAUX)
    sp *= np.exp(-((f - 900) / 700) ** 2) + 0.4 * np.exp(-((f - 2400) / 1500) ** 2)
    air = np.fft.irfft(sp, n)
    return air * (t / duree) ** 1.6 / (np.max(np.abs(air)) or 1)


def crier(caractere: str = "colere", duree: float = 1.8, graine: int = 7) -> np.ndarray:
    if caractere not in CARACTERES:
        raise SystemExit(f"Caractère inconnu : {caractere}. "
                         f"Au choix : {', '.join(CARACTERES)}.")
    p = CARACTERES[caractere]
    n = int(duree * TAUX)
    t = np.arange(n) / TAUX
    rng = np.random.default_rng(graine)

    # L'enveloppe est aussi l'ouverture de la gueule : attaque, tenue, fermeture.
    montee = np.minimum(1.0, t / max(p["attaque"], 1e-3))
    chute = np.exp(-2.4 * np.maximum(0, t - duree * 0.55) / max(duree * 0.45, 1e-3))
    enveloppe = montee * chute
    ouverture = enveloppe * p["ouverture"]

    # La hauteur glisse : un cri qui tient sa note est un instrument, pas une bête.
    f0 = p["f0"] * (1 + p["glissando"] * (t / duree))
    source = _glotte(n, f0, p["sous_harmonique"], graine)

    # Le souffle traverse la gueule ouverte, donc il suit l'ouverture.
    bruit = rng.normal(0, 1, n) * ouverture
    source = source * (1 - p["souffle"]) + bruit * p["souffle"]

    # Les trois formants s'écartent quand la gueule s'ouvre.
    f1, f2, f3 = p["formants"]
    voix = (1.00 * _formant(source, f1 * (1 + 0.45 * ouverture), 7.0)
            + 0.70 * _formant(source, f2 * (1 + 0.28 * ouverture), 9.0)
            + 0.45 * _formant(source, f3 * (1 + 0.16 * ouverture), 11.0))

    # La saturation se met sur la SOURCE, pas sur la sortie : un conduit vocal
    # ne distord pas, c'est le larynx qui force. Saturer après les formants
    # donne le grésillement numérique qu'on cherche justement à éviter.
    voix = np.tanh(1.9 * voix)
    voix *= enveloppe

    # Le grave qu'aucun téléphone ne rend est retiré, et la bande des formants
    # relevée : c'est là que vit l'agressivité et c'est là qu'on entend.
    sp = np.fft.rfft(voix)
    f = np.fft.rfftfreq(n, 1 / TAUX)
    sp *= np.where(f < 55, (f / 55) ** 2, 1.0)
    sp *= 1 + 0.9 * np.exp(-((f - 2200) / 1400) ** 2)
    voix = np.fft.irfft(sp, n)

    # Puis la parade du dépôt, déjà éprouvée : on ne remonte pas le grave, on
    # lui fabrique ses harmoniques. Sans elle, un cri de grosse bête mesure
    # 4 % d'énergie au-dessus de 400 Hz — c'est-à-dire un silence sur le
    # haut-parleur où la vidéo sera regardée.
    import sys as _sys
    _chemin = str(Path(__file__).resolve().parents[1]
                  / ".claude" / "skills" / "bande-son" / "scripts")
    if _chemin not in _sys.path:
        _sys.path.insert(0, _chemin)
    from bruitages import porter_sur_telephone
    voix = porter_sur_telephone(voix, poids=1.0)

    crete = np.max(np.abs(voix)) or 1.0
    return voix / crete * 0.94



def crier_cinema(caractere: str = "colere", duree: float = 2.2,
                 graine: int = 7, taille_lieu: float = 1.0) -> np.ndarray:
    """Le cri de cinéma : trois octaves, une inspiration, une queue, un lieu.

    Un cri seul, même bien synthétisé, sonne « effet sonore ». Ce qui fait le
    cinéma tient en quatre gestes que le métier applique depuis toujours :

    **Trois couches à des octaves différentes.** La basse donne la masse — on
    la ressent plus qu'on ne l'entend —, la médiane porte le cri, l'aiguë donne
    les dents. Décalées de quelques millisecondes, elles cessent d'être un même
    son additionné trois fois pour devenir une seule bête épaisse.

    **Une inspiration avant.** Voir plus haut : c'est elle qui fait « vivant ».

    **Une queue qui se casse.** Un vrai cri ne s'éteint pas proprement : il
    finit en grognement, plus grave et plus court. S'arrêter net est la
    signature d'un échantillon.

    **Un lieu.** Le geste le plus payant de tous. `taille_lieu` va de 0,4 —
    une salle — à 2,0 — un canyon.
    """
    corps = crier(caractere, duree, graine)
    n = len(corps)

    # Les trois octaves. Le rééchantillonnage transpose ET allonge : on
    # recadre à la longueur du corps, ce qui donne aussi le léger décalage
    # d'attaque qui épaissit l'ensemble.
    def transposer(x, facteur):
        idx = np.arange(0, len(x), facteur)
        y = np.interp(idx, np.arange(len(x)), x)
        if len(y) < n:
            y = np.pad(y, (0, n - len(y)))
        return y[:n]

    grave = transposer(corps, 0.5)      # une octave dessous : la masse
    aigu = transposer(corps, 2.0)       # une octave dessus : les dents
    voix = 0.48 * grave + 1.00 * corps + 0.52 * aigu

    # La queue : le même caractère, plus grave et deux fois plus court.
    queue = crier(caractere, duree * 0.45, graine + 31) * 0.42
    queue = transposer(queue, 0.62)[:len(queue)]

    # L'inspiration, posée AVANT le cri.
    souffle = _inspiration(0.28, graine + 11) * 0.34

    total = np.zeros(len(souffle) + n + len(queue))
    total[:len(souffle)] += souffle
    total[len(souffle):len(souffle) + n] += voix
    depart = len(souffle) + int(n * 0.86)
    total[depart:depart + len(queue)] += queue

    # Le lieu, en dernier — un espace s'applique à la scène entière, jamais à
    # un élément. Et on garde du son direct : tout mouiller éloigne la bête.
    ri = _espace(2.4, taille_lieu, graine + 3)
    mouille = _convoluer(total, ri)[:len(total)]
    mouille /= (np.max(np.abs(mouille)) or 1)
    sortie = 0.72 * total / (np.max(np.abs(total)) or 1) + 0.46 * mouille

    # La parade téléphone se repasse APRÈS l'empilage, et c'est important :
    # l'octave grave qui donne la masse dilue les dents du cri. Sans ce second
    # passage, on gagne du cinéma sur une enceinte et on le perd sur l'appareil
    # où la vidéo sera vue — exactement le compromis qu'on refuse.
    import sys as _s
    _c = str(Path(__file__).resolve().parents[1]
             / ".claude" / "skills" / "bande-son" / "scripts")
    if _c not in _s.path:
        _s.path.insert(0, _c)
    from bruitages import porter_sur_telephone
    sortie = porter_sur_telephone(sortie, poids=0.9)

    return sortie / (np.max(np.abs(sortie)) or 1) * 0.94


def ecrire(chemin: Path, son: np.ndarray) -> None:
    with wave.open(str(chemin), "w") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(TAUX)
        f.writeframes((np.clip(son, -1, 1) * 32767).astype(np.int16).tobytes())


def mesurer(son: np.ndarray) -> str:
    """Ce qu'un téléphone en restitue, et si le cri respire."""
    sp = np.abs(np.fft.rfft(son))
    f = np.fft.rfftfreq(len(son), 1 / TAUX)
    total = np.sum(sp ** 2) or 1
    entendu = 100 * np.sum(sp[f > 400] ** 2) / total
    dents = 100 * np.sum(sp[(f > 1500) & (f < 4000)] ** 2) / total
    rms = math.sqrt(float(np.mean(son ** 2))) or 1e-9
    crete = 20 * math.log10(float(np.max(np.abs(son))) / rms)
    return f"entendu {entendu:5.1f} %  dents {dents:5.1f} %  facteur {crete:5.1f} dB"


def main() -> int:
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--caractere", default="colere", choices=list(CARACTERES))
    a.add_argument("--duree", type=float, default=1.8)
    a.add_argument("--graine", type=int, default=7)
    a.add_argument("--sortie", default="cri.wav")
    a.add_argument("--lieu", type=float, default=1.0,
                   help="taille du lieu : 0,4 une salle, 1 une grotte, 2 un canyon")
    a.add_argument("--sec", action="store_true",
                   help="sans les couches ni le lieu — le cri nu")
    a.add_argument("--ecouter", action="store_true",
                   help="rend les cinq caractères à la suite, séparés d'un silence")
    o = a.parse_args()

    if o.ecouter:
        morceaux = []
        print(f"\n  {'caractère':10}  ce qu'un téléphone en restitue")
        for nom in CARACTERES:
            s = (crier(nom, o.duree, o.graine) if o.sec
                 else crier_cinema(nom, o.duree, o.graine, o.lieu))
            print(f"  {nom:10}  {mesurer(s)}")
            morceaux += [s, np.zeros(int(0.8 * TAUX))]
        ecrire(Path(o.sortie), np.concatenate(morceaux))
        print(f"\n  Les cinq, dans l'ordre, écrits dans {o.sortie}.")
        print("  « entendu » sous 60 % = le cri vit dans le grave et le "
              "téléphone n'en rendra rien.\n")
        return 0

    son = (crier(o.caractere, o.duree, o.graine) if o.sec
           else crier_cinema(o.caractere, o.duree, o.graine, o.lieu))
    ecrire(Path(o.sortie), son)
    print(f"  {o.caractere} — {mesurer(son)} — {o.sortie}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
