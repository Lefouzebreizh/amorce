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

# La ligne d'accueil se compose ici, un élément par projet, au lieu de vivre
# dans une seule chaîne de mille caractères en fin de fichier. Cette chaîne
# était un conflit garanti : tout projet ajouté devait la modifier, donc deux
# branches ouvertes en même temps se marchaient dessus à coup sûr. Chaque bloc
# déclare désormais sa commande chez lui, et git fusionne tout seul.
commandes=(
  "Amorce : npm run typecheck|lint|test"
  "Socle Agence : (dans agence/) npm run lint|typecheck|test|build"
  "Artisan Express : (dans artisan-express/) npm run lint|typecheck|test|build"
  "Hypersensible : (dans hypersensible-bienveillance/) npm test, npm run check, npm run build"
  "Look & Find : flutter analyze|test"
  "KDP : python3 kdp/pipeline/valider.py, python3 -m unittest discover -s kdp/tests"
  "Studio audio : python3 -m unittest discover -s archives-backlog/mon-app-audio/tests"
  "Patrimoine : python3 -m unittest discover -s archives-backlog/patrimoine/tests"
  "Chaîne de montage : python3 -m unittest discover -s montage-auto/tests"
  "Répondeur Facebook : python3 -m unittest discover -s repondeur-facebook/tests"
  "Life-Organizer : python3 -m unittest discover -s life-organizer/tests"
  "Réseau d'annuaires : (dans annuaire-ia/) npm run valider|verifier|sites"
  "TITAN Builder : (dans titan-builder/) npm run lint|typecheck|test|build"
  "IPTV / VOD : (dans iptv/) npm test, npm run check"
  "Radar crypto : cd pepites && python3 -m unittest discover -s tests"
  "NexusCrypto : cd nexuscrypto && python3 -m unittest discover -s tests"
)

echo "── Amorce : dépendances npm"
cd "$racine"
npm install --no-audit --no-fund --silent

echo "── Socle Agence : dépendances npm"
# Projet Next.js indépendant, avec son propre `package.json` : les dépendances
# de la racine ne lui servent à rien, et les siennes ne doivent pas remonter.
cd "$racine/agence"
npm install --no-audit --no-fund --silent

echo "── Artisan Express : dépendances npm"
# Page de vente Next.js indépendante, avec son propre `package.json` : lancée
# sans `cd`, npm remonte à la racine et installe dans l'arbre d'Amorce.
cd "$racine/artisan-express"
npm install --no-audit --no-fund --silent

echo "── TITAN Builder : dépendances npm"
# Même raison, et une conséquence de plus : la CI de TITAN n'installe que son
# dossier, donc un paquet emprunté au voisin d'au-dessus passe en session et
# rougit sur le runner.
cd "$racine/titan-builder"
npm install --no-audit --no-fund --silent

echo "── IPTV / VOD : dépendances npm"
# Le cœur n'a aucune dépendance d'exécution ; ces trois paquets-là sont ceux du
# typage et du lancement des tests. Lancé sans `cd`, npm remonte à la racine et
# les installe dans l'arbre d'Amorce, où la CI d'IPTV ne les trouvera pas.
cd "$racine/iptv"
npm install --no-audit --no-fund --silent

echo "── Hypersensible & Bienveillance : dépendances npm"
# Projet Astro + Cloudflare indépendant. Le `.npmrc` du dossier existe pour la
# même raison que ce bloc : lancé sans `cd`, npm remonte jusqu'à la racine et
# installe Astro dans les dépendances du studio Amorce.
cd "$racine/hypersensible-bienveillance"
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
# ni Pillow ni PyMuPDF ne l'apportent. segno : `hymne.py` grave un QR code sur
# la page de l'hymne, et c'est le seul module de la chaîne qui ne s'importait
# pas ici — un défaut invisible tant qu'aucun test ne le touche.
python3 -m pip install --quiet --break-system-packages Pillow PyMuPDF numpy segno

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

echo "── Radar crypto : bibliothèques Python"
# Trois paquets légers. `requests` est déjà installé plus haut, mais le répéter
# coûte une seconde et évite qu'un changement là-haut casse le radar en silence.
python3 -m pip install --quiet --break-system-packages \
  requests PyYAML python-dotenv

echo "── NexusCrypto : bibliothèques Python"
# `aiohttp` et `ccxt` ne sont nécessaires qu'à l'*exécution* : le cœur du moteur
# et sa suite de tests tournent sans eux, et `.github/requirements-tests.txt` ne
# les liste donc pas. Ici on prépare une session où l'on lance le programme.
python3 -m pip install --quiet --break-system-packages \
  aiohttp PyYAML python-dotenv ccxt

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
# Le paquet système donne les deux, et une session distante y a droit. L'y
# installer plutôt que de le conseiller : `relever_instants.py` en dépend, et
# une session qui doit d'abord découvrir qu'il manque perd le quart d'heure que
# ce hook existe pour économiser.
#
# `apt-get update` n'est pas décoratif. Sans lui, les listes livrées avec
# l'image sont périmées et l'installation meurt en 404 sur des dépendances
# annexes (les pilotes mesa, notamment) — mesuré, pas supposé.
if ! command -v ffprobe >/dev/null 2>&1; then
  if apt-get update -qq >/dev/null 2>&1 && apt-get install -y -qq ffmpeg >/dev/null 2>&1; then
    echo "   ffmpeg + ffprobe installés depuis le paquet système"
  else
    echo "   ffprobe absent (imageio-ffmpeg ne le fournit pas) : l'inspection des"
    echo "   vidéos ne tournera pas — apt-get update && apt-get install -y ffmpeg"
  fi
