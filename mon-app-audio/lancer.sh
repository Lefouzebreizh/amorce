#!/usr/bin/env bash
# Démarre le studio audio en une commande : dépendances puis interface.
#
# Existe pour le cas du téléphone et du Codespace, où recopier deux commandes
# longues au clavier virtuel est le vrai obstacle — pas l'installation.
#
# PyTorch et Whisper sont écartés par défaut : plusieurs gigaoctets pour un
# chemin d'alignement que l'application sait remplacer par la détection de
# silences. `bash lancer.sh --complet` installe tout.

set -euo pipefail

racine="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
port="${PORT:-8501}"

options=(--quiet)
# Debian récente refuse d'installer hors environnement virtuel ; l'option
# n'existe que sur pip 23 et plus, d'où le test plutôt que l'ajout aveugle.
if python3 -m pip install --help | grep -q -- '--break-system-packages'; then
  options+=(--break-system-packages)
fi

if [ "${1:-}" = '--complet' ]; then
  echo '── Installation complète (PyTorch compris, comptez plusieurs minutes)'
  python3 -m pip install "${options[@]}" -r "$racine/requirements.txt"
elif python3 -c 'import streamlit, pydub, edge_tts, requests' 2>/dev/null; then
  echo '── Dépendances déjà présentes'
else
  echo '── Installation des dépendances'
  python3 -m pip install "${options[@]}" streamlit pydub imageio-ffmpeg edge-tts requests
fi

echo "── Interface sur http://localhost:$port"
# `headless` : sans lui, Streamlit tente d'ouvrir un navigateur et réclame une
# adresse électronique au premier lancement — deux impasses sur un serveur
# distant.
# `gatherUsageStats` : le studio travaille sur des fichiers personnels, il n'a
# pas à annoncer son usage à qui que ce soit.
exec python3 -m streamlit run "$racine/app.py" \
  --server.port "$port" --server.headless true \
  --browser.gatherUsageStats false
