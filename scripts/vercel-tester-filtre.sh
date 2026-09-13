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

echo changement > "$depot/app/fichier.txt"
git -C "$depot" commit -qam application
echo documentation > "$depot/README.md"
git -C "$depot" add README.md
git -C "$depot" commit -qm documentation

if (cd "$depot" && VERCEL_GIT_PREVIOUS_SHA="$base" bash vercel-ignorer.sh app); then
  echo "Le filtre a ignoré un changement multi-commit." >&2
  exit 1
fi

if ! (cd "$depot" && VERCEL_GIT_PREVIOUS_SHA="$base" bash vercel-ignorer.sh dossier-absent); then
  echo "Le filtre a déployé un chemin inchangé." >&2
  exit 1
fi

echo "Filtre Vercel validé, y compris sur un push multi-commit."
