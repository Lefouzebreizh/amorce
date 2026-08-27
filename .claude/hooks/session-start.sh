#!/bin/bash
# Prépare le conteneur d'une session distante : dépendances du studio Amorce et
# du socle agence, SDK Flutter et dépendances de Look & Find, bibliothèques de
# la chaîne KDP, du studio audio, de l'assistant d'allocation, de la chaîne de
# montage, du répondeur Facebook et de Life-Organizer.
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

echo "── Socle Agence : dépendances npm"
# Projet Next.js indépendant, avec son propre `package.json` : les dépendances
# de la racine ne lui servent à rien, et les siennes ne doivent pas remonter.
cd "$racine/agence"
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
# numpy : `coquilles.py` opère au pixel et `planches.py` mesure les bulles ;
# ni Pillow ni PyMuPDF ne l'apportent.
python3 -m pip install --quiet --break-system-packages Pillow PyMuPDF numpy

echo "── Studio audio : bibliothèques Python"
# PyTorch et Whisper sont volontairement absents : six gigaoctets à installer à
# chaque nouvel environnement, pour un chemin d'alignement que l'application sait
# remplacer par la détection de silences. Qui en a besoin les installe avec
# `pip install -r archives-backlog/mon-app-audio/requirements.txt`.
python3 -m pip install --quiet --break-system-packages \
  streamlit pydub imageio-ffmpeg edge-tts requests

echo "── Répondeur Facebook : bibliothèques Python"
# `requests` est déjà là pour le studio audio ; ces deux-là ne le sont pas, et
# sans elles les tests du répondeur ne se lancent même pas.
python3 -m pip install --quiet --break-system-packages anthropic python-dotenv

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

echo "── Life-Organizer : bibliothèques Python"
# Real-ESRGAN et PyTorch sont volontairement absents : plusieurs gigaoctets pour
# un module désactivé par défaut. `tesseract` n'est pas un paquet Python et
# s'installe à part ; `outils_externes.py` désactive proprement l'OCR sans lui.
python3 -m pip install --quiet --break-system-packages \
  Pillow python-dateutil pypdf ImageHash opencv-python-headless imageio-ffmpeg

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

# Le paquet n'embarque que `ffmpeg` : il n'y a pas de `ffprobe` à lier. Dit ici
# parce qu'une session distante a donc un ffmpeg et pas de ffprobe — la
# combinaison exacte où `organizer nettoyer` lit l'en-tête des vidéos sans
# décoder leur fin, et où un fichier tronqué passe inaperçu sans que rien
# n'échoue. Le paquet système reste le seul moyen d'avoir les deux.
if ! command -v ffprobe >/dev/null 2>&1; then
  echo "   ffprobe absent (imageio-ffmpeg ne le fournit pas) : l'inspection des vidéos"
  echo "   de Life-Organizer ne tournera pas — sudo apt install ffmpeg pour l'activer"
fi

echo "── Paper-Manager : bibliothèques Python"
# PyMuPDF fait les quatre gestes du projet : lire le texte d'un PDF, rendre une
# page en image, remplir un formulaire et l'aplatir. `anthropic` n'est pas
# installé ici : c'est le seul appel réseau du projet, il ne part que si
# `extraction.active` vaut true, et personne ne devrait le découvrir installé.
python3 -m pip install --quiet --break-system-packages PyMuPDF Pillow

echo "── Volet TikTok : bibliothèque du carnet"
# `tiktok/carnet.py` fabrique le PDF de tournage depuis les Markdown du volet.
# Sans reportlab, la seule chose qu'on emporte en tournage ne se fabrique pas.
python3 -m pip install --quiet --break-system-packages reportlab

echo "── Amorce : Chromium pour le parcours de vérification"
# L'environnement fournit un Chromium, mais sous un autre numéro de révision que
# celui que Playwright réclame — il refuse alors de démarrer et conseille un
# `playwright install` que cet environnement interdit. Sans ce pont,
# `npm run fixtures` et `npm run verify` — le seul filet réel du studio — ne
# s'exécutent pas du tout en session distante.
#
# On fabrique une arborescence de liens portant le numéro attendu, pointant sur
# le navigateur réellement présent. Rien n'est copié : ce sont des liens.
SOURCE_DIR=/opt/pw-browsers
SHIM_DIR="$HOME/.cache/amorce-playwright"

