#!/usr/bin/env python3
"""Transcrire hors ligne quand `huggingface.co` est refusé.

`faster-whisper` va chercher ses poids sur Hugging Face, que la politique de
sortie des sessions distantes refuse au CONNECT. Ce n'est pas contournable en
ruse — mais deux hôtes restent autorisés, et il suffit d'y aller :

- **PyPI en direct** : le mandataire le liste dans `noProxy`, donc `pip` passe
  sans passer par lui. Tout modèle livré dans une roue s'installe (repli
  `pocketsphinx`, 38 Mo d'anglais dans le paquet, zéro téléchargement).
- **Les objets de release GitHub** : `github.com` redirige vers
  `release-assets.githubusercontent.com`, qui répond. Les modèles sherpa-onnx
  y sont publiés, Whisper compris.

Mesuré le 27 août 2026 : `huggingface.co`, `alphacephei.com` et
`openaipublic.azureedge.net` répondent tous en échec ; les deux routes
ci-dessus rendent 200. C'est pourquoi ce fichier existe.

Deux familles de modèles, et le choix n'est pas cosmétique :

- **Whisper** (multilingue) rend du texte, **sans instants**. C'est ce qu'il
  faut pour « qu'est-ce qui se dit ».
- **Zipformer** rend du texte **et un instant par jeton**, mais n'existe qu'en
  anglais dans cette release. C'est ce qu'il faut pour « à quelle seconde
  commence tel mot » — la question qui cale une voix off sur une image.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tarfile
import urllib.request

RELEASE = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models"

# Tailles relevées par requête HEAD le 27 août 2026 ; elles servent à prévenir
# l'utilisateur avant un téléchargement, pas à vérifier quoi que ce soit.
MODELES = {
    "tiny":      ("whisper", "sherpa-onnx-whisper-tiny", 116),
    "base":      ("whisper", "sherpa-onnx-whisper-base", 208),
    "small":     ("whisper", "sherpa-onnx-whisper-small", 639),
    "medium":    ("whisper", "sherpa-onnx-whisper-medium", 1931),
    "tiny.en":   ("whisper", "sherpa-onnx-whisper-tiny.en", 118),
    "instants":  ("zipformer", "sherpa-onnx-zipformer-en-2023-06-26", 308),
}

CACHE = os.path.expanduser("~/.cache/sherpa-onnx-modeles")


def _ffmpeg() -> str:
    """Le binaire, où qu'il soit — le hook du dépôt le relie parfois ailleurs."""
    for c in ("ffmpeg", "/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"):
        if subprocess.run(["which", c], capture_output=True).returncode == 0 or os.path.exists(c):
            return c
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit("✗ ffmpeg introuvable → apt-get update && apt-get install -y ffmpeg")


def en_16k_mono(media: str, sortie: str) -> str:
    """Les reconnaisseurs n'acceptent que du 16 kHz mono ; on ne négocie pas."""
    cible = os.path.join(sortie, "asr-16k.wav")
    subprocess.run([_ffmpeg(), "-v", "error", "-y", "-i", media,
                    "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", cible],
                   check=True)
    return cible


def obtenir_modele(cle: str) -> tuple[str, str]:
    """Rend (famille, dossier). Ne retélécharge pas ce qui est déjà là."""
    if cle not in MODELES:
        sys.exit(f"✗ modèle inconnu : {cle}. Au choix : {', '.join(MODELES)}")
    famille, nom, mo = MODELES[cle]
    dossier = os.path.join(CACHE, nom)
    if os.path.isdir(dossier):
        return famille, dossier

    os.makedirs(CACHE, exist_ok=True)
    archive = os.path.join(CACHE, nom + ".tar.bz2")
    url = f"{RELEASE}/{nom}.tar.bz2"
    print(f"… {nom} ({mo} Mo) depuis les objets de release GitHub", file=sys.stderr)
    print("  (une seule fois ; ensuite il est en cache)", file=sys.stderr)
    try:
        urllib.request.urlretrieve(url, archive)
    except Exception as e:                                    # noqa: BLE001
        sys.exit(f"✗ téléchargement refusé : {e}\n"
                 "  Si même les objets de release GitHub sont fermés, le repli\n"
                 "  sans aucun réseau est `pip install pocketsphinx` : la roue\n"
                 "  embarque 38 Mo de modèle anglais. Voir --pocketsphinx.")
    with tarfile.open(archive, "r:bz2") as t:
        t.extractall(CACHE)
    os.remove(archive)
    return famille, dossier


