#!/usr/bin/env python3
"""Mastering aux normes TikTok : −14 LUFS, vrai pic −1,0 dBTP.

Cible différente de celle de `master-telephone`, et il faut savoir laquelle on
veut. Celle-ci vise la **norme de plateforme** : le fichier passe la
normalisation de TikTok sans être rebaissé, et sonne juste sur un casque.
`master-telephone` vise le **haut-parleur du téléphone**, où rien ne passe sous
400 Hz : il pousse à −12 LUFS et travaille la présence à 2,2 et 4,2 kHz.

Écart mesuré entre les deux sur le même montage : 1,8 dB de sonie et 1,4 dB de
niveau entendu au-dessus de 400 Hz. Choisir n'est pas indifférent.

## Sur le compresseur

Il est ici, il fonctionne, et il est **désactivé par défaut**. Ce n'est pas une
préférence de style :

- Un compresseur ne rend pas un mixage plus fort, il rend le mixage *déjà
  fort* moins dynamique. Le gain se gagne en marge et en présence.
- Ce dépôt a déjà payé la leçon deux fois : un `loudnorm` en une passe — qui
  est un compresseur — a écrasé un impact de −1,4 à −24 dB ; et un limiteur
  poussé de cinq décibels a fait varier son gain de +1,0 à +6,1 dB selon
  l'instant, ce que l'oreille rapporte comme une coupure au milieu du son.
- Surtout : quand un mixage paraît saturé, c'est presque toujours du
  **masquage** — trop de sources à la fois — et le compresseur l'aggrave, en
  remontant précisément ce qui masque pendant les creux.

`--compresseur` l'active pour qui veut l'entendre, et le tableau final dit ce
qu'il a coûté en dynamique. Si le chiffre baisse de plus de 2 LU, c'est qu'il
travaille trop.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from monter_episode import ffmpeg

MOYEN = re.compile(r"mean_volume:\s*(-?\d+\.?\d*) dB")


def entendu(media: Path) -> float:
    """Le niveau moyen de ce qu'un haut-parleur de téléphone restitue."""
    rendu = subprocess.run(
        [ffmpeg(), "-hide_banner", "-nostats", "-i", str(media),
         "-af", "highpass=f=400,volumedetect", "-f", "null", "-"],
        capture_output=True, text=True)
    trouve = MOYEN.search(rendu.stderr)
    return float(trouve.group(1)) if trouve else -180.0


def sonder(media: Path) -> tuple[float, float, float]:
    """Sonie intégrée, plage, vrai pic — par `loudnorm` en mode analyse."""
    rendu = subprocess.run(
        [ffmpeg(), "-hide_banner", "-nostats", "-i", str(media),
         "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json",
         "-f", "null", "-"], capture_output=True, text=True)
    bloc = re.search(r"\{[^{}]*\"input_i\"[\s\S]*?\}", rendu.stderr)
    if not bloc:
        raise SystemExit(f"{media} : impossible de mesurer la sonie "
                         f"(piste audio absente ?)")
    r = json.loads(bloc.group(0))
    return (float(r["input_i"]), float(r["input_lra"]), float(r["input_tp"]))


def chaine(gain_db: float, *, grave: float = 1.5, plafond_hz: int = 9000,
           plancher_hz: int = 30, compresseur: bool = False,
           presence: float = 3.5) -> str:
    """La chaîne, dans l'ordre où chaque maillon doit venir.

    L'ordre n'est pas décoratif. Les filtres de nettoyage passent **avant** le
    gain, sinon on amplifie ce qu'on s'apprête à retirer et le limiteur voit
    des crêtes qui n'existeront plus. Le limiteur passe **en dernier**, seul à
    toucher au plafond ; deux étages qui limitent se battent, et c'est cette
    lutte qu'on entend pomper.
    """
    maillons = [
        # Coupe-bas : sous 30 Hz il n'y a que du souffle de rendu et du
        # deplacement de membrane. Rien ne s'y entend, tout y coute de la marge.
        f"highpass=f={plancher_hz}:poles=2",
        # Le poids : une cloche LARGE (Q bas) sur 60-120 Hz. Un Q eleve
        # fabriquerait une note, pas du poids — on entendrait un bourdon
        # accorde sous chaque impact.
        #
        # +1,5 dB et non +4,5, et c'est mesure : a +4,5 le limiteur ecrasait
        # **44 tranches sur 389** de plus d'un decibel, avec ses coups les plus
        # forts exactement aux deux endroits ou la saturation etait rapportee.
        # A +1,5 : **8 tranches**, et le niveau ENTENDU au-dessus de 400 Hz
        # GAGNE 0,4 dB. Le grave ne s'entend pas sur un telephone ; il ne fait
        # qu'y manger la marge, et c'est le limiteur qui rend la facture — sur
        # tout le reste du mixage.
        f"equalizer=f=85:t=q:w=0.8:g={grave}",
        # Les aigus agressifs : au-dessus de 9 kHz il n'y a plus d'information,
        # seulement l'arete des transitoires de synthese. Pente douce a 1 pole,
        # une pente raide s'entend comme une couverture posee sur le son.
        f"lowpass=f={plafond_hz}:poles=1",
    ]
    if presence:
        # Sans cet etage, un master aux normes de plateforme sort correct au
        # casque et FAIBLE sur un telephone : mesure sur ce montage, -22,6 dB
        # entendus au-dessus de 400 Hz contre -18,4 avec presence. Le grave
        # ajoute plus haut n'y change rien — l'appareil ne le restitue pas, il
        # ne fait que manger la marge que le limiteur rendra.
        #
        # 2,2 kHz porte l'intelligibilite, 4,2 kHz l'arete des transitoires.
        # Deux cloches etroites, pas un rehaut large : large, cela devient un
        # sifflement, et sur les voix c'est immediat.
        maillons += [f"equalizer=f=2200:t=q:w=1.1:g={presence}",
                     f"equalizer=f=4200:t=q:w=1.3:g={presence * 0.7:.1f}"]
    if compresseur:
        # Seuil haut et rapport bas : il ne doit rattraper que les ecarts
        # extremes, pas sculpter le mixage. `attack=12` laisse passer l'attaque
        # des impacts — c'est elle qui fait qu'on les entend.
        maillons.append("acompressor=threshold=-18dB:ratio=2.5:"
                        "attack=12:release=260:makeup=1")
    maillons.append(f"volume={gain_db:.2f}dB")
    # -1,0 dBTP demande : on limite a -1,7 dBFS. La marge n'est pas de la
    # prudence, elle est mesuree — l'encodage AAC fabrique des crêtes
    # inter-echantillons qui n'existent pas dans le signal, et un limiteur pose
    # a -1,3 rendait -0,8 dBTP en sortie.
    maillons.append("alimiter=limit=0.82:level=disabled")
    return ",".join(maillons)


