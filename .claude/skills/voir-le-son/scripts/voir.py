"""
Dessine un média pour qu'il devienne regardable.

Claude ne peut pas écouter. Il peut lire une image. Toute la compétence tient
dans ce détour : une mesure agrégée — « niveau moyen −14 dB » — dit qu'un son
est fort, jamais où son énergie se trouve ni ce qui manque. Une planche dit les
deux d'un coup d'œil.

Ce qui a motivé ce script : un montage mesuré à −14 LUFS, donc « conforme »,
était quasi muet sur un téléphone. Toute son énergie vivait sous 400 Hz, la
limite basse d'un haut-parleur de téléphone. Six versions ont été livrées avant
qu'on le comprenne. Un seul spectrogramme l'aurait montré en une seconde : un
gros bloc lumineux en bas, un grand vide au-dessus.

D'où le trait rouge à 400 Hz sur chaque spectrogramme. Ce n'est pas une
décoration : c'est le sol au-dessus duquel un son doit exister pour être
entendu là où la vidéo sera regardée.
"""

import json
import shutil
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

import matplotlib
matplotlib.use("Agg")  # aucun affichage disponible : on écrit des fichiers
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec

# Un haut-parleur de téléphone ne restitue à peu près rien en dessous.
# Tout ce qui vit sous cette barre est perdu pour le format court.
SOL_TELEPHONE = 400


def ffmpeg():
    for nom in ("ffmpeg", "ffmpeg-static"):
        chemin = shutil.which(nom)
        if chemin:
            return chemin
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        raise SystemExit("ffmpeg introuvable : installe-le avant de relancer.")


def ffprobe():
    """Chemin de ffprobe, cherché avant d'être déduit.

    Le déduire du chemin de ffmpeg par remplacement de chaîne suppose que les
    deux binaires cohabitent. C'est faux dès qu'ffmpeg vient d'un paquet Python
    et ffprobe du système : ici, /usr/local/bin/ffmpeg et /usr/bin/ffprobe. Le
    chemin fabriqué n'existait pas, et le script mourait sur un FileNotFoundError
    qui ne nommait pas la cause.
    """
    trouve = shutil.which("ffprobe")
    if trouve:
        return trouve
    deduit = ffmpeg().replace("ffmpeg", "ffprobe")
    if Path(deduit).exists():
        return deduit
    raise SystemExit(
        "ffprobe introuvable. Il ne vient pas avec imageio-ffmpeg : "
        "l'installer par le système (apt install ffmpeg) ou l'ajouter au PATH.")


def lancer(args):
    return subprocess.run(args, capture_output=True, text=True)


def duree(source):
    r = lancer([ffprobe(), "-v", "error",
                "-show_entries", "format=duration", "-of", "csv=p=0", str(source)])
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def a_du_son(source):
    r = lancer([ffprobe(), "-v", "error", "-select_streams", "a",
                "-show_entries", "stream=codec_name", "-of", "csv=p=0", str(source)])
    return bool(r.stdout.strip())


def signal_mono(source, sr=22050):
    """Rend le signal en mono, normalisé entre -1 et 1."""
    tmp = Path("/tmp/_voir_le_son.wav")
    lancer([ffmpeg(), "-v", "error", "-y", "-i", str(source),
            "-vn", "-ac", "1", "-ar", str(sr), "-c:a", "pcm_s16le", str(tmp)])
    if not tmp.exists():
        return None, sr
    with wave.open(str(tmp)) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    return x.astype(np.float32) / 32768.0, sr