def _reconnaisseur(famille: str, d: str):
    import sherpa_onnx
    n = os.path.basename(d).replace("sherpa-onnx-whisper-", "")
    if famille == "whisper":
        return sherpa_onnx.OfflineRecognizer.from_whisper(
            encoder=f"{d}/{n}-encoder.int8.onnx",
            decoder=f"{d}/{n}-decoder.int8.onnx",
            tokens=f"{d}/{n}-tokens.txt")
    return sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=f"{d}/encoder-epoch-99-avg-1.int8.onnx",
        decoder=f"{d}/decoder-epoch-99-avg-1.onnx",
        joiner=f"{d}/joiner-epoch-99-avg-1.int8.onnx",
        tokens=f"{d}/tokens.txt")


def mots_dates(tokens: list[str], instants: list[float]) -> list[tuple[str, float]]:
    """Recolle les jetons en mots.

    Le zipformer marque un début de mot par une **espace en tête** du jeton, et
    non par le « ▁ » qu'on trouve ailleurs. Une session s'y est trompée et a vu
    ses vingt-six jetons fondre en un seul mot : d'où ce commentaire.
    """
    mots: list[list] = []
    for tok, t in zip(tokens, instants):
        if tok.startswith(" ") or not mots:
            mots.append([tok.strip(), t])
        else:
            mots[-1][0] += tok
    return [(m, t) for m, t in mots if m]


def transcrire(media: str, cle: str, sortie: str) -> int:
    import numpy as np
    import wave

    os.makedirs(sortie, exist_ok=True)
    wav = en_16k_mono(media, sortie)
    famille, dossier = obtenir_modele(cle)
    r = _reconnaisseur(famille, dossier)

    w = wave.open(wav)
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    duree = len(x) / w.getframerate()
    s = r.create_stream()
    s.accept_waveform(w.getframerate(), x)
    r.decode_stream(s)

    print(f"\n{os.path.basename(media)} — {duree:.2f} s\n")
    print(s.result.text.strip() or "(aucune parole reconnue)")

    if famille == "zipformer" and s.result.timestamps:
        print("\ninstants par mot :")
        for mot, t in mots_dates(list(s.result.tokens), list(s.result.timestamps)):
            print(f"  {t:7.2f} s   {mot}")
    elif famille == "whisper":
        print("\n(Whisper ne rend aucun instant. Pour dater un mot : --modele instants,"
              "\n anglais seulement — il n'existe pas de zipformer français dans cette"
              "\n release, vérifié plutôt que supposé.)")
    return 0


def pocketsphinx(media: str, sortie: str) -> int:
    """Dernier repli : le modèle voyage dans la roue PyPI, rien à télécharger."""
    import wave
    from pocketsphinx import Decoder, get_model_path

    os.makedirs(sortie, exist_ok=True)
    wav = en_16k_mono(media, sortie)
    mp = get_model_path()
    c = Decoder.default_config()
    c.set_string("-hmm", os.path.join(mp, "en-us"))
    c.set_string("-lm", os.path.join(mp, "en-us.lm.bin"))
    c.set_string("-dict", os.path.join(mp, "cmudict-en-us.dict"))
    d = Decoder(c)
    d.start_utt()
    d.process_raw(wave.open(wav).readframes(-1), full_utt=True)
    d.end_utt()
    print(d.hyp().hypstr if d.hyp() else "(aucune parole reconnue)")
    print("\ninstants par mot :")
    for seg in d.seg():
        print(f"  {seg.start_frame / 100:7.2f} s   {seg.word}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("media")
    p.add_argument("--modele", default="base",
                   help=f"{', '.join(MODELES)} (défaut : base)")
    p.add_argument("--instants", action="store_true",
                   help="instants par mot — force le zipformer anglais")
    p.add_argument("--pocketsphinx", action="store_true",
                   help="repli sans aucun réseau, anglais, qualité moindre")
    p.add_argument("--sortie", default="/tmp/asr")
    a = p.parse_args()

    if not os.path.exists(a.media):
        sys.exit(f"✗ introuvable : {a.media}")
    if a.pocketsphinx:
        return pocketsphinx(a.media, a.sortie)
    return transcrire(a.media, "instants" if a.instants else a.modele, a.sortie)


if __name__ == "__main__":
    raise SystemExit(main())
