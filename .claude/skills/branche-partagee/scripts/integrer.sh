#!/bin/bash
# Intègre `main` dans la branche courante et classe les conflits.
#
# Pourquoi ce script : dans ce dépôt, plusieurs sessions poussent en parallèle
# et `main` avance pendant qu'on travaille. Les conflits qui en résultent sont
# presque toujours les mêmes — trois ou quatre listes que chaque projet allonge
# — et le temps ne part pas à les résoudre mais à les *identifier* : ouvrir
# chaque fichier, retrouver les marqueurs, décider si c'est additif ou réel.
#
# Le script ne résout rien tout seul, et c'est délibéré : garder les deux côtés
# d'une liste est mécanique, mais la phrase qui compte les projets, elle, doit
# être réécrite par quelqu'un qui la lit. Résoudre à l'aveugle produirait un
# « neuf projets » suivi de dix éléments — le genre d'erreur qui survit des mois.
#
# Usage :
#   bash .claude/skills/branche-partagee/scripts/integrer.sh          # intègre
#   bash .claude/skills/branche-partagee/scripts/integrer.sh --etat   # ne fait que regarder

set -uo pipefail

# Les fichiers de la racine que chaque projet allonge. Un conflit ici est
# presque toujours additif : les deux côtés ajoutent une entrée à une liste.
ADDITIFS=(
  "CLAUDE.md"
  ".gitignore"
  ".claude/hooks/session-start.sh"
  ".claude/skills/verifier/SKILL.md"
  ".github/requirements-tests.txt"
)

bleu()  { printf '\033[34m%s\033[0m\n' "$*"; }
vert()  { printf '\033[32m%s\033[0m\n' "$*"; }
jaune() { printf '\033[33m%s\033[0m\n' "$*"; }
rouge() { printf '\033[31m%s\033[0m\n' "$*"; }

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  printf '\033[31m%s\033[0m\n' "Hors d'un dépôt git : se placer dans le dépôt avant de lancer ce script."
  exit 1
fi

branche="$(git rev-parse --abbrev-ref HEAD)"
if [ "$branche" = "main" ]; then
  rouge "Sur main : il n'y a rien à intégrer. Créer une branche claude/… d'abord."
  exit 1
fi

# Une fusion laissée en plan ressemble à un arbre sale : le dire précisément
# évite de chercher quelles modifications on aurait oubliées.
if [ -e "$(git rev-parse --git-dir)/MERGE_HEAD" ]; then
  rouge "Une fusion est déjà en cours, avec des conflits non résolus :"
  git diff --name-only --diff-filter=U | sed 's/^/    /'
  echo "  Les résoudre puis « git commit », ou tout annuler par « git merge --abort »."
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  rouge "Des modifications ne sont pas committées. Les committer avant d'intégrer :"
  git status --short
  exit 1
fi

bleu "── Récupération de main"
git fetch origin main --quiet || { rouge "Échec du fetch."; exit 1; }

retard=$(git rev-list --count HEAD..origin/main)
avance=$(git rev-list --count origin/main..HEAD)

if [ "$retard" -eq 0 ]; then
  vert "À jour : main n'a pas bougé. $avance commit(s) à pousser."
  exit 0
fi

jaune "main a $retard commit(s) d'avance. Ce qui est arrivé :"
git log --oneline --no-merges HEAD..origin/main | head -12 | sed 's/^/    /'

if [ "${1:-}" = "--etat" ]; then
  echo
  bleu "Fichiers que main a touchés et que la branche touche aussi :"
  comm -12 \
    <(git diff --name-only HEAD...origin/main | sort) \
    <(git diff --name-only "$(git merge-base HEAD origin/main)"..HEAD | sort) \
    | sed 's/^/    /' || true
  echo
  echo "(--etat : rien n'a été modifié)"
  exit 0
fi

echo
bleu "── Fusion"
if git merge origin/main --no-edit --quiet 2>/dev/null; then
  vert "Fusionné sans conflit."
  echo
  jaune "Avant de pousser : lancer /verifier sur le projet touché."
  exit 0
fi

conflits=$(git diff --name-only --diff-filter=U)
[ -z "$conflits" ] && { rouge "Fusion échouée sans conflit listé — regarder git status."; exit 1; }

echo
rouge "Conflits à résoudre :"
echo
attendus=0
imprevus=0
while IFS= read -r fichier; do
  connu=0
  for a in "${ADDITIFS[@]}"; do [ "$fichier" = "$a" ] && connu=1; done
  blocs=$(grep -c '^<<<<<<<' "$fichier" 2>/dev/null || echo 0)
  if [ "$connu" -eq 1 ]; then
    attendus=$((attendus + 1))
    jaune "  ~ $fichier ($blocs bloc(s)) — liste de la racine, conflit probablement additif"
  else
    imprevus=$((imprevus + 1))
    rouge "  ! $fichier ($blocs bloc(s)) — à trancher, ce n'est pas une simple liste"
  fi
done <<< "$conflits"

echo
bleu "── Les blocs, côte à côte"
while IFS= read -r fichier; do
  echo
  bleu "════ $fichier"
  awk '
    /^<<<<<<</ { dans=1; print "  ┌─ la branche ─────────────"; next }
    /^=======/ && dans { print "  ├─ main ──────────────────"; next }
    /^>>>>>>>/ && dans { print "  └──────────────────────────"; dans=0; next }
    dans { print "  │ " $0 }
  ' "$fichier"
done <<< "$conflits"

echo
if [ "$imprevus" -eq 0 ]; then
  jaune "Les $attendus conflit(s) portent sur des listes de la racine."
  echo "  Règle : garder les deux côtés, et relire la phrase qui les introduit —"
  echo "  un compte (« neuf projets ») ne se fusionne pas, il se recalcule."
else
  rouge "$imprevus conflit(s) hors des listes connues : les lire avant tout."
  echo "  Un conflit dans du code veut dire que quelqu'un travaille le même sujet."
  echo "  Vérifier les PR ouvertes avant de trancher — ce qui est fusionné gagne."
fi
echo
echo "Ensuite : résoudre, « git add », /verifier, « git commit », pousser."
exit 2