if [ -d "$SOURCE_DIR" ] && [ -f "$racine/node_modules/playwright-core/browsers.json" ]; then
  ATTENDU=$(node -p "require('$racine/node_modules/playwright-core/browsers.json').browsers.find(b => b.name === 'chromium').revision" 2>/dev/null || echo '')
  PRESENT=$(ls -d "$SOURCE_DIR"/chromium-* 2>/dev/null | head -1 | sed 's/.*chromium-//' || echo '')

  if [ -n "$ATTENDU" ] && [ -n "$PRESENT" ] && [ "$ATTENDU" != "$PRESENT" ]; then
    HEADLESS="$SHIM_DIR/chromium_headless_shell-$ATTENDU/chrome-headless-shell-linux64"
    COMPLET="$SHIM_DIR/chromium-$ATTENDU/chrome-linux"
    mkdir -p "$HEADLESS" "$COMPLET"

    ln -sfn "$SOURCE_DIR/chromium_headless_shell-$PRESENT/chrome-linux/"* "$HEADLESS/" 2>/dev/null || true
    # Playwright cherche ce nom précis ; le binaire présent s'appelle autrement.
    ln -sfn "$SOURCE_DIR/chromium_headless_shell-$PRESENT/chrome-linux/headless_shell" "$HEADLESS/chrome-headless-shell"
    ln -sfn "$SOURCE_DIR/chromium-$PRESENT/chrome-linux/"* "$COMPLET/" 2>/dev/null || true

    for marqueur in INSTALLATION_COMPLETE DEPENDENCIES_VALIDATED; do
      cp -f "$SOURCE_DIR/chromium_headless_shell-$PRESENT/$marqueur" "$SHIM_DIR/chromium_headless_shell-$ATTENDU/" 2>/dev/null || true
      cp -f "$SOURCE_DIR/chromium-$PRESENT/$marqueur" "$SHIM_DIR/chromium-$ATTENDU/" 2>/dev/null || true
    done

    ln -sfn "$SOURCE_DIR"/ffmpeg-* "$SHIM_DIR/" 2>/dev/null || true

    if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
      echo "export PLAYWRIGHT_BROWSERS_PATH=\"$SHIM_DIR\"" >> "$CLAUDE_ENV_FILE"
    fi
    echo "   Chromium $PRESENT présenté comme $ATTENDU"
  else
    echo "   révision déjà conforme"
  fi
fi

# Rend `flutter` et `dart` disponibles à la session elle-même, pas seulement à
# ce script.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$FLUTTER_HOME/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

# Chromium de vérification. L'image en fournit un (révision 1194), Playwright en
# réclame un autre (1234) : sans chemin explicite, `npm run fixtures` et
# `npm run verify` s'arrêtent en demandant `playwright install`, que ce dépôt
# interdit — l'installation retéléchargerait un navigateur déjà présent.
if [ -x /opt/pw-browsers/chromium ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export AMORCE_CHROMIUM=/opt/pw-browsers/chromium" >> "$CLAUDE_ENV_FILE"
  echo "── Amorce : Chromium de vérification signalé à la session"
fi

# Ce que cette session-ci sait faire. Une seconde, et cela évite de découvrir
# en pleine tâche qu'un hôte est refusé ou qu'un binaire manque — quatre détours
# en une nuit avant que cette ligne n'existe.
if [ -f "$racine/.claude/skills/capacites-session/scripts/sonder.py" ]; then
  echo "── Capacités : $(python3 "$racine/.claude/skills/capacites-session/scripts/sonder.py" --court)"
fi

echo "── Prêt. Amorce : npm run typecheck|lint|test — Socle Agence : (dans agence/) npm run lint|typecheck|test|build — Look & Find : flutter analyze|test — KDP : python3 kdp/pipeline/valider.py, python3 -m unittest discover -s kdp/tests — Studio audio : python3 -m unittest discover -s archives-backlog/mon-app-audio/tests — Patrimoine : python3 -m unittest discover -s archives-backlog/patrimoine/tests — Chaîne de montage : python3 -m unittest discover -s montage-auto/tests — Répondeur Facebook : python3 -m unittest discover -s repondeur-facebook/tests — Life-Organizer : python3 -m unittest discover -s life-organizer/tests"
