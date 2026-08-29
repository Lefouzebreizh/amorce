#!/usr/bin/env python3
"""Mesurer la cadence **réelle** d'un rush, et non celle qu'il annonce.

Un plan généré annonce souvent trente images par seconde et n'en bouge que
vingt : une image sur deux y est figée d'origine, avec juste assez de bruit
d'encodage pour n'être pas un doublon exact. Rien ne le signale — le fichier
est conforme, `ffprobe` répond 30, et le défaut ne se voit qu'en mouvement
rapide, une fois le montage fini.

Le piège est qu'on corrige ensuite dans le mauvais sens. Conformer le film à
la cadence *annoncée* **double** la saccade : du 20 i/s rendu à 30 donne une
image doublée sur deux, rendu à 24 une sur cinq. Mesuré sur un même plan —
22 % d'images figées et 68 % d'irrégularité à 30, contre 13 % et 51 % à 24.

D'où ce script : relever le mouvement réel **avant** de choisir la cadence du
montage, et refuser un rush dont le mouvement est trop pauvre pour ce qu'on
veut en faire.

Usage :
    python3 cadence_reelle.py rushes/*.mp4
    python3 cadence_reelle.py --tranches plan.mp4   # seconde par seconde
"""

from __future__ import annotations

import argparse
import shutil
import statistics
import subprocess
import sys
from pathlib import Path

# Assez petit pour être rapide, assez grand pour qu'une image figée se
# distingue du bruit d'encodage. Mesuré : à 72 × 128 le bruit noie le signal.
LARGEUR, HAUTEUR = 144, 256

# Une image dont l'écart au précédent tombe sous ce rapport de l'écart moyen
# est tenue pour figée. 0,20 sépare nettement les deux populations sur les
# rushes générés : les vraies images sont au-dessus de 0,5, les figées sous 0,1.
SEUIL_FIGE = 0.20


def ffmpeg() -> str:
    """Le ffmpeg du système d'abord : celui d'`imageio` n'a pas tous les filtres."""
    if Path("/usr/bin/ffmpeg").is_file():
        return "/usr/bin/ffmpeg"
    trouve = shutil.which("ffmpeg")
    if trouve is None:
        raise SystemExit("ffmpeg est introuvable.")
    return trouve


def cadence_annoncee(source: Path) -> float:
    """Ce que le conteneur prétend, et qu'il ne faut pas croire sur parole."""
    sortie = subprocess.run(
        [shutil.which("ffprobe") or "ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", str(source)],
        capture_output=True, text=True).stdout.strip()
    if "/" in sortie:
        haut, bas = sortie.split("/")
        return float(haut) / float(bas or 1)
    return float(sortie or 0)


def ecarts(source: Path) -> list[float]:
    """L'écart moyen entre chaque paire d'images consécutives.

    On décode en gris et en réduit : la couleur n'apporte rien à la détection
    d'une image figée, et le format réduit divise le coût par cinquante sans
    changer le verdict.
    """
    brut = subprocess.run(
        [ffmpeg(), "-v", "error", "-i", str(source),
         "-vf", f"scale={LARGEUR}:{HAUTEUR},format=gray", "-f", "rawvideo", "-"],
        capture_output=True).stdout
    taille = LARGEUR * HAUTEUR
    images = [brut[i * taille:(i + 1) * taille] for i in range(len(brut) // taille)]
    return [sum(abs(a - b) for a, b in zip(images[i], images[i + 1])) / taille
            for i in range(len(images) - 1)]


def mesurer(source: Path) -> dict:
    d = ecarts(source)
    if len(d) < 4:
        return {"source": source.name, "erreur": "trop court ou illisible"}
    moyenne = statistics.mean(d)
    figees = sum(1 for x in d if x < moyenne * SEUIL_FIGE)
    annoncee = cadence_annoncee(source)
    return {
        "source": source.name,
        "annoncee": annoncee,
        "reelle": annoncee * (len(d) - figees) / len(d),
        "figees": 100 * figees / len(d),
        "irregularite": 100 * statistics.pstdev(d) / moyenne if moyenne else 0.0,
        "ecarts": d,
    }


def conseiller(mesures: list[dict]) -> int:
    """La cadence de montage à retenir : celle du plan le plus pauvre.

    Un film se rend à une seule cadence. La choisir au-dessus du mouvement du
    plan le plus pauvre revient à doubler ses images ; la choisir en dessous
    perd du mouvement partout ailleurs. On prend donc la cadence courante la
    plus proche par le bas du plus pauvre des plans.
    """
    reelles = [m["reelle"] for m in mesures if "reelle" in m]
    if not reelles:
        return 24
    pire = min(reelles)
    for palier in (60, 50, 30, 25, 24, 20, 15):
        # 0,90 et non 0,95 : un plan à 22,3 i/s est un 24 avec deux images
        # doublées, pas un 20. Serrer davantage conseillait de descendre
        # tout le film d'un palier pour deux images.
        if pire >= palier * 0.90:
            return palier
    return 15


def main() -> int:
    analyseur = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    analyseur.add_argument("sources", nargs="+")
    analyseur.add_argument("--tranches", action="store_true",
                           help="détailler seconde par seconde")
    a = analyseur.parse_args()

    mesures = []
    print(f"\n  {'rush':34} {'annoncée':>9} {'réelle':>8} {'figées':>8} {'irrég.':>8}")
    print(f"  {'─' * 34} {'─' * 9} {'─' * 8} {'─' * 8} {'─' * 8}")
    for chemin in a.sources:
        m = mesurer(Path(chemin))
        mesures.append(m)
        if "erreur" in m:
            print(f"  {m['source'][:34]:34} {m['erreur']}")
            continue
        alerte = "  ⚠" if m["figees"] > 10 else ""
        print(f"  {m['source'][:34]:34} {m['annoncee']:7.0f} i/s {m['reelle']:6.1f} i/s"
              f" {m['figees']:6.0f} % {m['irregularite']:6.0f} %{alerte}")

        if a.tranches:
            d = m["ecarts"]
            pas = max(1, int(m["annoncee"]))
            moyenne = statistics.mean(d)
            for s in range(len(d) // pas + 1):
                tr = d[s * pas:(s + 1) * pas]
                if not tr:
                    continue
                fig = sum(1 for x in tr if x < moyenne * SEUIL_FIGE)
                print(f"      {s:3d} s  {fig:2d} figée(s)/{len(tr):2d}  {'█' * fig}")

    retenue = conseiller(mesures)
    print(f"\n  Cadence de montage conseillée : {retenue} i/s"
          f"  (le plan le plus pauvre bouge à {min((m['reelle'] for m in mesures if 'reelle' in m), default=0):.1f})")
    print("  Au-dessus, chaque image manquante est doublée et le plan saccade.\n")

    douteux = [m for m in mesures if m.get("figees", 0) > 10]
    if douteux:
        print("  Rushes à régénérer si le mouvement compte — la saccade est dans")
        print("  la source, et aucun montage ne la retire :")
        for m in douteux:
            print(f"    · {m['source']} — {m['figees']:.0f} % d'images figées")
        print()
    return 1 if douteux else 0


if __name__ == "__main__":
    sys.exit(main())
