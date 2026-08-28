#!/usr/bin/env python3
"""Rend la teinte dominante d'un plan, et deux couleurs de texte qui s'y accordent.

Un sous-titre blanc sur une série colorée est un corps étranger : il appartient
à l'interface, pas au film. En prendre la teinte le fait appartenir à l'image.

La mesure écarte les pixels ternes et le fond sombre — une moyenne sur toute
l'image rendrait le gris du décor, jamais la couleur qui fait la série.
"""

from __future__ import annotations

import argparse
import colorsys
import subprocess
import tempfile
from pathlib import Path

import numpy
from PIL import Image


def teinte(media: Path, instants: list[float]) -> tuple[float, str, str]:
    vifs = []
    with tempfile.TemporaryDirectory() as dossier:
        for rang, instant in enumerate(instants):
            cible = Path(dossier) / f"{rang}.png"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(instant),
                            "-i", str(media), "-frames:v", "1",
                            "-vf", "scale=96:171", str(cible)], check=False)
            if not cible.is_file():
                continue
            a = numpy.asarray(Image.open(cible).convert("RGB")).astype(float) / 255
            plafond, plancher = a.max(2), a.min(2)
            saturation = numpy.where(plafond > 0, (plafond - plancher) / numpy.maximum(plafond, 1e-6), 0)
            garde = a[(saturation > 0.35) & (plafond > 0.25)]
            if len(garde):
                vifs.append(garde)

    if not vifs:
        return 0.0, "#ffffff", "#888888"
    moyenne = numpy.concatenate(vifs).mean(0)
    h, _, _ = colorsys.rgb_to_hsv(*moyenne)

    # Le texte : la teinte, très claire, pour rester lisible sur tout fond.
    clair = numpy.clip(moyenne / max(moyenne.max(), 1e-6) * 0.55 + 0.45, 0, 1)
    # Le halo : la même teinte, saturée, pour détacher sans boîte noire.
    vif = colorsys.hsv_to_rgb(h, 0.86, 0.90)
    en_hexa = lambda c: "#%02x%02x%02x" % tuple(int(x * 255) for x in c)
    return h * 360, en_hexa(clair), en_hexa(vif)


def main() -> int:
    a = argparse.ArgumentParser(description="Teinte dominante et couleurs de texte.")
    a.add_argument("media", nargs="+")
    a.add_argument("--instants", default="0.5,1.5,2.5",
                   help="où échantillonner, en secondes (défaut : 0.5,1.5,2.5)")
    o = a.parse_args()
    instants = [float(x) for x in o.instants.split(",")]

    print(f"\n  {'plan':<40}{'teinte':>8}{'texte':>10}{'halo':>10}")
    tout = []
    for chemin in o.media:
        h, texte, halo = teinte(Path(chemin).expanduser(), instants)
        tout.append(h)
        print(f"  {Path(chemin).name[:39]:<40}{h:>7.0f}°{texte:>10}{halo:>10}")
    if len(tout) > 1:
        print(f"\n  étendue : {min(tout):.0f}° à {max(tout):.0f}° "
              f"— {'une seule famille' if max(tout)-min(tout) < 40 else 'plusieurs familles'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