fi

echo "── Paper-Manager : bibliothèques Python"
# PyMuPDF fait les quatre gestes du projet : lire le texte d'un PDF, rendre une
# page en image, remplir un formulaire et l'aplatir. `anthropic` n'est pas
# installé ici : c'est le seul appel réseau du projet, il ne part que si
# `extraction.active` vaut true, et personne ne devrait le découvrir installé.
# streamlit : l'écran du tableau de bord (`interface/app.py`). Le studio audio
# l'installe déjà quelques lignes plus haut ; il est répété ici pour que le jour
# où `archives-backlog/` disparaît, l'interface de ce projet ne s'éteigne pas
# avec lui — pip ne réinstalle rien quand la version présente convient.
python3 -m pip install --quiet --break-system-packages PyMuPDF Pillow streamlit
echo "── Parole hors Hugging Face : reconnaissance et synthèse"
# `faster-whisper` reste volontairement absent : il est lourd, et surtout ses
# poids vivent sur `huggingface.co`, que la politique de sortie des sessions
# distantes refuse. `sherpa-onnx` prend le relais — ses modèles sont publiés
# dans une release GitHub, hôte autorisé, et `asr_hors_ligne.py` va les y
# chercher. La bibliothèque seule pèse peu ; les modèles ne descendent qu'à la
# demande, dans ~/.cache, et une seule fois.
python3 -m pip install --quiet --break-system-packages sherpa-onnx numpy

# `matplotlib` sert au regard porté sur un média : sans lui, `/voir-le-son` meurt
# à l'import et le seul filet qui *montre* un défaut sonore n'existe plus. Il
# était absent, et la compétence était donc annoncée sans pouvoir tourner.
python3 -m pip install --quiet --break-system-packages matplotlib

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

# Ce que les autres sessions construisent en ce moment.
#
# Ce dépôt reçoit plusieurs sessions en parallèle et rien ne les fait se voir.
# Deux branches y ont construit Life-Organizer chacune de son côté ; une
# session a écrit huit cents lignes de socle Supabase pendant qu'une autre
# livrait `agence/` ; et le jour où ces lignes ont été écrites, six branches
# ouvertes travaillaient la même friction. Aucun de ces gaspillages ne vient
# d'une erreur de jugement : ils viennent d'un angle mort que trente secondes
# de lecture suppriment.
#
# Placé dans le hook plutôt que dans une compétence, parce qu'une compétence
# doit se déclencher pour servir alors que le hook s'exécute toujours — et que
# l'angle mort est précisément qu'on ne pense pas à regarder.
#
# Tolérant à la panne : une session hors ligne doit démarrer quand même.
echo "── Chantiers ouverts par d'autres sessions"
if git -C "$racine" fetch --quiet --prune origin \
     '+refs/heads/claude/*:refs/remotes/origin/claude/*' 2>/dev/null; then
  courante="$(git -C "$racine" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
  autres="$(git -C "$racine" for-each-ref --sort=-committerdate \
    --format='%(refname:short)|%(committerdate:relative)|%(contents:subject)' \
    refs/remotes/origin/claude/ 2>/dev/null \
    | grep -v "^origin/$courante|" | head -6 || true)"
  if [ -n "$autres" ]; then
    echo "$autres" | while IFS='|' read -r branche quand sujet; do
      printf '   %s (%s)\n      %.72s\n' "${branche#origin/}" "$quand" "$sujet"
    done
    echo "   Avant de construire : l'une d'elles fait-elle déjà ce travail ?"
  else
    echo "   aucun — le champ est libre"
  fi
else
  echo "   dépôt distant injoignable, liste non consultée"
fi

# Réseau d'annuaires IA : rien à installer — il emprunte les dépendances
# d'Amorce (Tailwind pour compiler sa feuille, Playwright pour son parcours) et
# n'a pas de node_modules à lui. Ce qui se dit ici est ce qu'une session ne peut
# pas deviner : combien de publications l'auto-pilote tient encore. Quand cette
# réserve tombe à zéro, rien ne casse — les onze sites cessent simplement de
# bouger, et Google cesse de revenir.
if [ -f "$racine/annuaire-ia/alerte-reserve.js" ]; then
  echo "── Réseau d'annuaires : $(cd "$racine/annuaire-ia" && node alerte-reserve.js 2>&1 | head -1)"
fi

# Ce que cette session-ci sait faire. Une seconde, et cela évite de découvrir
# en pleine tâche qu'un hôte est refusé ou qu'un binaire manque — quatre détours
# en une nuit avant que cette ligne n'existe.
if [ -f "$racine/.claude/skills/capacites-session/scripts/sonder.py" ]; then
  echo "── Capacités : $(python3 "$racine/.claude/skills/capacites-session/scripts/sonder.py" --court)"
fi

accueil=""
for commande in "${commandes[@]}"; do
  [ -n "$accueil" ] && accueil+=" — "
  accueil+="$commande"
done
echo "── Prêt. $accueil"
