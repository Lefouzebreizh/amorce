"""
Indexe une bibliothèque de sons, et dit lesquels sont utilisables.

Un dossier de bruitages ment par omission : quatre prises du même prompt s'y
rangent côte à côte, et rien ne distingue celle qui portera d'une qui sera
inaudible. L'écart mesuré entre la meilleure et la pire atteint couramment
vingt décibels sur la bande qu'un téléphone restitue.

Trois critères écartent un son, et chacun vient d'un échec constaté :

- **la sonie**, parce qu'un impact qu'il faut remonter de dix décibels au
  montage remonte son bruit de fond avec lui ;
- **l'énergie au-dessus de 400 Hz**, la limite basse d'un haut-parleur de
  téléphone : un rugissement magnifique au casque et absent sur l'appareil où
  la vidéo sera vue ne sert à rien ;
- **la durée**, parce qu'un son de deux secondes n'a pas de queue, et qu'une
  queue est ce qui donne sa taille à une bête.

L'index ne remplace pas l'écoute. Il écarte ce qui ne peut pas marcher, ce qui
laisse l'oreille juger de ce qui reste.
"""

import json
import shutil
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
BIBLIO = RACINE / "kits"
INDEX = RACINE / "second-brain" / "sound_index.json"

# Un son en dessous de ces seuils ne se rattrape pas au montage.
SONIE_MINI = -20.0        # LUFS intégré
TELEPHONE_MINI = -22.0    # dB au-dessus de 400 Hz
# La durée minimale dépend de ce que le son doit faire. Un premier seuil
# unique à 1,2 s écartait un pas de titan de 0,85 s — or un impact *doit*
# être bref : c'est sa brièveté qui le fait percevoir comme un choc. Une
# ambiance sans longueur, en revanche, ne peut rien tenir.
DUREE_MINI = {"impacts": 0.5, "whooshes": 0.8, "dragons": 1.5,
              "magic": 0.6, "crowds": 2.0, "atmos": 2.0}
DUREE_DEFAUT = 1.2

FAMILLES = ["dragons", "impacts", "whooshes", "magic", "crowds", "atmos"]


@lru_cache(maxsize=None)
def outil(nom):
    """Le binaire demandé, ou un message qui dit quoi installer.

    Résolu à l'APPEL et non au chargement : `verdict()` et `etiquettes()` sont
    des fonctions pures, et exiger ffmpeg pour les relire rendait ce module
    impossible à éprouver. Le cache fait que la recherche n'a lieu qu'une fois.

    `imageio-ffmpeg` ne livre QUE ffmpeg. Déduire le chemin de ffprobe en y
    remplaçant « ffmpeg » par « ffprobe » fabriquait un chemin qui ne peut pas
    exister : `str.replace` emporte toutes les occurrences, donc le nom du
    dossier `imageio_ffmpeg` avec — d'où un `.../imageio_ffprobe/...` fantôme,
    et une `FileNotFoundError` brute au lieu du message ci-dessous. Même
    corrigé, ce chemin n'existerait pas : le paquet n'a pas de ffprobe.
    """
    chemin = shutil.which(nom)
    if chemin:
        return chemin
    if nom == "ffmpeg":
        try:
            import imageio_ffmpeg
            return imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            pass
    raise SystemExit(f"{nom} introuvable : installe ffmpeg avant de relancer.")


def sh(a):
    return subprocess.run(a, capture_output=True, text=True)


