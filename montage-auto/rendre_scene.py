#!/usr/bin/env python3
"""Rendre une scène de `scenes/` en fichier vidéo, image par image.

Le principe est celui de Remotion, sans Remotion : la scène est une page qui
expose `dessiner(t)`, on appelle cette fonction pour chaque image, et on
photographie le résultat. Trois raisons de le faire ici plutôt que d'installer
un moteur de rendu de plus :

  · La scène reste un fichier HTML qu'on ouvre dans un navigateur pour la
    régler à la main, sans chaîne de compilation.
  · Le rendu est **déterministe** — `dessiner(t)` ne lit ni horloge ni
    `Math.random`, donc deux exécutions donnent le même fichier. Une scène qui
    se rejoue autrement à chaque rendu ne se monte pas.
  · Les images ne touchent jamais le disque : elles passent par un tube vers
    ffmpeg. 402 images en 1080 × 1920 pèsent près d'un gigaoctet en PNG, et
    l'espace disque d'une session est une allocation fixe, pas une machine.

    python3 montage-auto/rendre_scene.py \
        --scene montage-auto/scenes/portail.html \
        --site  capture.png \
        --sortie portail.mp4
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"


def ffmpeg() -> str:
    trouve = shutil.which("ffmpeg")
    if trouve:
        return trouve
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        sys.exit("ffmpeg est introuvable — voir montage-auto/installer.sh")


def chrome() -> str:
    if Path(CHROME).exists():
        return CHROME
    trouve = shutil.which("chromium") or shutil.which("google-chrome")
    if trouve:
        return trouve
    sys.exit(f"Aucun Chromium — attendu dans {CHROME}")


def rendre(scene: Path, site: Path | None, sortie: Path,
           images_s: int, duree: float | None, largeur: int, hauteur: int,
           apercus: list[float], recit: Path | None = None) -> int:
    from playwright.sync_api import sync_playwright

    atelier = Path(tempfile.mkdtemp(prefix="scene-"))
    try:
        # La scène et sa capture voisinent : l'image se charge alors en même
        # origine, sans drapeau d'accès aux fichiers locaux.
        shutil.copy(scene, atelier / "scene.html")
        if site:
            shutil.copy(site, atelier / "site.png")

        with sync_playwright() as p:
            navigateur = p.chromium.launch(
                executable_path=chrome(),
                args=["--no-sandbox", "--force-color-profile=srgb",
                      "--disable-lcd-text", "--hide-scrollbars"])
            page = navigateur.new_page(
                viewport={"width": largeur, "height": hauteur},
                device_scale_factor=1)
            if recit:
                # Posé AVANT le chargement : la scène lit `window.__RECIT__`
                # à l'exécution de son script, pas après.
                page.add_init_script(
                    "window.__RECIT__ = " + recit.read_text(encoding="utf-8"))
            page.goto((atelier / "scene.html").as_uri())
            charge = page.evaluate("() => window.pret")
            if site and not charge:
                print("  la capture ne s'est pas chargée — la dalle sera vide")
            total_scene = page.evaluate("() => window.DUREE") or 0
            secondes = duree if duree else float(total_scene)
            if not secondes:
                sys.exit("La scène n'annonce pas de durée et --duree est absent.")
            images = int(round(secondes * images_s))
            print(f"  {secondes:.2f} s · {images_s} i/s · {images} images")

            commande = [
                ffmpeg(), "-y", "-v", "error",
                "-f", "image2pipe", "-framerate", str(images_s), "-i", "-",
                "-c:v", "libx264", "-preset", "slow", "-crf", "18",
                "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                str(sortie),
            ]
            tube = subprocess.Popen(commande, stdin=subprocess.PIPE)

            reste = sorted(apercus)
            for n in range(images):
                t = n / images_s
                page.evaluate("t => window.dessiner(t)", t)
                image = page.screenshot(type="png")
                tube.stdin.write(image)
                while reste and t >= reste[0]:
                    nom = sortie.with_name(f"{sortie.stem}-{reste[0]:05.2f}.png")
                    nom.write_bytes(image)
                    print(f"  aperçu {nom.name}")
                    reste.pop(0)
                if n % 60 == 0:
                    print(f"  image {n}/{images}", flush=True)

            tube.stdin.close()
            code = tube.wait()
            navigateur.close()
            if code != 0:
                return code

        poids = sortie.stat().st_size / 1e6
        print(f"  écrit {sortie} — {poids:.1f} Mo")
        return 0
    finally:
        shutil.rmtree(atelier, ignore_errors=True)


def main() -> int:
    a = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("--scene", required=True, type=Path)
    a.add_argument("--site", type=Path, default=None,
                   help="la capture de page à faire apparaître dans la scène")
    a.add_argument("--sortie", required=True, type=Path)
    a.add_argument("--images-s", type=int, default=30)
    a.add_argument("--duree", type=float, default=None,
                   help="par défaut, celle annoncée par la scène")
    a.add_argument("--largeur", type=int, default=1080)
    a.add_argument("--hauteur", type=int, default=1920)
    a.add_argument("--apercu", type=float, nargs="*", default=[],
                   help="instants à écrire aussi en PNG, pour regarder")
    a.add_argument("--recit", type=Path, default=None,
                   help="un JSON qui remplace les bornes et les cartons de la scène")
    o = a.parse_args()
    o.sortie.parent.mkdir(parents=True, exist_ok=True)
    return rendre(o.scene, o.site, o.sortie, o.images_s, o.duree,
                  o.largeur, o.hauteur, o.apercu, o.recit)


if __name__ == "__main__":
    raise SystemExit(main())
