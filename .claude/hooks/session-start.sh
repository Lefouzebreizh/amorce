#!/bin/bash
# Prépare le conteneur d'une session distante : dépendances du studio Amorce,
# SDK Flutter et dépendances de Look & Find, bibliothèques de la chaîne KDP,
# du studio audio et de l'assistant d'allocation.
#
# Pourquoi ce script existe : le conteneur d'une session web démarre sur un
# dépôt fraîchement cloné, sans `node_modules` et sans SDK Flutter. Sans lui,
# la première demi-heure de chaque session part à réinstaller la même chose —
# et l'installation de Flutter (1 Go) se redécouvre à chaque fois, y compris
# ses deux pièges : l'archive n'est pas sur `dl.google.com` (bloqué par la
# politique réseau) mais sur `storage.googleapis.com`, et git refuse un dépôt
# appartenant à root sans `safe.directory`.
#
# Le script est idempotent : l'état du conteneur étant mis en cache une fois le
# hook terminé, les sessions suivantes retombent sur les branches « déjà là ».

set -euo pipefail

# Sur un poste de développement, le SDK et les dépendances sont déjà installés
# et gérés par leur propriétaire : ce script n'a rien à y faire.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

racine="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

# Version épinglée, et vérifiée par empreinte : la même que celle du workflow
# GitHub. Deux versions différentes entre l'intégration continue et la session
# de développement, c'est un « ça passe chez moi » garanti.
readonly FLUTTER_VERSION='3.47.1'
readonly FLUTTER_SHA256='a1d8166c0309267cb7dc99f1424eecf08b86946ad3b50723c6f59945964aea45'
readonly FLUTTER_HOME="$HOME/flutter"

echo "── Amorce : dépendances npm"
cd "$racine"
npm install --no-audit --no-fund --silent

echo "── Look & Find : SDK Flutter $FLUTTER_VERSION"
if [ -x "$FLUTTER_HOME/bin/flutter" ]; then
  echo "   déjà installé"
else
  archive="flutter_linux_${FLUTTER_VERSION}-stable.tar.xz"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT

  # `storage.googleapis.com` et non `dl.google.com` : ce dernier est refusé par
  # le mandataire réseau des sessions distantes.
  curl -fsSL --retry 3 -o "$tmp/$archive" \
    "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/$archive"
  echo "${FLUTTER_SHA256}  $tmp/$archive" | sha256sum -c - >/dev/null
  tar xf "$tmp/$archive" -C "$HOME"
  echo "   installé"
fi

# Le SDK est un dépôt git appartenant à root : sans cette exception, chaque
# commande `flutter` s'arrête sur « detected dubious ownership ».
git config --global --add safe.directory "$FLUTTER_HOME"
export PATH="$FLUTTER_HOME/bin:$PATH"
flutter --disable-analytics >/dev/null 2>&1 || true

echo "── Look & Find : dépendances Dart"
cd "$racine/look_and_find"
flutter pub get

echo "── Chaîne KDP : bibliothèques Python"
# `--break-system-packages` : l'image est une Debian récente, où pip refuse
# d'installer hors environnement virtuel. Un venv ici obligerait chaque commande
# de la chaîne à l'activer d'abord, pour un conteneur qui n'héberge qu'un projet.
python3 -m pip install --quiet --break-system-packages Pillow PyMuPDF

echo "── Studio audio : bibliothèques Python"
# PyTorch et Whisper sont volontairement absents : six gigaoctets à installer à
# chaque nouvel environnement, pour un chemin d'alignement que l'application sait
# remplacer par la détection de silences. Qui en a besoin les installe avec
# `pip install -r mon-app-audio/requirements.txt`.
python3 -m pip install --quiet --break-system-packages \
  streamlit pydub imageio-ffmpeg edge-tts requests

echo "── Assistant d'allocation : bibliothèques Python"
python3 -m pip install --quiet --break-system-packages yfinance requests tabulate

echo "── Chaîne de montage : bibliothèques Python"
# PyTorch est volontairement absent, pour la même raison que dans le studio
# audio : deux gigaoctets pour un seul chemin de code. Il ne sert ici qu'à dire
# s'il y a un GPU avant de lancer Wav2Lip — et Wav2Lip lui-même est un dépôt à
# cloner, avec ses propres dépendances. La voix off, elle, ne demande que ces
# deux paquets-là et fonctionne dès le démarrage de la session.
python3 -m pip install --quiet --break-system-packages elevenlabs tqdm

echo "── Extraction multiformat : bibliothèques Python"
# Ce que `/extraction-multiformat` et `/transcription-media` ne peuvent pas
# faire sans elles : lire un HEIC d'iPhone, dater une photo, ouvrir un EPUB,
# sortir un tableau de PDF. Quatre secondes d'installation pour des compétences
# qui, sinon, ne savent qu'annoncer ce qui leur manque.
# Volontairement absents : opencv (ffmpeg suffit aux images clés),
# faster-whisper (lourd, et il télécharge son modèle au premier usage),
# tesseract (paquet système). Les fiches disent comment les ajouter au besoin.
python3 -m pip install --quiet --break-system-packages \
  exifread pillow-heif ebooklib pdfplumber chardet mutagen

# `imageio-ffmpeg`, installé plus haut pour le studio audio, embarque un ffmpeg
# statique complet — mais sous un nom que rien ne trouve. Le lier suffit à
# rendre la vidéo et l'audio exploitables, sans installer de paquet système.
if ! command -v ffmpeg >/dev/null 2>&1; then
  binaire_ffmpeg="$(python3 -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())' 2>/dev/null || true)"
  if [ -n "$binaire_ffmpeg" ] && [ -x "$binaire_ffmpeg" ]; then
    ln -sf "$binaire_ffmpeg" /usr/local/bin/ffmpeg 2>/dev/null \
      && echo "   ffmpeg $("$binaire_ffmpeg" -version | head -1 | cut -d' ' -f3) relié depuis imageio-ffmpeg"
  fi
fi

# Rend `flutter` et `dart` disponibles à la session elle-même, pas seulement à
# ce script.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$FLUTTER_HOME/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

echo "── Prêt. Amorce : npm run typecheck|lint|test — Look & Find : flutter analyze|test — KDP : python3 kdp/pipeline/valider.py — Studio audio : python3 -m unittest discover -s mon-app-audio/tests — Patrimoine : python3 -m unittest discover -s patrimoine/tests — Chaîne de montage : python3 -m unittest discover -s montage-auto/tests"
