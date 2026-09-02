#!/usr/bin/env bash
#
# Supprime les branches distantes dont la pull request est fusionnée.
#
# ## Pourquoi un script et pas `git branch --merged`
#
# Ce dépôt fusionne en écrasant les commits (« squash »). Le commit qui arrive
# sur `main` n'a alors aucun lien de parenté avec la branche d'origine, et
# `git branch --merged` la déclare non fusionnée. Il rendrait donc une liste
# quasi vide et laisserait tout en place.
#
# La seule source qui dit vrai est l'état des pull requests : une branche dont
# la PR porte une date de fusion a bien été intégrée, quel que soit le mode.
#
# ## Pourquoi il tourne chez toi et pas dans une session distante
#
# Mesuré le 02/09/2026 : une session distante peut pousser une branche mais pas
# en supprimer une — `git push --delete` rend 403, le mandataire étant sain, et
# le serveur MCP GitHub n'expose aucune suppression de référence. Le nettoyage
# demande donc un terminal avec tes identifiants.
#
# ## Usage
#
#   bash scripts/nettoyer-branches.sh            # montre la liste, ne supprime rien
#   bash scripts/nettoyer-branches.sh --executer # supprime pour de bon
#
set -euo pipefail

DEPOT="Lefouzebreizh/amorce"
TRAVAIL="$(mktemp -d)"
trap 'rm -rf "$TRAVAIL"' EXIT

if ! command -v gh > /dev/null; then
  echo "Il manque le client GitHub (gh). Installe-le, ou ouvre les branches à la main." >&2
  exit 1
fi

echo "Lecture des pull requests de $DEPOT…"

# Les branches réellement intégrées : une date de fusion, et rien d'autre ne le dit.
gh api --paginate "repos/$DEPOT/pulls?state=closed&per_page=100" \
  --jq '.[] | select(.merged_at != null) | .head.ref' | sort -u > "$TRAVAIL/fusionnees"

# Celles qu'une PR ouverte utilise encore : les supprimer fermerait la PR.
gh api --paginate "repos/$DEPOT/pulls?state=open&per_page=100" \
  --jq '.[] | .head.ref' | sort -u > "$TRAVAIL/ouvertes"

# Ce qui existe vraiment sur le distant : une PR fusionnée dont la branche a
# déjà été effacée n'a rien à faire dans la liste.
git ls-remote --heads origin | sed 's#.*refs/heads/##' | sort -u > "$TRAVAIL/distantes"

# Fusionnée, ET encore présente, ET pas utilisée par une PR ouverte, ET pas main.
comm -12 "$TRAVAIL/fusionnees" "$TRAVAIL/distantes" \
  | comm -23 - "$TRAVAIL/ouvertes" \
  | grep -vx 'main' > "$TRAVAIL/a-supprimer" || true

NOMBRE=$(wc -l < "$TRAVAIL/a-supprimer" | tr -d ' ')
TOTAL=$(wc -l < "$TRAVAIL/distantes" | tr -d ' ')

echo
echo "$TOTAL branches distantes, dont $NOMBRE fusionnées et supprimables :"
echo
sed 's/^/  /' "$TRAVAIL/a-supprimer"
echo

if [ "${1:-}" != "--executer" ]; then
  echo "Rien n'a été supprimé. Relance avec --executer pour le faire."
  exit 0
fi

if [ "$NOMBRE" -eq 0 ]; then
  echo "Rien à supprimer."
  exit 0
fi

# Par paquets : une suppression par référence coûterait autant d'allers-retours.
echo "Suppression…"
xargs -n 40 git push origin --delete < "$TRAVAIL/a-supprimer"
echo "Fait. Reste : $(git ls-remote --heads origin | wc -l | tr -d ' ') branches."
