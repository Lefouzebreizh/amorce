"""
Le plan le plus fort est-il bien le climax ?

`CLAUDE.md` §8 pose la règle depuis longtemps : « le niveau entendu section par
section, filtré au-dessus de 400 Hz. Le climax doit être le plus fort — s'il ne
l'est pas, c'est le défaut, quelle que soit la sonie globale. » **Rien ne la
mesurait.** `voir.py` dessine le son, `masteriser.py` corrige son niveau
global : ni l'un ni l'autre ne compare les plans entre eux.

Mesuré le 30/08/2026 sur un export réel de 13,84 s : le vortex à 10-11 s
culminait à −15,1 dB quand le rugissement final, le climax, restait à
−21,7 dB. **Six virgule six décibels sous le plan qui le précédait.** La sonie
globale était pourtant correcte, et aucune des mesures habituelles ne l'a dit.

Pourquoi filtrer à 400 Hz, et pas mesurer le niveau brut : un haut-parleur de
téléphone ne restitue à peu près rien en dessous. Un climax dont toute
l'énergie vit dans le grave est fort sur un casque et absent là où la vidéo
sera regardée. C'est le même sol que `voir.py` trace en rouge.

    python3 climax.py sortie.mp4
    python3 climax.py sortie.mp4 --climax 12.4
    python3 climax.py sortie.mp4 --marge 1.5

Sort en 1 quand la règle est enfreinte, pour pouvoir barrer une publication.
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

# Le sol d'un haut-parleur de téléphone. Même valeur que `voir.py` : deux
# planchers pour la même notion, c'est celui qu'on oublie qui devient faux.
SOL_TELEPHONE = 400

# En deçà, l'écart ne s'entend pas et le signaler ferait crier le contrôle sur
# des montages sains — un filet qui crie pour rien finit désactivé.
MARGE_DB = 1.0

MOYEN = re.compile(r"mean_volume:\s*(-?\d+(?:\.\d+)?) dB")
TEMPS = re.compile(r"pts_time:(\d+(?:\.\d+)?)")


def ffmpeg() -> str:
    return "/usr/bin/ffmpeg" if Path("/usr/bin/ffmpeg").is_file() else "ffmpeg"


def duree(media: Path) -> float:
    rendu = subprocess.run([ffmpeg(), "-hide_banner", "-i", str(media)],
                           capture_output=True, text=True)
    trouve = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", rendu.stderr)
    if not trouve:
        return 0.0
    h, m, s = trouve.groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def coupes(media: Path, fin: float) -> list[tuple[float, float]]:
    """
    Les plans, tels que le fichier les porte.

    On découpe aux changements de plan plutôt qu'en tranches d'une seconde :
    c'est le plan qui est fort ou faible, pas la seconde. Un seuil bas attrape
    aussi les fondus — d'où la fusion des morceaux trop courts juste après,
    sans quoi une transition serait comptée comme un plan et rendrait un
    maximum qui n'existe pas.
    """
    rendu = subprocess.run(
        [ffmpeg(), "-hide_banner", "-i", str(media),
         "-vf", "select='gt(scene,0.10)',showinfo", "-f", "null", "-"],
        capture_output=True, text=True)
    bornes = [0.0] + [float(t) for t in TEMPS.findall(rendu.stderr)] + [fin]

    plans, depart = [], 0.0
    for borne in bornes[1:]:
        if borne - depart >= 0.5:
            plans.append((depart, borne))
            depart = borne
    if not plans:
        return [(0.0, fin)]
    # Ce qui reste après la dernière coupe appartient au dernier plan.
    if fin - plans[-1][1] > 0.01:
        plans[-1] = (plans[-1][0], fin)
    return plans


def entendu(media: Path, depart: float, longueur: float) -> float:
    """Le niveau au-dessus de 400 Hz sur un morceau — ce qu'un téléphone rend."""
    rendu = subprocess.run(
        [ffmpeg(), "-hide_banner", "-nostats", "-ss", f"{depart}",
         "-t", f"{longueur}", "-i", str(media),
         "-af", f"highpass=f={SOL_TELEPHONE},volumedetect", "-f", "null", "-"],
        capture_output=True, text=True)
    trouve = MOYEN.search(rendu.stderr)
    return float(trouve.group(1)) if trouve else -180.0


def main() -> int:
    lecteur = argparse.ArgumentParser(description=__doc__)
    lecteur.add_argument("media", type=Path)
    lecteur.add_argument("--climax", type=float, default=None,
                         help="instant du climax, en secondes. Par défaut, le dernier plan.")
    lecteur.add_argument("--marge", type=float, default=MARGE_DB,
                         help=f"écart toléré en dB (défaut {MARGE_DB}).")
    args = lecteur.parse_args()

    if not args.media.is_file():
        print(f"✗ Fichier introuvable : {args.media}")
        return 1

    fin = duree(args.media)
    if fin <= 0:
        print("✗ Durée illisible : ffmpeg n’a pas reconnu ce fichier.")
        return 1

    plans = coupes(args.media, fin)
    niveaux = [entendu(args.media, a, b - a) for a, b in plans]

    # Le climax est le dernier plan, sauf indication contraire : c'est là que
    # le format court place sa chute. On ne le devine pas au niveau — ce serait
    # circulaire, le plus fort serait climax par définition.
    if args.climax is None:
        index = len(plans) - 1
    else:
        index = next((i for i, (a, b) in enumerate(plans) if a <= args.climax < b), len(plans) - 1)

    print(f"── Le climax est-il le plan le plus fort ? · {args.media.name}\n")
    plus_fort = max(range(len(plans)), key=lambda i: niveaux[i])
    for i, ((a, b), n) in enumerate(zip(plans, niveaux)):
        marques = []
        if i == index:
            marques.append("climax")
        if i == plus_fort:
            marques.append("le plus fort")
        print(f"  {a:6.2f} → {b:6.2f} s   {n:7.1f} dB   {' · '.join(marques)}")

    ecart = niveaux[plus_fort] - niveaux[index]
    print()
    if plus_fort == index or ecart <= args.marge:
        print(f"  ✓ Le climax tient le haut du montage (écart {ecart:.1f} dB).")
        return 0

    a, b = plans[plus_fort]
    print(f"  ✗ Le climax est {ecart:.1f} dB sous le plan de {a:.2f} à {b:.2f} s.\n")
    print("  Ce n’est pas une affaire de sonie globale : filtré au-dessus de")
    print(f"  {SOL_TELEPHONE} Hz, c’est ce qu’un téléphone restitue vraiment. Le spectateur")
    print("  entendra le milieu du film plus fort que sa chute.\n")
    print("  Baisser le plan trop fort vaut mieux que monter le climax : monter")
    print("  fait travailler le limiteur, qui écrase précisément ce qu’on voulait")
    print("  faire ressortir.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
