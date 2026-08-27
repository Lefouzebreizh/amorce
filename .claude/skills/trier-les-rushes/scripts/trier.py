"""
Inventaire mesuré d'un lot de médias.

Un lot de rushes arrive rarement par un ou deux : c'est quinze, trente,
cinquante fichiers déposés d'un coup, aux noms illisibles, avec des doublons et
quatre variantes de chaque prise. Les ouvrir un par un coûte une demi-heure et
laisse passer l'essentiel.

Trois choses, mesurées ici, ont chacune déjà coûté une nuit :

1. **Les doublons.** Un plan écarté du montage pour une raison d'image se
   révélait être, au bit près, le seul fichier portant les vraies répliques.
   Personne ne l'avait vu parce que les deux noms n'avaient rien en commun.
   L'empreinte, elle, ne ment pas.

2. **La définition.** On peut monter des heures en 768 × 1344 sans remarquer
   qu'une version 1456 × 2544 du même plan dormait dans le même dossier.

3. **La parole.** Repérer quel fichier contient une voix ne demande pas de le
   transcrire : la parole se voit à son rythme — des salves courtes et
   nombreuses — là où le tonnerre ou la musique forment un bloc continu. Ça
   suffit à savoir où chercher.

S'y ajoute l'énergie au-dessus de 400 Hz, la limite basse d'un haut-parleur de
téléphone. Sur quatre prises du même bruitage, c'est ce chiffre qui départage,
et il ne s'entend pas au casque.
"""

import hashlib
import json
import re
import shutil
import subprocess
import sys
import wave
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

SOL_TELEPHONE = 400
EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v",
              ".mp3", ".wav", ".m4a", ".flac", ".ogg", ".aac"}


def outil(nom):
    chemin = shutil.which(nom)
    if chemin:
        return chemin
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        return exe if nom == "ffmpeg" else exe.replace("ffmpeg", "ffprobe")
    except Exception:
        raise SystemExit(f"{nom} introuvable : installe ffmpeg avant de relancer.")


FFMPEG, FFPROBE = outil("ffmpeg"), outil("ffprobe")


def lancer(args):
    return subprocess.run(args, capture_output=True, text=True)


def empreinte(chemin):
    """Empreinte du fichier. Seule façon fiable de reconnaître deux copies."""
    h = hashlib.md5()
    with open(chemin, "rb") as f:
        for bloc in iter(lambda: f.read(1 << 20), b""):
            h.update(bloc)
    return h.hexdigest()


def fiche(chemin):
    r = lancer([FFPROBE, "-v", "error", "-show_entries",
                "format=duration:stream=codec_type,width,height",
                "-of", "json", str(chemin)])
    try:
        d = json.loads(r.stdout)
    except json.JSONDecodeError:
        return None
    flux = d.get("streams", [])
    video = next((s for s in flux if s.get("codec_type") == "video"), None)
    return {
        "duree": round(float(d.get("format", {}).get("duration", 0) or 0), 2),
        "largeur": video.get("width") if video else None,
        "hauteur": video.get("height") if video else None,
        "a_video": video is not None,
        "a_son": any(s.get("codec_type") == "audio" for s in flux),
    }


def signal(chemin, sr=16000):
    tmp = Path(f"/tmp/_trier_{hash(str(chemin)) & 0xffffff}.wav")
    lancer([FFMPEG, "-v", "error", "-y", "-i", str(chemin), "-vn",
            "-ac", "1", "-ar", str(sr), "-c:a", "pcm_s16le", str(tmp)])
    if not tmp.exists():
        return None, sr
    try:
        with wave.open(str(tmp)) as w:
            x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
        return x.astype(np.float32) / 32768.0, sr
    finally:
        tmp.unlink(missing_ok=True)


def bande(x, sr, bas, haut=None):
    """Le signal restreint à une bande de fréquences."""
    spectre = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / sr)
    masque = freqs < bas
    if haut:
        masque |= freqs > haut
    spectre[masque] = 0
    return np.fft.irfft(spectre, n=len(x))


