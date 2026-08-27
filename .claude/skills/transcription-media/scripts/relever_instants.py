#!/usr/bin/env python3
"""Relever les instants d'un montage, plutôt que de les estimer.

Écrit après une erreur de trois secondes. Le plan sonore d'un clip donnait
l'apparition du dragon à 7,50 s ; le fichier, relevé image par image, la met à
10,29 s. Toute la pose de la voix off en découlait par soustraction, donc tout
était faux — et rien ne le signalait, parce qu'un instant plausible se relit
sans broncher. Dans ce dépôt, ce qui se mesure ne se relit pas.

Quatre relevés, et chacun répond à une question qu'on se pose vraiment :

- `--fiche`      combien de temps, quel format, quelle cadence
- `--ruptures`   où l'image change franchement (pour caler une coupe)
- `--planche`    une planche contact horodatée (pour *voir* et pouvoir citer)
- `--enveloppe`  y a-t-il de la parole là-dedans, et où

Deux pièges que ce script existe pour éviter :

**Un score de rupture bas ne veut pas dire « aucun temps fort ».** Un fondu
enchaîné ou un iris ne produisent aucun pic — l'image change beaucoup, mais
lentement. Quand le maximum plafonne bas, la conclusion est « un seul plan
continu », et les temps forts se lisent sur la planche, pas sur les scores.

**Une piste sonore n'est pas une voix off.** La bande 800–3500 Hz porte la
parole ; si sa part de l'énergie ne fait aucune structure, il n'y a personne
qui parle, quelle que soit la richesse du son. C'est ce test qui a montré
qu'un fichier déposé comme « le montage » était la génération brute.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile

BANDES = {"grave 20-200": (20, 200), "bas-médium 200-800": (200, 800),
          "parole 800-3500": (800, 3500), "aigu 3500-12000": (3500, 12000)}


def _bin(nom: str) -> str:
    for c in (nom, f"/usr/bin/{nom}", f"/usr/local/bin/{nom}"):
        if os.path.exists(c) or subprocess.run(["which", c], capture_output=True).returncode == 0:
            return c
    sys.exit(f"✗ {nom} introuvable → apt-get update && apt-get install -y ffmpeg\n"
             "  (l'`apt-get update` n'est pas décoratif : sans lui les listes sont\n"
             "   périmées et l'installation échoue en 404 sur des dépendances.)")


def fiche(media: str) -> dict:
    out = subprocess.run([_bin("ffprobe"), "-v", "error", "-print_format", "json",
                          "-show_format", "-show_streams", media],
                         capture_output=True, text=True).stdout
    d = json.loads(out)
    v = next((s for s in d["streams"] if s["codec_type"] == "video"), None)
    a = next((s for s in d["streams"] if s["codec_type"] == "audio"), None)
    print(f"{os.path.basename(media)}")
    print(f"  durée      {float(d['format']['duration']):.3f} s")
    if v:
        n, den = (v.get("r_frame_rate") or "0/1").split("/")
        ips = float(n) / float(den or 1)
        print(f"  image      {v['width']}×{v['height']}, {ips:g} i/s, {v['codec_name']}")
    if a:
        print(f"  son        {a['codec_name']}, {a['sample_rate']} Hz, {a['channels']} canaux")
    else:
        print("  son        aucun")
    return d


def ruptures(media: str, combien: int = 15) -> list[tuple[float, float]]:
    """Score de changement d'image, image par image. Rend les plus fortes."""
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
        journal = f.name
    subprocess.run([_bin("ffmpeg"), "-hide_banner", "-i", media, "-filter:v",
                    f"select='gte(scene,0)',metadata=print:file={journal}",
                    "-f", "null", "-"], capture_output=True)
    lignes = open(journal).read().split("\n")
    os.unlink(journal)
    paires = []
    for a, b in zip(lignes[::2], lignes[1::2]):
        mt, ms = re.search(r"pts_time:([\d.]+)", a), re.search(r"=([\d.]+)", b)
        if mt and ms:
            paires.append((float(mt.group(1)), float(ms.group(1))))
    if not paires:
        print("  (aucun score : le média n'a pas de piste image)")
        return []

    fortes = sorted(paires, key=lambda p: -p[1])[:combien]
    plafond = max(s for _, s in paires)
    print(f"\n{len(paires)} images analysées, rupture maximale {plafond:.3f}")
    if plafond < 0.25:
        print("  ⚠ aucune coupe franche : c'est un plan continu, ou les transitions")
        print("    sont des fondus. Les temps forts se lisent sur la planche contact,")
        print("    pas ici — un fondu ne fait pas de pic.")
    for t, s in sorted(fortes, key=lambda p: p[0]):
        print(f"  t = {t:7.3f} s   rupture {s:.3f}")
    return fortes


