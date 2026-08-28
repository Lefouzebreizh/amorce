#!/usr/bin/env python3
"""Faire voler un objet rond en éclats, avec une physique tenue.

Une explosion crédible ne se joue pas sur le nombre de morceaux mais sur trois
choses, et chacune manquait aux premières versions :

1. **Les fragments viennent de l'image, pas d'une bibliothèque.** On découpe le
   disque réel en cellules de Voronoï et on anime **ses propres pixels**. Un
   fragment générique posé par-dessus se voit immédiatement, parce que sa
   texture ne correspond ni à l'éclairage ni à la palette du plan.

2. **Ils partent vers la caméra autant que sur les côtés.** Une explosion vue
   de face qui ne s'étale que dans le plan de l'image se lit comme une fleur qui
   s'ouvre. Ce qui fait « ça vient sur moi », c'est le grossissement : chaque
   fragment reçoit une vitesse hors-plan qui le fait grandir, et les plus
   rapides sortent du cadre par les bords.

3. **Rien ne part à vitesse égale.** Une explosion isotrope est une animation ;
   une vraie a des morceaux lents qui retombent et des éclats qui filent. La
   dispersion des vitesses fait davantage que leur moyenne.

Le fond n'est pas laissé tel quel : le disque y est éteint progressivement,
sinon on voit l'objet intact derrière ses propres débris.

    python3 montage-auto/eclat_terre.py plan.mp4 sortie.mp4 --instant 1.2 \\
        --centre 531,1306 --rayon 333
"""

from __future__ import annotations

import argparse
import math
import subprocess
import tempfile
from pathlib import Path

import numpy
from PIL import Image, ImageDraw, ImageFilter

LARGEUR, HAUTEUR = 1080, 1920


def ffmpeg() -> str:
    return "/usr/bin/ffmpeg" if Path("/usr/bin/ffmpeg").is_file() else "ffmpeg"


def image_a(source: Path, instant: float) -> Image.Image:
    with tempfile.TemporaryDirectory() as dossier:
        cible = Path(dossier) / "i.png"
        subprocess.run([ffmpeg(), "-y", "-v", "error", "-ss", str(instant),
                        "-i", str(source), "-frames:v", "1", "-vf",
                        f"scale={LARGEUR}:{HAUTEUR}:force_original_aspect_ratio=increase,"
                        f"crop={LARGEUR}:{HAUTEUR}", str(cible)], check=True)
        return Image.open(cible).convert("RGB").copy()


def decouper(image: Image.Image, centre: tuple, rayon: int, morceaux: int,
             graine: int) -> list[dict]:
    """Découpe le disque en cellules de Voronoï, et rend chacune détourée.

    Les germes sont tirés en **racine du rayon** plutôt qu'uniformément : à
    tirage uniforme, la densité de points est plus forte au centre et les
    fragments du bord deviennent d'immenses tranches, ce qui trahit la
    construction. En racine, les cellules gardent des tailles comparables.
    """
    generateur = numpy.random.default_rng(graine)
    cx, cy = centre
    angles = generateur.uniform(0, 2 * math.pi, morceaux)
    distances = rayon * numpy.sqrt(generateur.uniform(0.02, 1.0, morceaux))
    germes = numpy.stack([cx + distances * numpy.cos(angles),
                          cy + distances * numpy.sin(angles)], axis=1)

    gauche, haut = int(cx - rayon), int(cy - rayon)
    cote = int(rayon * 2)
    boite = numpy.asarray(image.crop((gauche, haut, gauche + cote, haut + cote)))

    yy, xx = numpy.mgrid[0:cote, 0:cote]
    xx = xx + gauche
    yy = yy + haut
    dans = (xx - cx) ** 2 + (yy - cy) ** 2 <= rayon ** 2

    # Cellule la plus proche, germe par germe.
    meilleure = numpy.full((cote, cote), -1, dtype=numpy.int16)
    plus_courte = numpy.full((cote, cote), numpy.inf)
    for rang, (gx, gy) in enumerate(germes):
        d = (xx - gx) ** 2 + (yy - gy) ** 2
        prend = d < plus_courte
        plus_courte = numpy.where(prend, d, plus_courte)
        meilleure = numpy.where(prend, rang, meilleure)
    meilleure = numpy.where(dans, meilleure, -1)

    fragments = []
    for rang in range(morceaux):
        masque = meilleure == rang
        if masque.sum() < 60:
            continue
        ys, xs = numpy.nonzero(masque)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        vignette = numpy.zeros((y1 - y0, x1 - x0, 4), dtype=numpy.uint8)
        vignette[..., :3] = boite[y0:y1, x0:x1]
        vignette[..., 3] = masque[y0:y1, x0:x1] * 255
        tuile = Image.fromarray(vignette, "RGBA")
        # Un bord net trahit la découpe ; un pixel de flou suffit à l'asseoir.
        tuile.putalpha(tuile.getchannel("A").filter(ImageFilter.GaussianBlur(0.8)))
        fragments.append({
            "image": tuile,
            "x": gauche + x0 + (x1 - x0) / 2,
            "y": haut + y0 + (y1 - y0) / 2,
        })
    return fragments


