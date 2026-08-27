#!/bin/bash
# Lance la vérification des seuls projets touchés, tous en même temps, et ne
# rend qu'un verdict par projet.
#
# Pourquoi ce script existe : la fiche `/verifier` décrit huit séquences, une
# par projet, et laisse à qui l'exécute trois décisions — où le changement a
# atterri, quelle séquence lui correspond, dans quel ordre. Trois décisions
# reprises à chaque vérification, dont chacune peut se tromper dans le sens le
# plus coûteux : oublier une suite. Ici elles sont prises une fois.
#
# Et tout part en même temps. Mesuré sur la barrière d'Amorce, la plus lancée du
# dépôt : 25,5 s en série, 7,9 s en parallèle. Les étapes sont indépendantes —
# `tsc`, ESLint et `node --test` ne se lisent pas l'un l'autre — les mettre à la
# queue leu leu ne servait qu'à l'habitude.
#
# Les suites Python ne sont pas énumérées mais découvertes, exactement comme le
# fait `.github/workflows/tests-python.yml`, et pour la raison écrite dans son
# en-tête : dans ce dépôt, une liste écrite à la main est fausse le lendemain,
# et fausse en silence.

set -uo pipefail

racine="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$racine" || exit 1

base="origin/main"
tout=0
for arg in "$@"; do
  case "$arg" in
    --base=*) base="${arg#--base=}" ;;
    --tout)   tout=1 ;;
    -h|--help)
      echo "usage: verifier.sh [--base=<ref>] [--tout]"
      echo "  --base=<ref>  point de comparaison (défaut : origin/main)"
      echo "  --tout        tout vérifier, sans regarder ce qui a changé"
      exit 0 ;;
  esac
done

journal="$(mktemp -d)"
trap 'rm -rf "$journal"' EXIT

# ── Ce qui a changé ────────────────────────────────────────────────────────
# Les deux sources comptent : ce qui est déjà commité sur la branche, et ce qui
# ne l'est pas encore. Ne regarder que la première laisserait passer le travail
# en cours, qui est précisément celui qu'on veut vérifier.
touches() {
  { git diff --name-only "$base"...HEAD 2>/dev/null
    git status --porcelain | sed 's/^...//' | tr -d '"'
  } | sed 's/.* -> //' | sort -u | grep -v '^$'
}

if [ "$tout" -eq 1 ]; then
  fichiers="$(git ls-files)"
else
  fichiers="$(touches)"
fi

if [ -z "$fichiers" ]; then
  echo "Rien n'a changé depuis $base. Rien à vérifier."
  exit 0
fi

# ── Quels projets ces fichiers touchent-ils ────────────────────────────────
# Les suites Python sont découvertes, jamais listées : un projet nouveau est
# gardé sans avoir rien à déclarer ici.
suites_python() {
  find . -maxdepth 3 -type d -name tests -not -path '*/node_modules/*' \
       -not -path './.git/*' 2>/dev/null | sed 's|^\./||' | sort | while read -r t; do
    ls "$t"/test_*.py >/dev/null 2>&1 && echo "${t%/tests}"
  done
}

projets=""
inscrire() { case " $projets " in *" $1 "*) ;; *) projets="$projets $1" ;; esac; }