def planche(media: str, sortie: str, par_seconde: float = 2.0,
            colonnes: int = 6, lignes: int = 5, largeur: int = 200,
            fenetre: tuple[float, float] | None = None) -> str:
    """Planche contact **horodatée**. Sans l'horodatage on ne peut rien citer."""
    os.makedirs(sortie, exist_ok=True)
    cible = os.path.join(sortie, "planche.png")
    sel = (f"between(t\\,{fenetre[0]}\\,{fenetre[1]})" if fenetre else "1")
    filtre = (f"select='{sel}',fps={par_seconde},scale={largeur}:-1,"
              "drawtext=text='%{pts\\:hms}':x=4:y=4:fontsize=16:fontcolor=yellow:"
              "box=1:boxcolor=black@0.7,"
              f"tile={colonnes}x{lignes}")
    subprocess.run([_bin("ffmpeg"), "-v", "error", "-y", "-i", media,
                    "-vf", filtre, "-frames:v", "1", cible], check=True)
    print(f"\n✓ planche contact → {cible}")
    print("  (à ouvrir : c'est en la regardant qu'on trouve les fondus que les"
          "\n   scores de rupture ne voient pas)")
    return cible


def enveloppe(media: str, pas: float = 0.5) -> None:
    """Part de la bande de parole dans l'énergie, tranche par tranche."""
    try:
        import numpy as np
    except ImportError:
        sys.exit("✗ numpy absent → pip install numpy")
    import wave

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        tmp = f.name
    r = subprocess.run([_bin("ffmpeg"), "-v", "error", "-y", "-i", media, "-vn",
                        "-ac", "1", "-ar", "32000", "-c:a", "pcm_s16le", tmp],
                       capture_output=True)
    if r.returncode != 0:
        print("  (pas de piste sonore)")
        return

    w = wave.open(tmp)
    sr = w.getframerate()
    m = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    os.unlink(tmp)

    N, saut = 1024, 256
    f = np.fft.rfftfreq(N, 1 / sr)
    fen = np.hanning(N)
    T, E = [], {k: [] for k in BANDES}
    for i in range(0, len(m) - N, saut):
        S = np.abs(np.fft.rfft(m[i:i + N] * fen)) ** 2
        T.append(i / sr)
        for k, (a, b) in BANDES.items():
            E[k].append(S[(f >= a) & (f < b)].sum())
    T = np.array(T)
    E = {k: np.array(v) for k, v in E.items()}
    part = E["parole 800-3500"] / (sum(E.values()) + 1e-12)

    print(f"\npart de la bande 800-3500 Hz, par {pas:g} s")
    plafond = 0.0
    for s in np.arange(0, len(m) / sr, pas):
        sel = (T >= s) & (T < s + pas)
        if not sel.any():
            continue
        p = part[sel].mean()
        plafond = max(plafond, p)
        print(f"  {s:6.1f} s  {p * 100:5.1f} %  " + "#" * int(p * 160))

    # Ce relevé cadre la question, il ne la tranche pas — et la version
    # précédente prétendait le contraire. Sur le clip qui a motivé ce script,
    # un éclair poussait la bande à 38 % sans qu'aucune voix ne soit présente :
    # un transitoire (choc, étincelle, cymbale) occupe la bande de la parole
    # aussi bien qu'une syllabe. Seul le bas de l'échelle conclut tout seul.
    print()
    if plafond < 0.12:
        print("  ⚠ la bande de parole ne monte jamais : aucune voix ici, c'est sûr.")
        print("    Ne pas y chercher une voix off — ambiance ou musique.")
    else:
        print("  La bande de parole monte par endroits, mais un choc ou une étincelle")
        print("  en fait autant qu'une syllabe : ça ne prouve pas qu'on parle. Ce qui")
        print("  tranche, c'est de lancer la reconnaissance elle-même —")
        print("      python3 asr_hors_ligne.py <média> --modele base")
        print("  et de voir si un mot en sort.")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("media")
    p.add_argument("--fiche", action="store_true")
    p.add_argument("--ruptures", action="store_true")
    p.add_argument("--planche", action="store_true")
    p.add_argument("--enveloppe", action="store_true")
    p.add_argument("--fenetre", nargs=2, type=float, metavar=("DEBUT", "FIN"),
                   help="restreindre la planche à un intervalle, pour y voir à l'image près")
    p.add_argument("--par-seconde", type=float, default=2.0,
                   help="images par seconde sur la planche (défaut 2 ; monter à 8 "
                        "avec --fenetre pour figer une transition)")
    p.add_argument("--sortie", default="/tmp/relevé")
    a = p.parse_args()

    if not os.path.exists(a.media):
        sys.exit(f"✗ introuvable : {a.media}")
    # Sans option, on fait tout : c'est le relevé complet qu'on veut presque
    # toujours, et l'oublier coûte un aller-retour.
    tout = not (a.fiche or a.ruptures or a.planche or a.enveloppe)
    if tout or a.fiche:
        fiche(a.media)
    if tout or a.ruptures:
        ruptures(a.media)
    if tout or a.planche:
        planche(a.media, a.sortie, a.par_seconde,
                fenetre=tuple(a.fenetre) if a.fenetre else None)
    if tout or a.enveloppe:
        enveloppe(a.media)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
