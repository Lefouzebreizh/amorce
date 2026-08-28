#!/usr/bin/env python3
"""Le carton qui annonce l'épisode suivant, posé sur l'image et non sur du noir.

Un format court qui se termine est un format court qu'on quitte. Un format
court qui annonce le suivant devient un feuilleton, et l'idée ne vient pas
d'ici : un montage concurrent des mêmes rushes la portait déjà.

Son exécution la perdait. Le carton était posé sur du **noir** — 26,2 de
luminance quand le film tournait à 69,8 — soit deux secondes et demie de trou
visuel à l'endroit exact où un spectateur décide de rester ou de partir. Posé
sur la **dernière image du film**, assombrie de moitié et non éteinte, le même
carton garde la créature à l'écran pendant qu'on lit : 38,2 de luminance.

Sa durée, elle, ne se raccourcit pas. Une première version tenait en 1,70 s,
choisie pour battre les 2,4 s du concurrent — et le spectateur n'a pas eu le
temps de lire. **Un carton se mesure au temps de lecture de sa ligne la plus
longue, pas à celui du voisin.** Deux secondes pleines sur le titre, le reste
autour : c'est le plancher, et il vaut 2,8 s de carton.

Les textes sont tracés par `texte_ffmpeg`, comme ceux du film : même ressort à
l'arrivée, même pulsation, même lueur. Un carton dessiné à part se voit
aussitôt comme un ajout.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import monter_episode as M


def carte(film: Path, sortie: Path, lignes: list[dict], duree: float = 2.8,
          bibliotheque: Path | None = None, effets: list | None = None) -> Path:
    """Fabrique le carton à partir de la dernière image de `film`."""
    fin = float(subprocess.run(
        [M.ffmpeg().replace("ffmpeg", "ffprobe"), "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(film)],
        capture_output=True, text=True, check=True).stdout.strip())

    image = sortie.with_suffix(".derniere.png")
    subprocess.run([M.ffmpeg(), "-y", "-v", "error", "-ss", f"{fin - 0.10:.3f}",
                    "-i", str(film), "-frames:v", "1", str(image)], check=True)

    # L'assombrissement retire la moitie de la lumiere et un quart de la
    # couleur. Davantage et l'image redevient un fond noir ; moins et le texte
    # se bat avec elle. Le flou de six pixels, lui, ne sert pas a cacher :
    # il eloigne l'image d'un plan pour que l'oeil accroche le texte d'abord.
    dessin = ["eq=brightness=-0.16:saturation=0.75", "boxblur=6:1"]
    for ligne in lignes:
        dessin.extend(M.texte_ffmpeg(ligne, M.Y_SOUS_TITRE))
    dessin.append(f"fade=t=out:st={duree - 0.35:.2f}:d=0.35")

    muet = sortie.with_suffix(".muet.mkv")
    subprocess.run([
        M.ffmpeg(), "-y", "-v", "error", "-loop", "1", "-t", f"{duree:.3f}",
        "-i", str(image), "-r", str(M.CADENCE),
        "-vf", ",".join(dessin), "-pix_fmt", "yuv420p",
        "-c:v", "libx264", "-crf", "16", str(muet)], check=True)

    if effets and bibliotheque:
        piste = M.couche_effets(effets, bibliotheque, duree,
                                reverberation_s=2.0)
        son = sortie.with_suffix(".son.wav")
        M.sfx_pro.ecrire_wav_24(son, piste, M.TAUX)
        subprocess.run([
            M.ffmpeg(), "-y", "-v", "error", "-i", str(muet), "-i", str(son),
            "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
            "-shortest", str(sortie)], check=True)
    else:
        muet.replace(sortie)
    return sortie


def principal(argv=None) -> int:
    a = argparse.ArgumentParser(description=__doc__)
    a.add_argument("film", type=Path)
    a.add_argument("sortie", type=Path)
    a.add_argument("--duree", type=float, default=2.8)
    p = a.parse_args(argv)
    carte(p.film, p.sortie, [
        {"texte": "THE NEXT CREATURE", "debut": 0.10, "fin": p.duree,
         "y": 830, "taille": 48, "secousse": 5.0},
        {"texte": "THE CYBER HYDRA TITAN", "debut": 0.55, "fin": p.duree,
         "y": 930, "taille": 62, "secousse": 8.0},
        {"texte": "EPISODE 02", "debut": 1.10, "fin": p.duree,
         "y": 1060, "taille": 44, "secousse": 4.0},
    ], duree=p.duree)
    print(f"→ {p.sortie}")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