def db(x):
    r = float(np.sqrt(np.mean(x ** 2)))
    return round(20 * np.log10(r + 1e-9), 1)


def salves(x, sr, seuil=0.18):
    """
    Compte les salves d'énergie dans la bande de parole.

    Une voix découpe son signal : des salves courtes séparées de blancs, une
    par groupe de mots. Un tonnerre, une nappe ou une musique produisent au
    contraire un bloc continu. Le nombre de salves suffit donc à dire « il y a
    quelqu'un qui parle là-dedans » sans rien transcrire — et c'est
    précisément ce dont on a besoin pour savoir quel fichier ouvrir.
    """
    p = bande(x, sr, 300, 3400)
    saut = int(0.02 * sr)
    n = len(p) // saut
    if n < 5:
        return 0
    env = np.sqrt(np.mean(p[: n * saut].reshape(n, saut) ** 2, axis=1))
    if env.max() <= 0:
        return 0
    actif = env > env.max() * seuil
    # Une salve = une montée. On ignore celles de moins de 120 ms, qui sont
    # des impacts plutôt que des syllabes.
    debuts = np.flatnonzero(np.diff(actif.astype(int)) == 1)
    fins = np.flatnonzero(np.diff(actif.astype(int)) == -1)
    n = min(len(debuts), len(fins))
    return int(sum(1 for i in range(n) if (fins[i] - debuts[i]) * 0.02 >= 0.12))


def examiner(chemin):
    f = fiche(chemin)
    if not f:
        return {"fichier": chemin.name, "chemin": str(chemin), "erreur": "illisible"}

    r = {
        "fichier": chemin.name,
        "chemin": str(chemin),
        "empreinte": empreinte(chemin),
        "poids_mo": round(chemin.stat().st_size / 1048576, 1),
        **f,
    }
    r["definition"] = f"{f['largeur']}x{f['hauteur']}" if f["a_video"] else "—"
    r["pixels"] = (f["largeur"] or 0) * (f["hauteur"] or 0)

    if f["a_son"] and f["duree"] > 0.1:
        x, sr = signal(chemin)
        if x is not None and len(x) > sr // 8:
            r["niveau_db"] = db(x)
            r["telephone_db"] = db(bande(x, sr, SOL_TELEPHONE))
            r["perte_db"] = round(r["niveau_db"] - r["telephone_db"], 1)
            r["salves_parole"] = salves(x, sr)
    return r


def planche(fiches, sortie, largeur=6):
    """Une image par fichier vidéo, en grille. Ce que le lot montre, d'un œil."""
    videos = [f for f in fiches if f.get("a_video") and f.get("duree", 0) > 0]
    if not videos:
        return None
    dossier = Path("/tmp/_trier_planche")
    shutil.rmtree(dossier, ignore_errors=True)
    dossier.mkdir(parents=True)

    def tirer(i_f):
        i, f = i_f
        lancer([FFMPEG, "-v", "error", "-ss", f"{f['duree'] * 0.4:.2f}",
                "-i", f["chemin"], "-frames:v", "1",
                "-vf", "scale=200:-2", "-y", str(dossier / f"{i:03d}.png")])

    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(tirer, enumerate(videos)))

    images = sorted(dossier.glob("*.png"))
    if not images:
        return None
    lignes = (len(images) + largeur - 1) // largeur
    lancer([FFMPEG, "-v", "error", "-i", str(dossier / "%03d.png"),
            "-filter_complex", f"tile={largeur}x{lignes}:margin=8:padding=8:color=#0d1117",
            "-frames:v", "1", "-y", str(sortie)])
    return str(sortie) if Path(sortie).exists() else None