def masteriser(entree: Path, sortie: Path, *, cible: float = -14.0,
               grave: float = 1.5, plafond_hz: int = 9000,
               plancher_hz: int = 30, compresseur: bool = False,
               presence: float = 3.5) -> dict:
    """Deux passes : on mesure, on applique UN gain, on limite.

    Une seule passe de `loudnorm` ferait le travail en apparence — et c'est un
    compresseur déguisé, qui applique un gain variable dans le temps. Mesurer
    d'abord puis poser un gain constant garde le mixage intact.
    """
    if not entree.is_file():
        raise SystemExit(f"Introuvable : {entree}")
    avant = sonder(entree)
    avant_entendu = entendu(entree)

    # Deux rendus, et le second n'est pas du zele. Le gain se calcule sur la
    # sonie MESUREE AVANT les egaliseurs — or ceux-ci ajoutent de la sonie a
    # leur tour : +4 dB de grave et deux cloches de presence ont fait sortir a
    # -10,7 LUFS une cible posee a -12,5. Un ecart de 1,8 dB qu'aucune formule
    # ne predit, parce qu'il depend du contenu spectral du mixage.
    # On rend, on remesure, on corrige d'autant. Une seule correction suffit :
    # le second passage part d'un ecart deja inferieur au dixieme de decibel.
    gain = cible - avant[0]
    for _ in range(2):
        filtre = chaine(gain, grave=grave, plafond_hz=plafond_hz,
                        plancher_hz=plancher_hz, compresseur=compresseur,
                        presence=presence)
        subprocess.run(
            [ffmpeg(), "-y", "-v", "error", "-i", str(entree), "-af", filtre,
             "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-ar", "48000",
             "-movflags", "+faststart", str(sortie)], check=True)
        apres = sonder(sortie)
        ecart = cible - apres[0]
        if abs(ecart) < 0.15:
            break
        gain += ecart
    return {"filtre": filtre, "gain": gain,
            "avant": (*avant, avant_entendu),
            "apres": (*apres, entendu(sortie))}


def rapport(r: dict) -> None:
    print(f"\n  chaîne : {r['filtre']}")
    print(f"  gain posé : {r['gain']:+.2f} dB\n")
    print(f"  {'':30s}{'avant':>9s}{'après':>9s}")
    for nom, i in (("sonie (LUFS)", 0), ("dynamique (LU)", 1),
                   ("vrai pic (dBTP)", 2), ("ENTENDU >400 Hz", 3)):
        print(f"  {nom:30s}{r['avant'][i]:9.1f}{r['apres'][i]:9.1f}")
    perte = r["avant"][1] - r["apres"][1]
    if perte > 2.0:
        print(f"\n  ⚠ {perte:.1f} LU de dynamique perdus : le mixage est "
              f"écrasé. Baisser le grave ou couper le compresseur.")
    if r["apres"][2] > -1.0:
        print(f"\n  ⚠ vrai pic à {r['apres'][2]:.1f} dBTP, au-dessus "
              f"des −1,0 demandés.")


def principal(argv=None) -> int:
    a = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("entree", type=Path)
    a.add_argument("sortie", type=Path)
    a.add_argument("--lufs", type=float, default=-14.0)
    a.add_argument("--grave", type=float, default=1.5,
                   help="relèvement 60-120 Hz en dB (défaut : 4)")
    a.add_argument("--plafond", type=int, default=9000,
                   help="coupe-haut en Hz (défaut : 9000)")
    a.add_argument("--plancher", type=int, default=30,
                   help="coupe-bas en Hz (défaut : 30)")
    a.add_argument("--presence", type=float, default=3.5,
                   help="relèvement 2,2 kHz en dB — ce qui rend audible sur "
                        "un haut-parleur de téléphone (défaut : 3,5 ; 0 pour "
                        "un master casque strict)")
    a.add_argument("--compresseur", action="store_true",
                   help="ajoute un acompressor doux (désactivé par défaut, "
                        "voir l'en-tête du fichier)")
    o = a.parse_args(argv)
    rapport(masteriser(o.entree, o.sortie, cible=o.lufs, grave=o.grave,
                       plafond_hz=o.plafond, plancher_hz=o.plancher,
                       compresseur=o.compresseur, presence=o.presence))
    print(f"\n→ {o.sortie}")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
