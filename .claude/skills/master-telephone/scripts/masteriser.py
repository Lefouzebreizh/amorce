#!/usr/bin/env python3
"""Sort un fichier au niveau d'un téléphone, et prouve ce qu'il a gagné.

Le script mesure avant, applique la chaîne, mesure après, et rend le tableau.
Sans le tableau on ne saurait pas si le gain a coûté la dynamique — et c'est
précisément le compromis qu'on cherche à éviter.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path

MOYEN = re.compile(r"mean_volume:\s*(-?[\d.]+)")


def ffmpeg() -> str:
    return "/usr/bin/ffmpeg" if Path("/usr/bin/ffmpeg").is_file() else "ffmpeg"


def sonie(media: Path) -> tuple[float, float, float]:
    rendu = subprocess.run(
        [ffmpeg(), "-hide_banner", "-nostats", "-i", str(media), "-af",
         "loudnorm=I=-14:TP=-1:print_format=json", "-f", "null", "-"],
        capture_output=True, text=True)
    depart = rendu.stderr.rfind("{")
    fin = rendu.stderr.rfind("}")
    if depart == -1 or fin < depart:
        return 0.0, 0.0, 0.0
    # Il faut couper à l'accolade fermante, pas seulement partir de l'ouvrante :
    # certaines compilations de ffmpeg impriment encore des lignes après le
    # relevé, et json.loads échoue alors sur « Extra data » — une panne qui
    # ressemble à un fichier illisible alors que la mesure, elle, a réussi.
    releve = json.loads(rendu.stderr[depart:fin + 1])
    return (float(releve["input_i"]), float(releve["input_lra"]),
            float(releve["input_tp"]))


def entendu(media: Path) -> float:
    """Le niveau au-dessus de 400 Hz : ce qu'un téléphone restitue vraiment."""
    rendu = subprocess.run(
        [ffmpeg(), "-hide_banner", "-nostats", "-i", str(media),
         "-af", "highpass=f=400,volumedetect", "-f", "null", "-"],
        capture_output=True, text=True)
    trouve = MOYEN.search(rendu.stderr)
    return float(trouve.group(1)) if trouve else -180.0


def masteriser(entree: Path, sortie: Path, gain: float = 5.0,
               presence: float = 3.5, plancher: int = 55) -> None:
    chaine = (
        f"highpass=f={plancher}:poles=2,"
        f"equalizer=f=2200:t=q:w=1.1:g={presence},"
        f"equalizer=f=4200:t=q:w=1.3:g={presence * 0.7:.1f},"
        f"volume={gain}dB,"
        "alimiter=limit=0.891:level=disabled"
    )
    subprocess.run([ffmpeg(), "-y", "-v", "error", "-i", str(entree), "-af", chaine,
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-ar", "48000",
                    "-movflags", "+faststart", str(sortie)], check=True)


def main() -> int:
    a = argparse.ArgumentParser(description="Master téléphone d'une vidéo.")
    a.add_argument("entree")
    a.add_argument("sortie")
    a.add_argument("--gain", type=float, default=5.0,
                   help="décibels linéaires ajoutés (défaut : 5)")
    a.add_argument("--presence", type=float, default=3.5,
                   help="relèvement à 2,2 kHz (défaut : 3,5)")
    o = a.parse_args()
    entree, sortie = Path(o.entree).expanduser(), Path(o.sortie).expanduser()

    avant = (*sonie(entree), entendu(entree))
    masteriser(entree, sortie, o.gain, o.presence)
    apres = (*sonie(sortie), entendu(sortie))

    print(f"\n  {'':<26}{'avant':>9}{'après':>9}")
    for nom, i in (("sonie (LUFS)", 0), ("dynamique (LU)", 1),
                   ("vrai pic (dBTP)", 2), ("ENTENDU >400 Hz", 3)):
        print(f"  {nom:<26}{avant[i]:>9.1f}{apres[i]:>9.1f}")
    print(f"\n  gagné là où on écoute : {apres[3] - avant[3]:+.1f} dB")

    if apres[1] < avant[1] - 4:
        print("  ⚠ la dynamique a chuté de plus de 4 LU — l'arc du montage est "
              "en train d'être écrasé. Baisser --gain plutôt que compresser.")
    if apres[0] > -8.5:
        print("  ⚠ au-delà de −8,5 LUFS les plateformes rebaissent le fichier : "
              "la marge est perdue sans rien gagner.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