liste_python="$(suites_python)"
while IFS= read -r f; do
  [ -z "$f" ] && continue
  case "$f" in
    agence/*)        inscrire agence ;;
    look_and_find/*) inscrire flutter ;;
    src/*|scripts/*|package.json|package-lock.json|tsconfig.json|eslint.config.mjs|next.config.ts|postcss.config.mjs)
                     inscrire amorce ;;
  esac
  # Un fichier appartient à la suite Python dont le dossier le contient.
  while IFS= read -r p; do
    [ -n "$p" ] && case "$f" in "$p"/*) inscrire "py:$p" ;; esac
  done <<< "$liste_python"
done <<< "$fichiers"

if [ -z "$projets" ]; then
  echo "Rien d'exécutable n'a changé — documentation, outillage ou configuration."
  echo "Fichiers touchés :"
  echo "$fichiers" | sed 's/^/  /'
  exit 0
fi

# ── Les séquences ──────────────────────────────────────────────────────────
# Une fonction par projet, chacune rendant un code de sortie et écrivant son
# détail dans son propre fichier. Rien ne s'affiche pendant : le compte rendu
# arrive d'un bloc, dans l'ordre, plutôt qu'entrelacé par le parallélisme.
etape() {  # etape <fichier-journal> <intitulé> <commande...>
  local j="$1" nom="$2"; shift 2
  local t0=$SECONDS
  if "$@" >"$j.brut" 2>&1; then
    echo "    ✓ $nom ($((SECONDS - t0)) s)" >> "$j"
    return 0
  else
    echo "    ✗ $nom ($((SECONDS - t0)) s)" >> "$j"
    # La sortie de la *seule* étape qui casse est mise de côté ici. La première
    # version recollait les journaux de tout le projet et en montrait la fin :
    # les cent lignes vertes d'une suite qui passe noyaient l'erreur de typage
    # qu'on cherchait. Une sortie verte n'apprend rien, et elle coûte la place
    # de celle qui apprend quelque chose.
    { echo "── $nom"; tail -30 "$j.brut"; } > "$j.echec"
    return 1
  fi
}

lancer_amorce() {
  local j="$journal/amorce"; local e=0
  # Les trois sont indépendantes : elles partent ensemble, chacune dans son
  # propre journal, puis on recolle dans un ordre stable.
  ( etape "$j.typecheck" "typecheck" npm run typecheck ) & local a=$!
  ( etape "$j.lint"      "lint"      npm run lint ) & local b=$!
  ( etape "$j.test"      "tests unitaires" npm test ) & local c=$!
  wait $a || e=1; wait $b || e=1; wait $c || e=1
  cat "$j.typecheck" "$j.lint" "$j.test" > "$j" 2>/dev/null
  return $e
}

lancer_agence() {
  local j="$journal/agence"; local e=0
  ( cd agence || exit 1
    etape "$j.lint"      "lint"      npm run lint || exit 1 ) || e=1
  ( cd agence || exit 1
    etape "$j.typecheck" "typecheck" npm run typecheck || exit 1 ) || e=1
  ( cd agence || exit 1
    etape "$j.test"      "tests"     npm test || exit 1 ) || e=1
  # Le build vient en dernier et seul : il attrape ce que `tsc` laisse passer
  # dans une application App Router, et réclame les variables d'environnement —
  # les valeurs d'exemple suffisent à compiler.
  ( cd agence || exit 1
    NEXT_PUBLIC_SUPABASE_URL="https://exemple.supabase.co" \
    NEXT_PUBLIC_SUPABASE_ANON_KEY="cle-de-compilation" \
    etape "$j.build" "build" npm run build || exit 1 ) || e=1
  cat "$j".{lint,typecheck,test,build} > "$j" 2>/dev/null
  return $e
}

lancer_flutter() {
  local j="$journal/flutter"; local e=0
  if ! command -v flutter >/dev/null 2>&1; then
    echo "    ✗ SDK Flutter introuvable — voir /debloquer" > "$j"
    return 1
  fi
  ( cd look_and_find || exit 1
    etape "$j.pub"   "pub get"      flutter pub get || exit 1
    etape "$j.gen"   "build_runner" dart run build_runner build || exit 1
    etape "$j.gdart" "*.g.dart à jour" git diff --exit-code -- '*.g.dart' || exit 1
    etape "$j.an"    "analyze"      flutter analyze || exit 1
    etape "$j.test"  "tests"        flutter test --reporter=failures-only || exit 1 ) || e=1
  cat "$j".{pub,gen,gdart,an,test} > "$j" 2>/dev/null
  return $e
}

lancer_python() {  # lancer_python <dossier-projet>
  local p="$1"; local j="$journal/py-${p//\//_}"
  etape "$j" "tests" python3 -m unittest discover -s "$p/tests" -q
}

# ── Tout part en même temps ────────────────────────────────────────────────
declare -A pid_de
for p in $projets; do
  case "$p" in
    amorce)  lancer_amorce  & pid_de[amorce]=$! ;;
    agence)  lancer_agence  & pid_de[agence]=$! ;;
    flutter) lancer_flutter & pid_de[flutter]=$! ;;
    py:*)    dossier="${p#py:}"; lancer_python "$dossier" & pid_de["$p"]=$! ;;
  esac
done

echec=0
declare -A code_de
for p in $projets; do
  wait "${pid_de[$p]}"; code_de[$p]=$?
  [ "${code_de[$p]}" -ne 0 ] && echec=1
done

# ── Compte rendu ───────────────────────────────────────────────────────────
nom_lisible() {
  case "$1" in
    amorce)  echo "Amorce (studio)" ;;
    agence)  echo "Socle Agence" ;;
    flutter) echo "Look & Find" ;;
    py:*)    echo "${1#py:}" ;;
  esac
}
fichier_de() {
  case "$1" in
    py:*) local d="${1#py:}"; echo "$journal/py-${d//\//_}" ;;
    *)    echo "$journal/$1" ;;
  esac
}

echo
for p in $projets; do
  marque="✓"; [ "${code_de[$p]}" -ne 0 ] && marque="✗"
  echo "$marque $(nom_lisible "$p")"
  cat "$(fichier_de "$p")" 2>/dev/null
done

if [ "$echec" -ne 0 ]; then
  echo
  echo "── Le détail de ce qui casse"
  cat "$journal"/*.echec 2>/dev/null
fi

# ── Ce que ceci ne dit pas ─────────────────────────────────────────────────
# Taire les limites ferait de « tout est vert » un compte rendu faux. Elles
# dépendent des projets touchés, donc elles se calculent ici plutôt que de se
# réciter en entier.
echo
echo "── Ce que cette vérification ne couvre pas"
case " $projets " in
  *" amorce "*)
    echo "  • le rendu, l'audio, l'export et la mise en page mobile : npm run verify"
    echo '    (Chromium réel, npm run dev en parallèle, plusieurs minutes)' ;;
esac
case " $projets " in
  *" agence "*)
    echo "  • les politiques RLS : npm run test:rls, sur un vrai PostgreSQL" ;;
esac
case " $projets " in
  *" flutter "*)
    echo "  • les builds Android et iOS, la caméra et la réalité augmentée :"
    echo "    appareil réel ou workflow Look & Find, jamais ce conteneur" ;;
esac
case " $projets " in
  *" py:kdp "*)
    echo "  • la chaîne KDP de bout en bout : python3 kdp/pipeline/valider.py"
    echo "    sur de vrais PDF assemblés" ;;
esac
echo "  • et partout : si c'est beau, si c'est juste, si ça s'entend bien."

exit $echec
