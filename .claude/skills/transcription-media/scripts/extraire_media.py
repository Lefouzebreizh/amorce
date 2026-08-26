#!/usr/bin/env python3
"""Ouvre une vidéo ou un audio : fiche technique, piste sonore, images clés, parole.

Pourquoi ce script existe : chaque analyse de média refait les quatre mêmes
gestes — sonder les pistes, extraire l'audio au format que le transcripteur
attend, tirer quelques images, transcrire. Les réécrire à chaque fichier coûte
du temps et introduit à chaque fois la même erreur (oublier de forcer 16 kHz
mono, ce qui fait silencieusement dérailler la transcription).

Le script ne s'arrête jamais sur un outil manquant : il fait ce qu'il peut et
dit ce que l'absence a coûté, parce qu'une fiche technique sans transcription
reste utile alors qu'un plantage ne l'est pas.

Usage :
    python3 extraire_media.py <média> --info
    python3 extraire_media.py <média> --audio          # → .wav 16 kHz mono
    python3 extraire_media.py <média> --images 8       # → 8 images réparties
    python3 extraire_media.py <média> --transcrire     # → texte horodaté
    python3 extraire_media.py <média> --tout --sortie ./extraction/
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys

# Whisper rééchantillonne de toute façon en 16 kHz mono. Le faire dès
# l'extraction évite un décodage inutile et divise la taille du fichier par six.
TAUX_TRANSCRIPTION = 16000


def _resoudre_ffmpeg() -> str | None:
    """Trouve ffmpeg, y compris quand il n'est pas dans le PATH.

    `imageio-ffmpeg` embarque un ffmpeg statique complet et se retrouve installé
    un peu partout comme dépendance d'autres outils. S'en servir évite de
    réclamer une installation système à quelqu'un qui a déjà le binaire sur son
    disque sans le savoir."""
    trouve = shutil.which("ffmpeg")
    if trouve:
        return trouve
    try:
        import imageio_ffmpeg
        chemin = imageio_ffmpeg.get_ffmpeg_exe()
        return chemin if os.path.exists(chemin) else None
    except Exception:
        return None


FFMPEG = _resoudre_ffmpeg()
FFPROBE = shutil.which("ffprobe")


def _dispo(binaire: str) -> bool:
    return {"ffmpeg": FFMPEG, "ffprobe": FFPROBE}.get(
        binaire, shutil.which(binaire)) is not None


def _exiger_ffmpeg(action: str) -> bool:
    if FFMPEG:
        return True
    print(f"✗ {action} : ffmpeg est absent.", file=sys.stderr)
    print("  → macOS : brew install ffmpeg   |   Debian/Ubuntu : sudo apt install ffmpeg",
          file=sys.stderr)
    return False


def _sonder_par_ffmpeg(chemin: str) -> str:
    """ffmpeg décrit le fichier sur sa sortie d'erreur avant de renoncer,
    faute de destination. C'est ce texte qu'on lit quand ffprobe manque."""
    return subprocess.run([FFMPEG, "-hide_banner", "-i", chemin],
                          capture_output=True, text=True).stderr


def _duree(chemin: str) -> float | None:
    """Durée en secondes, par ffprobe si présent, sinon par ffmpeg."""
    if FFPROBE:
        r = subprocess.run([FFPROBE, "-v", "error", "-show_entries",
                            "format=duration", "-of", "csv=p=0", chemin],
                           capture_output=True, text=True)
        try:
            return float(r.stdout.strip())
        except ValueError:
            return None
    if not FFMPEG:
        return None
    m = re.search(r"Duration: (\d+):(\d\d):(\d\d\.\d+)", _sonder_par_ffmpeg(chemin))
    if not m:
        return None
    h, mn, sec = m.groups()
    return int(h) * 3600 + int(mn) * 60 + float(sec)


def _info_par_ffmpeg(chemin: str) -> dict:
    """Fiche technique sans ffprobe. imageio-ffmpeg ne livre que ffmpeg, or
    c'est l'installation la plus répandue : s'en contenter plutôt que de
    dégrader vers la seule taille du fichier."""
    texte = _sonder_par_ffmpeg(chemin)
    duree = _duree(chemin) or 0.0
    o = os.path.getsize(chemin)
    lisible = f"{o / 1024:.0f} Ko" if o < 1024 ** 2 else f"{o / 1024 ** 2:.1f} Mo"
    print(f"\n── {os.path.basename(chemin)}  ({lisible})")
    print(f"   durée     : {int(duree // 60)} min {duree % 60:.1f} s")

    a_du_son = a_de_l_image = False
    for ligne in texte.splitlines():
        ligne = ligne.strip()
        if not ligne.startswith("Stream #"):
            continue
        detail = ligne.split(": ", 2)[-1]
        if ": Video:" in ligne:
            a_de_l_image = True
            print(f"   vidéo     : {detail}")
        elif ": Audio:" in ligne:
            a_du_son = True
            print(f"   audio     : {detail}")
        elif ": Subtitle:" in ligne:
            print(f"   ⭑ sous-titres présents — les extraire plutôt que transcrire :")
            print(f"     ffmpeg -i \"{chemin}\" -map 0:s:0 sous-titres.srt")

    if not a_du_son:
        print("   ⚠ aucune piste audio : rien à transcrire, l'analyse sera visuelle")
    print("   (ffprobe absent : fiche lue sur la sortie de ffmpeg)")
    return {"_a_du_son": a_du_son, "_a_de_l_image": a_de_l_image, "taille_octets": o}


def _info_sans_ffprobe(chemin: str) -> dict:
    """Repli quand ffmpeg manque. Un WAV se lit avec la bibliothèque standard :
    autant rendre la fiche complète plutôt que de s'excuser, l'utilisateur qui
    n'a que du WAV n'a alors rien à installer."""
    taille = os.path.getsize(chemin)
    mo = taille / 1024 ** 2
    lisible = f"{taille / 1024:.0f} Ko" if mo < 1 else f"{mo:.1f} Mo"
    try:
        import wave
        with wave.open(chemin, "rb") as w:
            duree = w.getnframes() / w.getframerate()
            print(f"\n── {os.path.basename(chemin)}  ({lisible})")
            print(f"   audio     : PCM {w.getframerate()} Hz, "
                  f"{w.getnchannels()} canal/aux, {w.getsampwidth() * 8} bits")
            print(f"   durée     : {int(duree // 60)} min {duree % 60:.1f} s")
            print("   ⚠ ffmpeg absent : lecture par le module « wave ». Suffisant "
                  "pour un WAV,\n     mais tout autre format restera fermé.")
            return {"_a_du_son": True, "_a_de_l_image": False, "taille_octets": taille}
    except Exception:
        pass
    print(f"⚠ ffprobe absent : seule la taille est connue ({lisible}).")
    print("  La durée, les pistes et le codec resteront inconnus sans ffmpeg.")
    return {"taille_octets": taille}


def info(chemin: str) -> dict:
    """Fiche technique du média. Sans ffprobe, se rabat sur ce qui est lisible."""
    if not FFPROBE:
        return _info_par_ffmpeg(chemin) if FFMPEG else _info_sans_ffprobe(chemin)

    sortie = subprocess.run(
        [FFPROBE, "-v", "error", "-print_format", "json",
         "-show_format", "-show_streams", chemin],
        capture_output=True, text=True)
    if sortie.returncode != 0:
        print(f"✗ ffprobe a refusé le fichier : {sortie.stderr.strip()}", file=sys.stderr)
        return {}

    donnees = json.loads(sortie.stdout)
    fmt = donnees.get("format", {})
    duree = float(fmt.get("duration", 0) or 0)
    print(f"\n── {os.path.basename(chemin)}")
    print(f"   conteneur : {fmt.get('format_long_name', '?')}")
    print(f"   durée     : {int(duree // 60)} min {int(duree % 60)} s"
          f"   ({float(fmt.get('size', 0)) / 1024**2:.1f} Mo)")

    a_du_son = a_de_l_image = False
    for piste in donnees.get("streams", []):
        genre = piste.get("codec_type")
        if genre == "video":
            a_de_l_image = True
            fps = piste.get("r_frame_rate", "0/1")
            try:
                num, den = fps.split("/"); fps = f"{float(num) / float(den):.0f}"
            except (ValueError, ZeroDivisionError):
                fps = "?"
            print(f"   vidéo     : {piste.get('codec_name')} "
                  f"{piste.get('width')}×{piste.get('height')} @ {fps} i/s")
        elif genre == "audio":
            a_du_son = True
            print(f"   audio     : {piste.get('codec_name')} "
                  f"{piste.get('sample_rate')} Hz, {piste.get('channels')} canal/aux")
        elif genre == "subtitle":
            # Un sous-titre incrusté rend la transcription inutile : il porte
            # déjà le texte, exactement, et gratuitement.
            print(f"   ⭑ sous-titres présents ({piste.get('codec_name')}) — "
                  f"les extraire plutôt que transcrire :")
            print(f"     ffmpeg -i \"{chemin}\" -map 0:s:0 sous-titres.srt")

    if not a_du_son:
        print("   ⚠ aucune piste audio : rien à transcrire, l'analyse sera visuelle")
    donnees["_a_du_son"] = a_du_son
    donnees["_a_de_l_image"] = a_de_l_image
    return donnees


def extraire_audio(chemin: str, sortie: str) -> str | None:
    """Extrait la piste sonore en WAV 16 kHz mono, prêt pour la transcription."""
    if not _exiger_ffmpeg("extraction audio"):
        return None
    cible = os.path.join(sortie, os.path.splitext(os.path.basename(chemin))[0] + ".wav")
    resultat = subprocess.run(
        [FFMPEG, "-v", "error", "-y", "-i", chemin, "-vn",
         "-ac", "1", "-ar", str(TAUX_TRANSCRIPTION), "-c:a", "pcm_s16le", cible],
        capture_output=True, text=True)
    if resultat.returncode != 0:
        print(f"✗ extraction audio : {resultat.stderr.strip()}", file=sys.stderr)
        return None
    print(f"✓ audio → {cible}  ({os.path.getsize(cible) / 1024**2:.1f} Mo)")
    return cible


def extraire_images(chemin: str, sortie: str, nombre: int) -> list[str]:
    """Tire N images réparties sur toute la durée.

    Réparties, et non les N premières : les premières secondes d'une vidéo se
    ressemblent toutes et ne disent rien de ce qu'elle raconte.
    """
    if not _exiger_ffmpeg("extraction d'images"):
        return []
    duree = _duree(chemin)
    if duree is None:
        print("✗ durée illisible, impossible de répartir les images", file=sys.stderr)
        return []

    fichiers = []
    for i in range(nombre):
        # Décalage d'un demi-intervalle : à l'instant 0 beaucoup de vidéos
        # commencent sur un fondu au noir, et la dernière image tombe souvent
        # après la fin utile.
        instant = duree * (i + 0.5) / nombre
        cible = os.path.join(sortie, f"image_{i:02d}_{int(instant)}s.jpg")
        r = subprocess.run(
            [FFMPEG, "-v", "error", "-y", "-ss", f"{instant:.2f}",
             "-i", chemin, "-frames:v", "1", "-q:v", "3", cible],
            capture_output=True, text=True)
        if r.returncode == 0 and os.path.exists(cible):
            fichiers.append(cible)
    print(f"✓ {len(fichiers)} images → {sortie}")
    return fichiers


def transcrire(audio: str, sortie: str, taille: str = "small") -> str | None:
    """Transcrit en local avec faster-whisper. Aucune donnée ne quitte la machine."""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("✗ transcription : faster-whisper est absent.", file=sys.stderr)
        print("  → pip install faster-whisper", file=sys.stderr)
        print("  (modèle local, sans clé API ; le premier lancement télécharge "
              "le modèle une fois pour toutes)", file=sys.stderr)
        return None

    print(f"… transcription avec le modèle « {taille} » (compte environ le tiers "
          f"de la durée du média sur un processeur récent)")
    modele = WhisperModel(taille, device="cpu", compute_type="int8")
    segments, meta = modele.transcribe(audio, beam_size=5, vad_filter=True)
    print(f"  langue détectée : {meta.language} "
          f"(confiance {meta.language_probability:.0%})")

    lignes = []
    for s in segments:
        # L'horodatage n'est pas décoratif : il permet de citer un passage et
        # de retourner l'écouter, ce qu'un mur de texte interdit.
        debut = f"{int(s.start // 60):02d}:{int(s.start % 60):02d}"
        lignes.append(f"[{debut}] {s.text.strip()}")
        print(lignes[-1])

    cible = os.path.join(sortie, os.path.splitext(os.path.basename(audio))[0] + ".txt")
    with open(cible, "w", encoding="utf-8") as f:
        f.write("\n".join(lignes))
    print(f"✓ transcription → {cible}")
    return cible


# Formats que faster-whisper ouvre sans l'aide du binaire ffmpeg.
EXTENSIONS_AUDIO = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".opus", ".aac", ".wma"}


def _est_deja_audio(chemin: str) -> bool:
    return os.path.splitext(chemin)[1].lower() in EXTENSIONS_AUDIO


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("media")
    p.add_argument("--info", action="store_true", help="fiche technique seule")
    p.add_argument("--audio", action="store_true", help="extraire la piste sonore")
    p.add_argument("--images", type=int, metavar="N", help="extraire N images réparties")
    p.add_argument("--transcrire", action="store_true", help="transcrire la parole")
    p.add_argument("--tout", action="store_true", help="fiche + audio + images + parole")
    p.add_argument("--sortie", default="./extraction", help="répertoire de sortie")
    p.add_argument("--modele", default="small",
                   help="taille du modèle whisper : tiny, base, small, medium, large-v3")
    a = p.parse_args()

    if not os.path.isfile(a.media):
        print(f"✗ fichier introuvable : {a.media}", file=sys.stderr)
        return 1
    os.makedirs(a.sortie, exist_ok=True)

    # La fiche technique est toujours produite : elle dit s'il y a du son à
    # transcrire, et signale les sous-titres qui rendraient la transcription
    # inutile. La calculer après coup ferait travailler pour rien.
    fiche = info(a.media)

    if a.info and not a.tout:
        return 0

    audio = None
    veut_du_son = a.audio or a.transcrire or a.tout
    # faster-whisper décode lui-même : un fichier déjà sonore se transcrit tel
    # quel. Le constater avant de tenter l'extraction évite d'afficher un échec
    # ffmpeg pour une étape dont on n'avait pas besoin.
    transcription_seule = (a.transcrire and not a.audio and not a.tout)

    if veut_du_son and not fiche.get("_a_du_son", True):
        print("… extraction audio ignorée : le média n'a pas de piste sonore")
    elif transcription_seule and _est_deja_audio(a.media):
        print("… le fichier est déjà une piste sonore : transcription directe")
        audio = a.media
    elif veut_du_son:
        audio = extraire_audio(a.media, a.sortie)
        # L'extraction a pu échouer faute de ffmpeg alors que le fichier était
        # déjà exploitable : ne pas renoncer à la transcription pour autant.
        if audio is None and _est_deja_audio(a.media):
            print("… repli sur le fichier source, que le transcripteur sait décoder")
            audio = a.media

    # « --tout » sur un fichier purement sonore ne doit pas partir en quête
    # d'images : ffmpeg échouerait huit fois de suite pour rien. Une demande
    # explicite de --images passe outre, au cas où la fiche se tromperait.
    if a.images or (a.tout and fiche.get("_a_de_l_image", True)):
        extraire_images(a.media, a.sortie, a.images or 8)
    elif a.tout:
        print("… extraction d'images ignorée : le média n'a pas de piste vidéo")

    if (a.transcrire or a.tout) and audio:
        transcrire(audio, a.sortie, a.modele)

    return 0


if __name__ == "__main__":
    sys.exit(main())