def spectrogramme(x, sr, fenetre=2048, saut=512):
    """Spectrogramme en décibels, sans dépendance de plus que numpy."""
    fen = np.hanning(fenetre)
    n = 1 + (len(x) - fenetre) // saut
    if n < 1:
        return np.zeros((fenetre // 2, 1)), np.array([0.0])
    trames = np.lib.stride_tricks.as_strided(
        x, shape=(n, fenetre), strides=(x.strides[0] * saut, x.strides[0])
    ) * fen
    spectre = np.abs(np.fft.rfft(trames, axis=1))[:, 1:]
    db = 20 * np.log10(spectre.T + 1e-9)
    return db, np.arange(n) * saut / sr


def sonie_glissante(x, sr, fenetre=0.4):
    """Niveau efficace par tranche, en décibels. Approche la sonie perçue."""
    pas = max(1, int(fenetre * sr))
    n = len(x) // pas
    if n < 1:
        return np.array([0.0]), np.array([0.0])
    bloc = x[: n * pas].reshape(n, pas)
    rms = np.sqrt(np.mean(bloc ** 2, axis=1))
    return 20 * np.log10(rms + 1e-9), np.arange(n) * fenetre


def bande_telephone(x, sr):
    """Le même signal, privé de ce qu'un téléphone ne restitue pas."""
    spectre = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / sr)
    spectre[freqs < SOL_TELEPHONE] = 0
    return np.fft.irfft(spectre, n=len(x))


def vignettes(source, sortie, combien=8):
    """Planche de vignettes : ce que le film montre, en une image."""
    d = duree(source)
    if d <= 0:
        return None
    dossier = Path("/tmp/_voir_vignettes")
    shutil.rmtree(dossier, ignore_errors=True)
    dossier.mkdir(parents=True)
    for i in range(combien):
        t = d * (i + 0.5) / combien
        lancer([ffmpeg(), "-v", "error", "-ss", f"{t:.3f}", "-i", str(source),
                "-frames:v", "1", "-vf", "scale=240:-1", "-y", str(dossier / f"{i:02d}.png")])
    images = sorted(dossier.glob("*.png"))
    if not images:
        return None
    lancer([ffmpeg(), "-v", "error", "-i", str(dossier / "%02d.png"),
            "-filter_complex", f"tile={len(images)}x1:margin=6:padding=6",
            "-frames:v", "1", "-y", str(sortie)])
    return sortie if Path(sortie).exists() else None


def planche(source, sortie):
    """
    La planche sonore : spectrogramme, sonie, et ce qui reste sur un téléphone.

    Les trois se lisent ensemble. Le spectrogramme dit *où* l'énergie se trouve,
    la sonie dit *quand*, et la courbe téléphone dit ce qui en survivra chez le
    spectateur. Un défaut invisible sur l'une saute aux yeux sur une autre.
    """
    x, sr = signal_mono(source)
    if x is None or len(x) < sr // 4:
        return None, {}

    db, t_spec = spectrogramme(x, sr)
    freqs = np.linspace(0, sr / 2, db.shape[0])

    niveau, t_niv = sonie_glissante(x, sr)
    niveau_tel, _ = sonie_glissante(bande_telephone(x, sr), sr)

    fig = plt.figure(figsize=(16, 10), facecolor="#0d1117")
    gs = GridSpec(2, 1, height_ratios=[2.1, 1], hspace=0.28)

    # --- Spectrogramme -----------------------------------------------------
    ax = fig.add_subplot(gs[0])
    ax.set_facecolor("#0d1117")
    haut = float(np.percentile(db, 99.5))
    ax.pcolormesh(t_spec, freqs, db, cmap="magma", shading="auto",
                  vmin=haut - 65, vmax=haut)
    ax.set_yscale("log")
    ax.set_ylim(40, sr / 2)
    ax.axhline(SOL_TELEPHONE, color="#ff3b5c", lw=2.4, ls="--")
    ax.annotate("400 Hz — un téléphone ne restitue rien en dessous",
                xy=(0, SOL_TELEPHONE), xycoords=ax.get_yaxis_transform(),
                xytext=(6, 6), textcoords="offset points",
                color="#ffd7de", fontsize=12, va="bottom",
                bbox=dict(boxstyle="round,pad=0.3", fc="#8b1a2b", ec="#ff3b5c", lw=1))
    ax.set_ylabel("fréquence (Hz)", color="#c9d1d9", fontsize=12)
    ax.set_title("Où vit l'énergie du son", color="#e6edf3", fontsize=16, pad=12, loc="left")
    for cote in ax.spines.values():
        cote.set_color("#30363d")
    ax.tick_params(colors="#8b949e")

    # --- Sonie -------------------------------------------------------------
    ax2 = fig.add_subplot(gs[1])
    ax2.set_facecolor("#0d1117")
    ax2.plot(t_niv, niveau, color="#58a6ff", lw=2.2, label="tout le signal")
    ax2.plot(t_niv, niveau_tel, color="#ff3b5c", lw=2.2, label="ce qu'un téléphone laisse passer")
    ax2.fill_between(t_niv, niveau_tel, niveau, color="#58a6ff", alpha=0.13)
    ax2.set_ylim(-60, 0)
    ax2.set_xlim(0, max(t_niv[-1], 0.1))
    ax2.set_xlabel("temps (s)", color="#c9d1d9", fontsize=12)
    ax2.set_ylabel("niveau (dB)", color="#c9d1d9", fontsize=12)
    ax2.set_title("L'écart entre les deux courbes est ce que le spectateur perd",
                  color="#e6edf3", fontsize=15, pad=10, loc="left")
    ax2.grid(color="#21262d", lw=0.8)
    ax2.legend(facecolor="#161b22", edgecolor="#30363d", labelcolor="#c9d1d9", fontsize=11)
    for cote in ax2.spines.values():
        cote.set_color("#30363d")
    ax2.tick_params(colors="#8b949e")

    fig.savefig(sortie, dpi=96, facecolor="#0d1117", bbox_inches="tight")
    plt.close(fig)

    perte = float(np.mean(niveau) - np.mean(niveau_tel))
    return sortie, {
        "niveau_moyen_db": round(float(np.mean(niveau)), 1),
        "niveau_moyen_telephone_db": round(float(np.mean(niveau_tel)), 1),
        "perte_sur_telephone_db": round(perte, 1),
        "verdict": (
            "grave — l'essentiel du son n'existera pas sur un téléphone" if perte > 10 else
            "à surveiller — une part notable se perd" if perte > 6 else
            "bon — le son survit à un haut-parleur de téléphone"
        ),
        "silences": [
            round(float(t), 1) for t, v in zip(t_niv, niveau_tel) if v < -45
        ][:12],
    }


def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage : voir.py <média> [dossier de sortie]")
    source = Path(sys.argv[1])
    # `etalonner.py`, la compétence sœur, prend sa sortie en `-o`. Ici elle est
    # positionnelle, et sans ce garde-fou un `-o` mal placé crée un dossier
    # nommé « -o » dans le dépôt sans que rien ne le signale.
    if len(sys.argv) > 2 and sys.argv[2].startswith("-"):
        raise SystemExit(
            f"« {sys.argv[2]} » n'est pas une option ici : le dossier de sortie "
            "est positionnel.\n  usage : voir.py <média> [dossier de sortie]")
    dossier = Path(sys.argv[2]) if len(sys.argv) > 2 else Path.cwd() / "regard"
    dossier.mkdir(parents=True, exist_ok=True)
    base = dossier / source.stem

    rapport = {"source": str(source), "duree_s": round(duree(source), 2), "images": []}

    if a_du_son(source):
        img, mesures = planche(source, f"{base}-son.png")
        if img:
            rapport["images"].append(str(img))
            rapport["son"] = mesures
    else:
        rapport["son"] = {"verdict": "aucune piste sonore"}

    vign = vignettes(source, f"{base}-images.png")
    if vign:
        rapport["images"].append(str(vign))

    print(json.dumps(rapport, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