def mesurer(f):
    d = sh([outil("ffprobe"), "-v", "error", "-show_entries", "format=duration",
            "-of", "csv=p=0", str(f)])
    try:
        duree = float(d.stdout.strip())
    except ValueError:
        return None

    r = sh([outil("ffmpeg"), "-hide_banner", "-i", str(f), "-af",
            "ebur128=framelog=verbose", "-f", "null", "-"])
    lignes = [l for l in r.stderr.splitlines() if " I:" in l and "LUFS" in l]
    try:
        sonie = float(lignes[-1].split("I:")[1].split("LUFS")[0])
    except (IndexError, ValueError):
        sonie = -99.0

    r = sh([outil("ffmpeg"), "-hide_banner", "-i", str(f), "-af",
            "highpass=f=400,volumedetect", "-f", "null", "/dev/null"])
    m = [l for l in r.stderr.splitlines() if "mean_volume" in l]
    tel = float(m[0].split(":")[1].split("dB")[0]) if m else -99.0

    # Un silence long au milieu d'un bruitage le rend inutilisable en place :
    # on croit poser un impact, on pose un impact suivi d'un trou.
    r = sh([outil("ffmpeg"), "-hide_banner", "-i", str(f), "-af",
            "silencedetect=n=-45dB:d=0.5", "-f", "null", "-"])
    silences = len([l for l in r.stderr.splitlines() if "silence_start" in l])

    return {"duree": round(duree, 2), "sonie_lufs": round(sonie, 1),
            "telephone_db": round(tel, 1), "silences": silences}


def verdict(m, famille=None):
    raisons = []
    mini = DUREE_MINI.get(famille, DUREE_DEFAUT)
    if m["duree"] < mini:
        raisons.append(f"trop court ({m['duree']} s < {mini})")
    if m["sonie_lufs"] < SONIE_MINI:
        raisons.append(f"trop faible ({m['sonie_lufs']} LUFS < {SONIE_MINI})")
    if m["telephone_db"] < TELEPHONE_MINI:
        raisons.append(f"absent sur téléphone ({m['telephone_db']} dB < {TELEPHONE_MINI})")
    if m["silences"] > 0:
        raisons.append(f"{m['silences']} silence(s) de plus de 0,5 s")
    return (not raisons), raisons


def etiquettes(chemin):
    """Les tags viennent du dossier et du nom : rien à saisir à la main."""
    t = {p.name for p in chemin.parents if p.name in FAMILLES}
    mots = chemin.stem.lower().replace("-", "_").split("_")
    return sorted(t | {m for m in mots if len(m) > 3 and not m.isdigit()})


def main():
    for f in FAMILLES:
        (BIBLIO / "sfx" / f).mkdir(parents=True, exist_ok=True)
    for d in ("music/stems", "voice/takes"):
        (BIBLIO / d).mkdir(parents=True, exist_ok=True)

    sons = [p for p in BIBLIO.rglob("*")
            if p.suffix.lower() in {".wav", ".mp3", ".flac", ".ogg", ".m4a"}]

    entrees, retenus = [], 0
    for p in sorted(sons):
        m = mesurer(p)
        if not m:
            continue
        fam = next((f for f in FAMILLES if f in p.parts), None)
        ok, raisons = verdict(m, fam)
        retenus += ok
        entrees.append({
            "id": p.stem,
            "chemin": str(p.relative_to(RACINE)),
            "tags": etiquettes(p),
            **m,
            "utilisable": ok,
            "ecarte_parce_que": raisons,
        })

    INDEX.parent.mkdir(parents=True, exist_ok=True)
    INDEX.write_text(json.dumps({
        "seuils": {"sonie_lufs": SONIE_MINI, "telephone_db": TELEPHONE_MINI,
                   "duree_s": DUREE_MINI},
        "total": len(entrees), "utilisables": retenus,
        "sons": entrees,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"{len(entrees)} son(s) indexé(s), {retenus} utilisable(s)\n")
    if entrees:
        print(f"{'id':30} {'durée':>6} {'LUFS':>7} {'tél.':>7}  verdict")
        for e in entrees:
            v = "OK" if e["utilisable"] else "; ".join(e["ecarte_parce_que"])
            print(f"{e['id'][:30]:30} {e['duree']:>6.2f} {e['sonie_lufs']:>7.1f} "
                  f"{e['telephone_db']:>7.1f}  {v}")
    print(f"\n{INDEX.relative_to(RACINE)}")


if __name__ == "__main__":
    main()
