#!/usr/bin/env python3
"""Mesurer un fichier son ou vidéo avant d'y toucher.

Trois décisions tiennent ce fichier :

1. **La mesure passe par `loudnorm` en analyse, pas par `ebur128`.** Les deux
   rendent la loudness, mais `loudnorm` rend en plus les quatre valeurs que la
   seconde passe de normalisation attend (`measured_I`, `measured_TP`,
   `measured_LRA`, `measured_thresh`). Mesurer avec l'un pour appliquer avec
   l'autre obligerait à mesurer deux fois.
2. **Aucune dépendance à `ffprobe`.** Le ffmpeg livré par `imageio-ffmpeg` ne
   l'embarque pas, et c'est celui qu'on trouve sur une machine où rien n'a été
   installé. La durée se lit dans l'en-tête que `ffmpeg -i` écrit de toute façon.
3. **Les passages parlés sont déduits des silences.** Repérer la parole
   directement demanderait un modèle ; l'inverse d'un silence est une
   approximation qui suffit à savoir où la musique doit plonger.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

SEUIL_SILENCE_DB = -30      # sous ce niveau, on considère qu'il ne se dit rien
DUREE_SILENCE_MIN_S = 0.35  # plus court, c'est une respiration, pas un blanc


def trouver_ffmpeg() -> str:
    """Rend un ffmpeg utilisable, celui du système de préférence.

    Même ordre que `mon-app-audio/core/mixeur.py` : un ffmpeg installé par
    l'utilisateur connaît ses codecs et ses réglages, celui du paquet Python
    n'est qu'un filet.
    """
    chemin = shutil.which("ffmpeg")
    if chemin:
        return chemin
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        sys.exit(
            "ffmpeg introuvable. Installer le paquet système (apt install ffmpeg, "
            "brew install ffmpeg) ou, à défaut : pip install imageio-ffmpeg"
        )


def _executer(commande: list[str]) -> str:
    """Lance ffmpeg et rend sa sortie d'erreur, où il écrit tout ce qu'il raconte."""
    resultat = subprocess.run(commande, capture_output=True, text=True)
    return resultat.stderr


def duree_secondes(ff: str, fichier: Path) -> float | None:
    sortie = _executer([ff, "-hide_banner", "-i", str(fichier)])
    trouve = re.search(r"Duration:\s*(\d+):(\d\d):(\d\d\.\d+)", sortie)
    if not trouve:
        return None
    h, m, s = trouve.groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def a_du_son(ff: str, fichier: Path) -> bool:
    return "Audio:" in _executer([ff, "-hide_banner", "-i", str(fichier)])


def mesurer_loudness(ff: str, fichier: Path, cible_lufs: float) -> dict | None:
    """Analyse EBU R128. Rend aussi les valeurs que la seconde passe attend."""
    sortie = _executer([
        ff, "-hide_banner", "-nostats", "-i", str(fichier), "-map", "0:a:0",
        "-af", f"loudnorm=I={cible_lufs}:TP=-1:LRA=11:print_format=json",
        "-f", "null", "-",
    ])
    # loudnorm écrit son JSON en dernier, après les avertissements éventuels.
    blocs = re.findall(r"\{[^{}]*\}", sortie, flags=re.S)
    for bloc in reversed(blocs):
        try:
            brut = json.loads(bloc)
        except json.JSONDecodeError:
            continue
        if "input_i" in brut:
            return {
                "loudness_lufs": float(brut["input_i"]),
                "vrai_pic_dbtp": float(brut["input_tp"]),
                "etendue_lu": float(brut["input_lra"]),
                "seuil_lufs": float(brut["input_thresh"]),
                # Repassées telles quelles à `monter.py` : c'est ce qui évite
                # une seconde analyse au moment de normaliser.
                "_mesures_pour_seconde_passe": {
                    "measured_I": brut["input_i"],
                    "measured_TP": brut["input_tp"],
                    "measured_LRA": brut["input_lra"],
                    "measured_thresh": brut["input_thresh"],
                    "offset": brut.get("target_offset", "0.0"),
                },
            }
    return None


def passages_parles(ff: str, fichier: Path, duree: float) -> list[dict]:
    """Rend les intervalles où il se dit quelque chose, par inversion des silences."""
    sortie = _executer([
        ff, "-hide_banner", "-nostats", "-i", str(fichier), "-map", "0:a:0",
        "-af", f"silencedetect=noise={SEUIL_SILENCE_DB}dB:d={DUREE_SILENCE_MIN_S}",
        "-f", "null", "-",
    ])
    debuts = [float(v) for v in re.findall(r"silence_start:\s*(-?[\d.]+)", sortie)]
    fins = [float(v) for v in re.findall(r"silence_end:\s*([\d.]+)", sortie)]

    silences = []
    for i, debut in enumerate(debuts):
        fin = fins[i] if i < len(fins) else duree
        silences.append((max(0.0, debut), min(duree, fin)))

    parole, curseur = [], 0.0
    for debut, fin in silences:
        if debut - curseur > 0.05:
            parole.append({"debut_s": round(curseur, 2), "fin_s": round(debut, 2)})
        curseur = fin
    if duree - curseur > 0.05:
        parole.append({"debut_s": round(curseur, 2), "fin_s": round(duree, 2)})
    return parole


def mesurer(fichier: Path, cible_lufs: float, avec_parole: bool) -> dict:
    ff = trouver_ffmpeg()
    if not fichier.exists():
        sys.exit(f"Fichier introuvable : {fichier}")

    fiche: dict = {"fichier": str(fichier), "duree_s": duree_secondes(ff, fichier)}

    if not a_du_son(ff, fichier):
        fiche["son"] = None
        fiche["remarque"] = "Aucune piste audio : il n'y a rien à mesurer."
        return fiche

    fiche["son"] = mesurer_loudness(ff, fichier, cible_lufs)
    if avec_parole and fiche["duree_s"]:
        fiche["parole"] = passages_parles(ff, fichier, fiche["duree_s"])
    return fiche


def main() -> None:
    analyseur = argparse.ArgumentParser(
        description="Mesure la loudness d'un fichier son ou vidéo (EBU R128)."
    )
    analyseur.add_argument("fichier", type=Path)
    analyseur.add_argument("--cible", type=float, default=-14.0,
                           help="cible LUFS servant de référence à l'analyse (défaut : -14)")
    analyseur.add_argument("--parole", action="store_true",
                           help="repérer aussi les passages parlés")
    options = analyseur.parse_args()

    fiche = mesurer(options.fichier, options.cible, options.parole)
    print(json.dumps(fiche, ensure_ascii=False, indent=2))

    son = fiche.get("son")
    if son:
        ecart = son["loudness_lufs"] - options.cible
        verdict = "conforme" if abs(ecart) <= 1.0 else (
            "trop fort — la plateforme le baissera" if ecart > 0 else "trop faible"
        )
        print(
            f"\n→ {son['loudness_lufs']:.1f} LUFS "
            f"(cible {options.cible:.0f}, écart {ecart:+.1f}) · "
            f"vrai pic {son['vrai_pic_dbtp']:.1f} dBTP · "
            f"étendue {son['etendue_lu']:.1f} LU — {verdict}",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