def famille(nom):
    """
    Regroupe les variantes d'une même génération.

    Les générateurs rendent quatre prises du même prompt, nommées à la suite.
    Les réunir permet de ne garder que la meilleure au lieu de les juger
    isolément — un −24 dB paraît correct seul, médiocre à côté d'un −16.
    """
    base = Path(nom).stem
    # Les fichiers déposés portent un préfixe technique et les générateurs
    # collent un horodatage : ni l'un ni l'autre n'appartient au nom réel, et
    # les garder dispersait les quatre prises d'une même génération.
    base = re.sub(r"^[0-9a-f]{6,}-", "", base)
    base = re.sub(r"\d{6,}$", "", base)
    base = re.sub(r"[_\-\s]*\d{1,2}$", "", base)
    return base.strip(" _-")[:40] or base


def tableau(fiches):
    lignes = ["| fichier | durée | définition | son | téléphone | perte | parole |",
              "| --- | --- | --- | --- | --- | --- | --- |"]
    for f in sorted(fiches, key=lambda x: (-x.get("telephone_db", -99))):
        if "erreur" in f:
            lignes.append(f"| {f['fichier']} | — | — | illisible | — | — | — |")
            continue
        parole = f"**{f['salves_parole']}**" if f.get("salves_parole", 0) >= 4 else str(f.get("salves_parole", "—"))
        lignes.append(
            f"| {f['fichier'][:44]} | {f['duree']}s | {f['definition']} | "
            f"{f.get('niveau_db', '—')} | {f.get('telephone_db', '—')} | "
            f"{f.get('perte_db', '—')} | {parole} |"
        )
    return "\n".join(lignes)


def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage : trier.py <dossier ou fichiers…> [--sortie <dossier>]")

    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    sortie = Path("tri")
    if "--sortie" in sys.argv:
        sortie = Path(sys.argv[sys.argv.index("--sortie") + 1])
    sortie.mkdir(parents=True, exist_ok=True)

    chemins = []
    for a in args:
        p = Path(a)
        if p.is_dir():
            chemins += [q for q in sorted(p.rglob("*")) if q.suffix.lower() in EXTENSIONS]
        elif p.suffix.lower() in EXTENSIONS:
            chemins.append(p)
    if not chemins:
        raise SystemExit("aucun média trouvé.")

    with ThreadPoolExecutor(max_workers=6) as pool:
        fiches = list(pool.map(examiner, chemins))

    # Doublons : même empreinte, noms différents.
    par_empreinte = {}
    for f in fiches:
        par_empreinte.setdefault(f.get("empreinte"), []).append(f["fichier"])
    doublons = {k: v for k, v in par_empreinte.items() if k and len(v) > 1}

    # Familles : les variantes d'une même génération, et la meilleure de chaque.
    par_famille = {}
    for f in fiches:
        par_famille.setdefault(famille(f["fichier"]), []).append(f)
    meilleures = {}
    for nom, groupe in par_famille.items():
        if len(groupe) < 2:
            continue
        avec_son = [g for g in groupe if "telephone_db" in g]
        if avec_son:
            gagnant = max(avec_son, key=lambda g: g["telephone_db"])
            meilleures[nom] = {
                "garder": gagnant["fichier"],
                "telephone_db": gagnant["telephone_db"],
                "ecart_avec_la_pire": round(
                    gagnant["telephone_db"] - min(g["telephone_db"] for g in avec_son), 1),
                "prises": len(groupe),
            }

    img = planche(fiches, sortie / "planche.png")

    rapport = {
        "fichiers": len(fiches),
        "doublons": doublons,
        "meilleure_prise_par_famille": meilleures,
        "parle_probablement": sorted(
            [f["fichier"] for f in fiches if f.get("salves_parole", 0) >= 4]),
        "meilleure_definition": max(
            (f for f in fiches if f.get("pixels")), key=lambda f: f["pixels"], default={}
        ).get("fichier"),
        "planche": img,
        "fiches": fiches,
    }
    (sortie / "inventaire.json").write_text(
        json.dumps(rapport, ensure_ascii=False, indent=2), encoding="utf-8")
    (sortie / "inventaire.md").write_text(tableau(fiches), encoding="utf-8")

    print(tableau(fiches))
    print()
    print(json.dumps({k: v for k, v in rapport.items() if k != "fiches"},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
