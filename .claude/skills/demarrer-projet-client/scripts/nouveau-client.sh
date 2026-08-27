#!/usr/bin/env bash
# Fabrique un projet client complet à partir du socle `agence/`.
#
# Pourquoi ce script existe : démarrer un projet client à la main, c'est copier
# soixante fichiers, renommer une dizaine de chaînes réparties dans sept
# fichiers, puis rebrancher trois configurations à la racine. Chacune de ces
# étapes est oubliable, et deux d'entre elles ne se voient qu'au moment où la
# vérification de la racine casse — c'est-à-dire chez quelqu'un d'autre.
#
#   .claude/skills/demarrer-projet-client/scripts/nouveau-client.sh boulangerie-martin "Boulangerie Martin"
#
# La copie part de ce que git connaît, pas du dossier tel qu'il est : le socle
# livré est celui qui est committé, jamais un état de travail à moitié fini.
#
# La vérification tourne par défaut. Un squelette qui ne construit pas coûte
# plus cher que les quatre-vingt-dix secondes qu'elle prend, parce que son
# échec sera découvert bien plus tard et attribué à autre chose.
# `--sans-verification` pour s'en passer.
set -euo pipefail

racine="$(git rev-parse --show-toplevel)"
modele="agence"

usage() {
  cat >&2 <<'AIDE'
Usage : nouveau-client.sh <nom-technique> ["Nom affiché"] [--sans-verification]

  nom-technique   en minuscules avec tirets : le dossier, le paquet npm et le
                  préfixe des journaux. Exemple : boulangerie-martin
  Nom affiché     ce que lit l'utilisateur dans l'interface. Par défaut, le nom
                  technique remis en majuscules.
AIDE
  exit 2
}

verifier=1
arguments=()
for argument in "$@"; do
  case "$argument" in
    --sans-verification) verifier=0 ;;
    -h|--help) usage ;;
    *) arguments+=("$argument") ;;
  esac
done

[ "${#arguments[@]}" -ge 1 ] || usage

nom="${arguments[0]}"
affiche="${arguments[1]:-}"

if ! [[ "$nom" =~ ^[a-z][a-z0-9-]{1,38}[a-z0-9]$ ]]; then
  echo "Nom technique invalide : « $nom »." >&2
  echo "Attendu : minuscules, chiffres et tirets, entre 3 et 40 caractères." >&2
  exit 1
fi

# Les dossiers de la racine ont chacun un rôle ; en écraser un par un projet
# client détruirait un autre projet du dépôt.
case "$nom" in
  src|scripts|public|node_modules|agence|kdp|look_and_find|tiktok|paper-manager|life-organizer|montage-auto|repondeur-facebook|archives-backlog)
    echo "« $nom » est déjà un dossier du dépôt. Choisir un autre nom." >&2
    exit 1
    ;;
esac

if [ -e "$racine/$nom" ]; then
  echo "« $racine/$nom » existe déjà. Rien n'a été touché." >&2
  exit 1
fi

if [ -z "$affiche" ]; then
  # « boulangerie-martin » devient « Boulangerie Martin » : correct neuf fois
  # sur dix, et le second argument existe pour la dixième.
  affiche="$(echo "$nom" | tr '-' ' ' | sed 's/\b\(.\)/\u\1/g')"
fi

if [ -n "$(git -C "$racine" status --porcelain -- "$modele")" ]; then
  echo "Attention : « $modele/ » a des modifications non committées." >&2
  echo "Le projet client part de la version committée — elles ne seront pas reprises." >&2
fi

echo "── Copie du socle vers $nom/"
temporaire="$(mktemp -d)"
trap 'rm -rf "$temporaire"' EXIT

# `git ls-files` plutôt qu'une copie du dossier : ni `node_modules`, ni `.next`,
# ni `.env.local` ne peuvent se glisser dans le projet livré.
git -C "$racine" ls-files -z "$modele" \
  | tar --null -C "$racine" -T - -cf - \
  | tar -xf - -C "$temporaire"
mv "$temporaire/$modele" "$racine/$nom"

echo "── Renommage"
# Deux chaînes portent l'identité du socle : le nom affiché et le préfixe
# technique (paquet npm et journaux serveur).
grep -rlZ --binary-files=without-match 'Socle Agence\|socle-agence' "$racine/$nom" \
  | xargs -0 --no-run-if-empty sed -i \
      -e "s/Socle Agence/$affiche/g" \
      -e "s/socle-agence/$nom/g"

echo "── Branchements à la racine"
python3 - "$racine" "$nom" <<'PYTHON'
import re
import sys

racine, nom = sys.argv[1], sys.argv[2]

