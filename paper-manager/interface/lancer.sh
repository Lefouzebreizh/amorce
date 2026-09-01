#!/usr/bin/env bash
# Démarre le tableau de bord en une commande.
#
# Existe pour la même raison que `archives-backlog/mon-app-audio/lancer.sh` : le
# vrai obstacle n'est pas l'installation, c'est de recopier deux commandes
# longues au clavier virtuel d'un téléphone.
#
# L'écran est en lecture seule. Ce qui écrit — marquer une alerte traitée,
# classer un dépôt, produire un courrier — reste à `python3 paper.py`.

set -euo pipefail

racine="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
port="${PORT:-8502}"

options=(--quiet)
# Debian récente refuse d'installer hors environnement virtuel ; l'option
# n'existe que sur pip 23 et plus, d'où le test plutôt que l'ajout aveugle.
if python3 -m pip install --help | grep -q -- '--break-system-packages'; then
  options+=(--break-system-packages)
fi

if python3 -c 'import streamlit' 2>/dev/null; then
  echo '── Streamlit déjà présent'
else
  echo '── Installation de Streamlit'
  python3 -m pip install "${options[@]}" streamlit
fi

echo "── Tableau de bord sur http://localhost:$port"
# `headless` : sans lui, Streamlit tente d'ouvrir un navigateur et réclame une
# adresse électronique au premier lancement — deux impasses sur un serveur
# distant ou un téléphone.
# `gatherUsageStats` : cet écran affiche des contrats et des montants
# personnels, il n'a pas à annoncer son usage à qui que ce soit.
exec python3 -m streamlit run "$racine/app.py" \
  --server.port "$port" --server.headless true \
  --browser.gatherUsageStats false
