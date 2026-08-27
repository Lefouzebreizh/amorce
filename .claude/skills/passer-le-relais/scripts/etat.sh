#!/bin/bash
# Fabrique la moitié factuelle d'un résumé de reprise.
#
# Pourquoi : un résumé écrit de mémoire se trompe sur ce qui compte le plus —
# ce qui est poussé, ce qui est vérifié, ce qui reste en local. La session
# suivante repart d'un clone frais : ce qui n'est pas poussé n'existe pas pour
# elle. Ces lignes-là se relèvent, elles ne se racontent pas.
#
# La moitié qui reste — les décisions prises, le prochain geste, le piège à ne
# pas refaire — ne se fabrique pas : c'est elle qu'on écrit à la main.

set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

branche="$(git rev-parse --abbrev-ref HEAD)"
echo "## État au $(date '+%d/%m/%Y %H:%M')"
echo
echo "- **Branche** : \`$branche\`"

git fetch origin main --quiet 2>/dev/null
if git rev-parse --verify --quiet "origin/$branche" >/dev/null; then
  non_pousses=$(git rev-list --count "origin/$branche..HEAD")
  if [ "$non_pousses" -gt 0 ]; then
    echo "- **⚠ $non_pousses commit(s) non poussé(s)** — la session suivante repart d'un clone"
    echo "  frais : pousser avant de passer le relais, sinon ce travail est perdu."
  else
    echo "- Poussée : à jour avec le distant"
  fi
else
  echo "- **⚠ branche jamais poussée** — la pousser avant de passer le relais"
fi

sale=$(git status --porcelain | wc -l)
[ "$sale" -gt 0 ] && echo "- **⚠ $sale fichier(s) non committé(s)**" && git status --short | sed 's/^/      /'

retard=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo '?')
echo "- Retard sur \`main\` : $retard commit(s)"
echo
echo "### Ce que la branche apporte"
echo
git log --oneline --no-merges origin/main..HEAD 2>/dev/null | sed 's/^/- /' | head -15
[ -z "$(git log --oneline origin/main..HEAD 2>/dev/null)" ] && echo "- (rien : tout est déjà dans main)"
echo
echo "### Projets touchés"
echo
git diff --name-only origin/main...HEAD 2>/dev/null | cut -d/ -f1 | sort -u | sed 's/^/- /'
echo
echo "### À compléter à la main"
echo
echo "- **Vérifié par** : (la commande lancée, et son résultat)"
echo "- **Prochain geste** : (la première commande que la session suivante tapera)"
echo "- **Décisions non encore écrites dans le dépôt** : (sinon, pointer le fichier)"
echo "- **Piège rencontré** : (ce qu'on ne veut pas repayer)"