def lancer(fragments: list, centre: tuple, graine: int,
           vitesse: float = 820.0, vers_camera: float = 1.05) -> None:
    """Donne à chaque fragment sa trajectoire. Rien de commun entre eux.

    La direction part du centre — c'est ce qui fait une explosion plutôt qu'un
    éparpillement —, mais l'amplitude, la rotation et la vitesse hors-plan sont
    tirées séparément. Les fragments du bord partent plus vite que ceux du
    centre, comme dans une coque qui cède.
    """
    generateur = numpy.random.default_rng(graine + 7)
    cx, cy = centre
    for f in fragments:
        dx, dy = f["x"] - cx, f["y"] - cy
        distance = max(math.hypot(dx, dy), 1.0)
        elan = 0.45 + 0.55 * min(1.0, distance / 320.0)
        desordre = generateur.uniform(0.55, 1.65)
        f["vx"] = dx / distance * vitesse * elan * desordre
        f["vy"] = dy / distance * vitesse * elan * desordre - generateur.uniform(60, 220)
        f["vz"] = vers_camera * generateur.uniform(0.35, 1.0) * elan
        f["rot"] = generateur.uniform(-260, 260)
        f["retard"] = generateur.uniform(0.0, 0.05)


def etincelles(centre: tuple, combien: int, graine: int) -> list[dict]:
    generateur = numpy.random.default_rng(graine + 31)
    cx, cy = centre
    lot = []
    for _ in range(combien):
        angle = generateur.uniform(0, 2 * math.pi)
        v = generateur.uniform(500, 2100)
        lot.append({"x": cx, "y": cy,
                    "vx": math.cos(angle) * v, "vy": math.sin(angle) * v,
                    "taille": generateur.uniform(2, 7),
                    "vie": generateur.uniform(0.35, 1.0),
                    "teinte": generateur.choice([(255, 190, 90), (255, 120, 40),
                                                 (255, 240, 200), (120, 240, 255)])})
    return lot


def fond_eteint(image: Image.Image, centre: tuple, rayon: int,
                avancement: float) -> Image.Image:
    """Ce qui reste là où l'objet était : un coeur incandescent, pas un trou.

    Une première version y peignait du noir presque plat. Le résultat se lisait
    comme un trou découpé dans l'image, et non comme une masse qui vient de
    céder — parce qu'une chose qui explose **rayonne** pendant qu'elle se
    disperse, elle ne devient pas absente d'un coup.

    Le coeur est donc chaud au centre et sombre au bord, et il se contracte à
    mesure que les fragments s'éloignent : ce qui subsiste au milieu d'une
    explosion est de plus en plus petit et de moins en moins lumineux.
    """
    fond = image.copy()
    cx, cy = centre
    r = rayon * 0.90

    # Le dégradé du coeur, peint une fois puis collé.
    cote = int(r * 2)
    yy, xx = numpy.mgrid[0:cote, 0:cote]
    d = numpy.hypot(xx - cote / 2, yy - cote / 2) / (cote / 2)
    chaleur = numpy.clip(1.0 - d, 0, 1) ** 2.2 * max(0.0, 1.0 - avancement * 1.5)
    braise = numpy.zeros((cote, cote, 3), dtype=numpy.uint8)
    braise[..., 0] = numpy.clip(18 + 235 * chaleur, 0, 255)
    braise[..., 1] = numpy.clip(10 + 120 * chaleur ** 1.6, 0, 255)
    braise[..., 2] = numpy.clip(12 + 30 * chaleur ** 2.4, 0, 255)

    voile = Image.new("L", fond.size, 0)
    ImageDraw.Draw(voile).ellipse([cx - r, cy - r, cx + r, cy + r],
                                  fill=int(255 * min(1.0, avancement * 2.4)))
    voile = voile.filter(ImageFilter.GaussianBlur(rayon * 0.12))

    couche = Image.new("RGB", fond.size, (5, 4, 8))
    couche.paste(Image.fromarray(braise, "RGB"), (int(cx - r), int(cy - r)))
    return Image.composite(couche, fond, voile)


