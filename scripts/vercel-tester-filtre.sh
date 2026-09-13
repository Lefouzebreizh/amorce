#!/usr/bin/env bash
set -euo pipefail

depot=$(mktemp -d)
trap 'rm -rf "$depot"' EXIT
cp "$(git rev-parse --show-toplevel)/scripts/vercel-ignorer.sh" "$depot/vercel-ignorer.sh"
git -C "$depot" init -q
git -C "$depot" config user.email test@example.invalid
git -C "$depot" config user.name Test
mkdir -p "$depot/app"
echo initial > "$depot/app/fichier.txt"
git -C "$depot" add .
git -C "$depot" commit -qm initial
base=$(git -C "$depot" rev-parse HEAD)

verifier() {
  local attendu="$1" libelle="$2" precedent="$3" chemin="$4" code=0
  (cd "$depot" && VERCEL_GIT_PREVIOUS_SHA="$precedent" bash vercel-ignorer.sh "$chemin") || code=$?
  if [ "$code" -ne "$attendu" ]; then
    echo "$libelle : sortie $code au lieu de $attendu." >&2
    exit 1
  fi
}

verifier 1 "Premier déploiement" "" app

echo changement > "$depot/app/fichier.txt"
git -C "$depot" commit -qam application
echo documentation > "$depot/README.md"
git -C "$depot" add README.md
git -C "$depot" commit -qm documentation

verifier 1 "Changement multi-commit" "$base" app
verifier 0 "Chemin inchangé" "$base" dossier-absent
verifier 1 "Base absente après plusieurs commits" "" app
verifier 1 "Objet absent de l'historique" "0000000000000000000000000000000000000000" app

# Un déploiement réussi peut appartenir à une branche réécrite.
arbre=$(git -C "$depot" rev-parse 'HEAD^{tree}')
divergent=$(git -C "$depot" commit-tree "$arbre" -p "$base" -m divergence)
verifier 1 "Base divergente" "$divergent" app
verifier 0 "Même version déjà déployée" "$(git -C "$depot" rev-parse HEAD)" app

# Documentation seule après le dernier déploiement applicatif.
application=$(git -C "$depot" rev-parse HEAD^)
verifier 0 "Documentation seule depuis le déploiement" "$application" app

echo "Filtre Vercel validé : 8 cas, dont historique absent ou divergent."
