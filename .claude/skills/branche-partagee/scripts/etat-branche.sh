#!/usr/bin/env bash
# Où en est la branche par rapport à un `main` que d'autres sessions font avancer.
#
# Ce dépôt reçoit plusieurs sessions en parallèle. Deux surprises coûtent du
# temps, et toutes deux se voient d'un coup d'œil ici :
#
#   1. `main` a avancé — la branche part d'une base périmée, et la fusion
#      conflictera d'autant plus qu'on attend.
#   2. Des commits de la branche sont **déjà dans `main`**, emportés par une
#      autre PR. Une PR qui les annonce raconte alors autre chose que son diff.
#
# Sans argument, compare à `origin/main`. Ne modifie rien.

set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

BASE="${1:-origin/main}"
BRANCHE="$(git rev-parse --abbrev-ref HEAD)"

git fetch --quiet origin "${BASE#origin/}" 2>/dev/null || true

retard="$(git rev-list --count "HEAD..$BASE")"
avance="$(git rev-list --count "$BASE..HEAD")"
propre="$(git status --porcelain | wc -l)"

echo "branche : $BRANCHE"
echo "  $retard commit(s) de retard sur $BASE, $avance en avance"
echo "  $propre modification(s) non validée(s)"

if [ "$avance" -gt 0 ]; then
  deja=0
  echo
  echo "  commits en avance :"
  while read -r sha titre; do
    if git merge-base --is-ancestor "$sha" "$BASE" 2>/dev/null; then
      echo "    déjà dans $BASE  $sha  ${titre:0:58}"
      deja=$((deja + 1))
    else
      echo "    inédit           $sha  ${titre:0:58}"
    fi
  done < <(git log --format='%h %s' "$BASE..HEAD")

  if [ "$deja" -gt 0 ]; then
    echo
    echo "  ⚠ $deja commit(s) déjà présent(s) dans $BASE : une autre session les a emportés."
    echo "    Décrire la PR d'après le diff réel, pas d'après ce qui a été fait."
  fi
fi

echo
if [ "$retard" -eq 0 ] && [ "$avance" -eq 0 ]; then
  echo "  → rien à faire : la branche est alignée."
elif [ "$retard" -gt 0 ] && [ "$avance" -eq 0 ]; then
  echo "  → git merge --ff-only $BASE     (avance rapide, sans risque)"
elif [ "$retard" -gt 0 ]; then
  echo "  → git merge $BASE               (rapatrier avant de pousser ; jamais de rebase"
  echo "                                   sur une branche que d'autres peuvent avoir)"
else
  echo "  → prêt à ouvrir la PR, après la barrière de vérification du projet touché."
fi