def rendre(source: Path, sortie: Path, instant: float, centre: tuple, rayon: int,
           duree: float = 1.0, morceaux: int = 30, graine: int = 5,
           cadence: int = 30) -> int:
    image = image_a(source, instant)
    fragments = decouper(image, centre, rayon, morceaux, graine)
    lancer(fragments, centre, graine)
    lot = etincelles(centre, 260, graine)

    total = int(duree * cadence)
    with tempfile.TemporaryDirectory() as dossier:
        atelier = Path(dossier)
        for n in range(total):
            t = n / cadence
            toile = fond_eteint(image, centre, rayon, t / duree).convert("RGBA")

            # Le flash de l'instant zéro, éteint en deux dixièmes.
            if t < 0.22:
                force = int(235 * math.exp(-11 * t))
                if force > 3:
                    toile = Image.alpha_composite(
                        toile, Image.new("RGBA", toile.size, (255, 248, 235, force)))

            for f in fragments:
                tf = max(0.0, t - f["retard"])
                echelle = max(0.05, 1.0 + f["vz"] * tf)
                x = f["x"] + f["vx"] * tf
                y = f["y"] + f["vy"] * tf + 0.5 * 1250 * tf * tf
                tuile = f["image"]
                large = max(2, int(tuile.width * echelle))
                haute = max(2, int(tuile.height * echelle))
                if large > 3000 or haute > 3000:
                    continue                       # sorti du cadre par l'avant
                tuile = tuile.resize((large, haute), Image.BILINEAR)
                if echelle > 1.25:
                    # Un fragment qui arrive sur l'objectif sort de la zone de
                    # netteté et quitte la lumière de la scène. Sans ces deux
                    # corrections il grandit en gardant sa clarté d'origine et
                    # devient une découpe de papier blanc collée sur l'image.
                    exces = min(2.4, echelle - 1.25)
                    tuile = tuile.filter(ImageFilter.GaussianBlur(exces * 2.2))
                    voie = tuile.split()
                    # Le rouge résiste mieux que le bleu : un débris qui
                    # s'assombrit en chauffant vire à la braise, pas au gris.
                    facteurs = (1 - 0.24 * exces, 1 - 0.34 * exces, 1 - 0.44 * exces)
                    sombre = [c.point(lambda v, k=k: int(v * max(0.15, k)))
                              for c, k in zip(voie[:3], facteurs)]
                    tuile = Image.merge("RGBA", (*sombre, voie[3]))
                tuile = tuile.rotate(f["rot"] * tf, resample=Image.BILINEAR,
                                     expand=True)
                if x + tuile.width < 0 or x - tuile.width > LARGEUR:
                    continue
                if y + tuile.height < 0 or y - tuile.height > HAUTEUR:
                    continue
                toile.alpha_composite(tuile, (int(x - tuile.width / 2),
                                              int(y - tuile.height / 2)))

            dessin = ImageDraw.Draw(toile, "RGBA")
            for e in lot:
                if t > e["vie"]:
                    continue
                x = e["x"] + e["vx"] * t
                y = e["y"] + e["vy"] * t + 0.5 * 900 * t * t
                a = int(255 * (1 - t / e["vie"]) ** 1.6)
                s = e["taille"] * (1 - 0.4 * t / e["vie"])
                dessin.ellipse([x - s, y - s, x + s, y + s], fill=(*e["teinte"], a))

            toile.convert("RGB").save(atelier / f"f{n:04d}.png")

        subprocess.run([ffmpeg(), "-y", "-v", "error", "-framerate", str(cadence),
                        "-i", str(atelier / "f%04d.png"), "-c:v", "libx264",
                        "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
                        str(sortie)], check=True)
    return len(fragments)


def main() -> int:
    a = argparse.ArgumentParser(description="Fait voler un disque en éclats.")
    a.add_argument("source")
    a.add_argument("sortie")
    a.add_argument("--instant", type=float, required=True)
    a.add_argument("--centre", required=True, help="x,y en pixels")
    a.add_argument("--rayon", type=int, required=True)
    a.add_argument("--duree", type=float, default=1.0)
    a.add_argument("--morceaux", type=int, default=30)
    a.add_argument("--graine", type=int, default=5)
    o = a.parse_args()
    cx, cy = (int(v) for v in o.centre.split(","))
    n = rendre(Path(o.source).expanduser(), Path(o.sortie).expanduser(),
               o.instant, (cx, cy), o.rayon, o.duree, o.morceaux, o.graine)
    print(f"  {n} fragments · {o.duree}s · {o.sortie}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
