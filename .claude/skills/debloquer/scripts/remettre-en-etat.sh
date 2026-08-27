#!/bin/bash
# Rétablit un conteneur que le hook de démarrage n'a pas préparé.
#
# Il ne constate rien : c'est le travail de `sonder.py`, dans
# `/capacites-session`, qui dit en une seconde ce qui est là et ce qui manque.
# Ici on répare, et seulement ce qui se répare sans choix à faire.
#
# Pourquoi ce script existe : `.claude/settings.json` déclare le hook en
# `SessionStart`. Il ne s'exécute donc qu'au démarrage d'une session déjà ouverte
# **sur** le dépôt. Une session ouverte sans source, dont le dépôt est rattaché
# puis cloné en cours de route, arrive après ce moment-là — le hook ne se
# redéclenchera pas, quoi qu'on fasse, et rien ne le dit : les commandes
# échouent une par une, chacune ayant l'air d'un défaut du code alors qu'aucun
# code n'a encore tourné.

set -uo pipefail

racine="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
env_session="${TMPDIR:-/tmp}/env-session.sh"

if [ ! -f "$racine/CLAUDE.md" ]; then
  echo "Le dépôt n'est pas là ($racine). Le cloner d'abord — voir la fiche."
  exit 1
fi

fait=0

# Le hook porte la plus grosse part, et il est idempotent : ce qui est déjà
# installé est sauté. Deux marqueurs suffisent à savoir s'il a tourné.
if [ ! -d "$racine/node_modules" ] || ! python3 -c 'import PIL' 2>/dev/null; then
  echo "── Hook de démarrage (une dizaine de minutes, SDK Flutter compris)"
  if CLAUDE_PROJECT_DIR="$racine" CLAUDE_ENV_FILE="$env_session" \
       bash "$racine/.claude/hooks/session-start.sh"; then
    echo "   passé"
  else
    echo "   échoué — relire la sortie ci-dessus, elle nomme l'étape"
  fi
  fait=1
else
  echo "── Hook de démarrage : déjà passé"
fi

# `ffprobe` est un paquet système : le hook s'interdit de l'installer d'office,
# plusieurs sessions n'en ayant aucun usage. Ici il a été demandé.
if ! command -v ffprobe >/dev/null 2>&1; then
  echo "── ffprobe (paquet système ffmpeg)"
  if sudo apt-get install -y -qq ffmpeg >/dev/null 2>&1; then
    echo "   installé — attention, ffmpeg reste celui du hook :"
    echo "   $(ffmpeg -version 2>/dev/null | head -1 | awk '{print $3}') contre ffprobe $(ffprobe -version 2>/dev/null | head -1 | awk '{print $3}')"
    echo "   sans conséquence pour du sondage ; rm /usr/local/bin/ffmpeg les réunit"
  else
    echo "   échoué — relancer sans -qq pour voir l'erreur"
  fi
  fait=1
fi

# Un script ne peut pas exporter dans le shell qui l'appelle : il dépose et il
# dit. Sans cette ligne, `flutter`, `AMORCE_CHROMIUM` et
# `PLAYWRIGHT_BROWSERS_PATH` restent introuvables **bien qu'installés** — c'est
# la moitié qu'on oublie, et elle fait conclure à tort que le hook a échoué.
if [ -s "$env_session" ]; then
  echo
  echo "── Reste à faire, dans le shell appelant, et à chaque nouvelle commande :"
  echo "      source $env_session"
fi

[ "$fait" -eq 0 ] && echo "Rien à rétablir."
exit 0