# 1. ESLint de la racine : sans cette exclusion, la configuration d'Amorce
#    analyse le projet client et signale des erreurs sur un code qui a ses
#    propres règles.
chemin = f"{racine}/eslint.config.mjs"
source = open(chemin).read()
if f'"{nom}/**"' not in source:
    ancre = "  ]),\n]);"
    ajout = (
        f'    // Projet client, avec sa propre configuration ESLint et ses propres\n'
        f'    // alias `@/…`. Il se vérifie depuis `{nom}/`.\n'
        f'    "{nom}/**",\n'
    )
    source = source.replace(ancre, ajout + ancre, 1)
    open(chemin, "w").write(source)
    print(f"   eslint.config.mjs : {nom}/** ignoré")

# 2. tsconfig de la racine : il compile `**/*.ts` et fait pointer `@/…` vers le
#    `src/` d'Amorce. Sans exclusion, `npm run typecheck` échoue à la racine sur
#    chaque import du projet client.
chemin = f"{racine}/tsconfig.json"
source = open(chemin).read()
if f'"{nom}"' not in source:
    source = re.sub(
        r'("exclude"\s*:\s*\[)',
        r'\1\n    "%s",' % nom,
        source,
        count=1,
    )
    open(chemin, "w").write(source)
    print(f"   tsconfig.json : {nom} exclu")

# 3. Hook de session : sans lui, chaque session distante redémarre sur un
#    dossier sans `node_modules`, et la première commande échoue.
chemin = f"{racine}/.claude/hooks/session-start.sh"
source = open(chemin).read()
if f'cd "$racine/{nom}"' not in source:
    ancre = 'echo "── Look & Find : SDK Flutter $FLUTTER_VERSION"'
    ajout = (
        f'echo "── {nom} : dépendances npm"\n'
        f'cd "$racine/{nom}"\n'
        f'npm install --no-audit --no-fund --silent\n\n'
    )
    source = source.replace(ancre, ajout + ancre, 1)
    open(chemin, "w").write(source)
    print(f"   session-start.sh : dépendances de {nom} installées au démarrage")
PYTHON

echo "── Intégration continue"
# Un projet sans workflow n'est vérifié que sur le poste de celui qui l'écrit.
# Le workflow du socle est recopié tel quel : mêmes commandes, mêmes deux
# travaux, y compris le contrôle des politiques sur un vrai PostgreSQL.
if [ -f "$racine/.github/workflows/$modele.yml" ] && [ ! -f "$racine/.github/workflows/$nom.yml" ]; then
  sed -e "s#\bagence/#$nom/#g" \
      -e "s#workflows/agence\.yml#workflows/$nom.yml#g" \
      -e "s#^  group: agence-#  group: $nom-#" \
      -e "s#^    working-directory: agence\$#    working-directory: $nom#" \
      -e "s#^name: Socle Agence\$#name: $affiche#" \
      -e "1s#.*#\# Vérification du projet client \`$nom/\`.#" \
      "$racine/.github/workflows/$modele.yml" > "$racine/.github/workflows/$nom.yml"
  echo "   .github/workflows/$nom.yml"
fi

# Le `.gitignore` de la racine ignore déjà tout `.env*`, dans n'importe quel
# dossier : le `.env.local` du client est couvert sans rien ajouter. Le
# `.gitignore` copié dans le projet réinclut son propre `.env.example`.
if git -C "$racine" check-ignore -q "$nom/.env.local"; then
  echo "   .gitignore : $nom/.env.local déjà ignoré par la règle .env* de la racine"
else
  echo "!! $nom/.env.local n'est PAS ignoré — vérifier le .gitignore avant de committer" >&2
fi

if [ "$verifier" -eq 1 ]; then
  echo "── Vérification (installation, lint, types, tests, build)"
  cd "$racine/$nom"
  npm install --no-audit --no-fund --silent
  npm run lint
  npm run typecheck
  npm test
  NEXT_PUBLIC_SUPABASE_URL="https://exemple.supabase.co" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="cle-de-compilation" \
  npm run build >/dev/null
  echo "   tout est vert"
fi

cat <<FINAL

Projet « $affiche » prêt dans $nom/.

Il ne lui manque qu'une base :
  1. Créer le projet Supabase, puis y exécuter $nom/supabase/schema.sql
  2. cp $nom/.env.example $nom/.env.local, et renseigner les trois variables
  3. cd $nom && npm run dev

Le schéma livré est celui du socle : deux tables de démonstration. Le remplacer
par celui du client fait partie du travail — voir /cadrage-brief-client pour le
périmètre, puis /stack-agence-supabase pour l'ordre de réalisation.
FINAL
