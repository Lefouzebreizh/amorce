#!/bin/bash
#
# Préparation d'une session distante.
#
# Le conteneur démarre sans dépendances, et deux détails de cet environnement
# coûtent une dizaine de minutes à chaque fois si on ne les traite pas ici :
# le Chromium préinstallé ne porte pas le numéro de révision qu'attend
# Playwright, et ffmpeg n'est pas là alors que le parcours de vérification
# mesure désormais le silence dans le fichier exporté.
#
set -euo pipefail

# Rien de tout ceci n'a lieu d'être sur la machine de quelqu'un : il y a déjà
# ses dépendances, son navigateur et ses outils.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# -- Dépendances --------------------------------------------------------------
# `npm install` plutôt que `npm ci` : l'état du conteneur est mis en cache après
# ce script, et l'installation incrémentale en profite.
npm install --no-audit --no-fund

# -- Chromium -----------------------------------------------------------------
#
# L'environnement fournit un Chromium, mais sous un autre numéro de révision que
# celui que Playwright réclame — il refuse alors de démarrer et conseille un
# `playwright install` que cet environnement interdit.
#
# On fabrique donc une arborescence de liens portant le numéro attendu, pointant
# sur le navigateur réellement présent. Rien n'est copié : ce sont des liens.
SOURCE_DIR=/opt/pw-browsers
SHIM_DIR="$HOME/.cache/amorce-playwright"

if [ -d "$SOURCE_DIR" ] && [ -f node_modules/playwright-core/browsers.json ]; then
  ATTENDU=$(node -p "require('./node_modules/playwright-core/browsers.json').browsers.find(b => b.name === 'chromium').revision" 2>/dev/null || echo '')
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

    echo "export PLAYWRIGHT_BROWSERS_PATH=\"$SHIM_DIR\"" >> "${CLAUDE_ENV_FILE:-/dev/null}"
    echo "Chromium $PRESENT présenté comme $ATTENDU dans $SHIM_DIR"
  fi
fi

# -- ffmpeg -------------------------------------------------------------------
#
# `npm run verify` mesure le silence dans le fichier exporté : sans ffmpeg le
# contrôle est ignoré, et c'est précisément celui qui a révélé qu'un export
# perdait son son à mi-parcours.
if ! command -v ffprobe >/dev/null 2>&1; then
  (apt-get update -qq && apt-get install -y --no-install-recommends ffmpeg >/dev/null 2>&1) \
    && echo "ffmpeg installé" \
    || echo "ffmpeg indisponible — la mesure du silence sera ignorée"
fi

echo "Session prête."
