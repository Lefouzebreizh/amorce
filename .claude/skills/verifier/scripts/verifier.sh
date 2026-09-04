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

# ── Aucun marqueur de conflit ne part ─────────────────────────────────────────
# Deux fois dans la meme nuit, `git add -A` a avale des marqueurs `<<<<<<<`
# apres une resolution automatique qui avait echoue en silence, et ils sont
# partis sur `main` — une fois dans les lecons, une fois dans une recette JSON
# qui est devenue illisible. Aucun test ne les attrape : ce ne sont que des
# lignes de texte, et un JSON casse ne casse que le montage, pas la suite.
marqueurs=$(grep -rln '^<<<<<<< \|^>>>>>>> ' \
  --include='*.json' --include='*.py' --include='*.md' --include='*.sh' \
  --include='*.ts' --include='*.tsx' --include='*.dart' . 2>/dev/null \
  | grep -v node_modules || true)
if [ -n "$marqueurs" ]; then
  echo "  ✗ marqueurs de conflit non resolus :"
  echo "$marqueurs" | sed 's/^/      /'
  exit 1
fi

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
    artisan-express/*) inscrire artisan ;;
    look_and_find/*) inscrire flutter ;;
    hypersensible-bienveillance/*) inscrire hypersensible ;;
    titan-builder/*) inscrire titan ;;
    iptv/*)          inscrire iptv ;;
    bilan-patrimoine/*) inscrire bilan ;;
    motion/*)        inscrire motion ;;
    licence-serveur/*) inscrire licence ;;
    comptes-serveur/*) inscrire comptes ;;
    annuaire-ia/*)   inscrire annuaire ;;
    src/*|scripts/*|package.json|package-lock.json|tsconfig.json|eslint.config.mjs|next.config.ts|postcss.config.mjs)
                     inscrire amorce ;;
    # L'outillage du dépôt — hooks et scripts de compétences — n'appartenait à
    # aucun projet, donc à personne : un changement du vérificateur lui-même se
    # voyait répondre « rien d'exécutable n'a changé », par le vérificateur.
    .claude/*.sh|.claude/*.mjs|.claude/*.js|.claude/*.py)
                     inscrire outillage ;;
  esac
  # Un fichier appartient à la suite Python dont le dossier le contient.
  while IFS= read -r p; do
    [ -n "$p" ] && case "$f" in "$p"/*) inscrire "py:$p" ;; esac
  done <<< "$liste_python"
done <<< "$fichiers"

if [ -z "$projets" ]; then
  echo "Rien d'exécutable n'a changé — documentation ou configuration."
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

# Comme `etape`, mais le code 3 vaut « non effectué » plutôt qu'« échoué ».
# C'est ce que rend `regarder.mjs` quand aucun Chromium n'est installé : bloquer
# une poussée pour ça punirait le code d'un manque de la machine, et le compter
# vert serait pire — une mesure qui n'a rien mesuré.
etape_regard() {  # etape_regard <fichier-journal> <intitulé> <commande...>
  local j="$1" nom="$2"; shift 2
  local t0=$SECONDS
  "$@" >"$j.brut" 2>&1
  local code=$?
  case $code in
    0) echo "    ✓ $nom ($((SECONDS - t0)) s)" >> "$j"; return 0 ;;
    3) echo "    ⊘ $nom — non effectué, pas de Chromium" >> "$j"; return 0 ;;
    *) echo "    ✗ $nom ($((SECONDS - t0)) s)" >> "$j"
       { echo "── $nom"; tail -30 "$j.brut"; } > "$j.echec"; return 1 ;;
  esac
}

# Regarder une application qui a besoin d'un serveur : on la sert sur un port à
# elle, on mesure, on arrête tout l'arbre.
#
# Deux pièges, tous deux payés ici, et tous deux rendaient le contrôle **vert
# sur une page cassée** — le pire des états, parce qu'il rassure :
#
# 1. `kill` sur le PID de `npm` ne tue rien. La chaîne réelle est
#    `npm exec next start` -> `sh -c next start` -> `next-server`, et le
#    petit-fils est réattaché à init : il continue de servir. D'où `setsid`,
#    qui met l'arbre dans son propre groupe, et `kill -- -PGID` qui le prend
#    entier.
# 2. Un serveur laissé derrière occupe le port, et le contrôle suivant mesure
#    **le build précédent** sans que rien ne le dise. On refuse donc de
#    commencer si le port répond déjà : mesurer un serveur qu'on n'a pas
#    démarré, c'est mesurer on ne sait quoi.
#
# Et jamais `pkill -f` : le motif est comparé à la ligne de commande complète,
# celle du shell appelant la contient, et il se tue lui-même — deux commandes
# ont disparu comme ça, sans un mot.
regarder_servi() {  # regarder_servi <dossier> <port>
  local d="$1" port="$2"

  if curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:$port/"; then
    echo "le port $port répond déjà — un serveur oublié fausserait la mesure"
    return 1
  fi

  ( cd "$d" || exit 1
    setsid npm exec next start -- -p "$port" >/dev/null 2>&1 &
    serveur=$!
    pret=1
    for _ in $(seq 1 40); do
      curl -sf -o /dev/null "http://127.0.0.1:$port/" && { pret=0; break; }
      kill -0 "$serveur" 2>/dev/null || break
      sleep 1
    done

    if [ $pret -ne 0 ]; then
      kill -- "-$serveur" 2>/dev/null
      echo "le serveur n'a pas répondu sur le port $port"
      exit 1
    fi

    npm run regarder --silent "http://127.0.0.1:$port/"
    code=$?
    kill -- "-$serveur" 2>/dev/null
    exit $code )
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

lancer_artisan() {
  local d="artisan-express"; local j="$journal/artisan"; local e=0
  # Les trois premières ne se lisent pas l'une l'autre : elles partent ensemble.
  ( cd "$d" || exit 1
    etape "$j.lint"      "lint"      npm run lint || exit 1 ) & local a=$!
  ( cd "$d" || exit 1
    etape "$j.typecheck" "typecheck" npm run typecheck || exit 1 ) & local b=$!
  ( cd "$d" || exit 1
    etape "$j.test"      "tests"     npm test || exit 1 ) & local c=$!
  wait $a || e=1; wait $b || e=1; wait $c || e=1
  # Le build ferme la marche, seul : il attrape ce que `tsc` laisse passer dans
  # une application App Router — une directive 'use client' oubliée, un
  # composant serveur qui reçoit une fonction en propriété.
  ( cd "$d" || exit 1
    etape "$j.build" "build" npm run build || exit 1 ) || e=1
  # Le regard vient après le build : il mesure la page telle qu'elle sera
  # servie — contraste, taille de texte, cibles, débordement — et c'est le seul
  # contrôle que `tsc` et les tests ne peuvent pas faire.
  etape_regard "$j.regard" "regard 393 × 873" regarder_servi "$d" 3931 || e=1
  cat "$j".{lint,typecheck,test,build,regard} > "$j" 2>/dev/null
  return $e
}

lancer_hypersensible() {
  local d="hypersensible-bienveillance"; local j="$journal/hypersensible"; local e=0
  ( cd "$d" || exit 1
    etape "$j.test"  "tests"  npm test || exit 1 ) || e=1
  ( cd "$d" || exit 1
    etape "$j.types" "types"  npm run check || exit 1 ) || e=1
  # Le build ferme la marche : il est le seul à voir ce que `tsc` laisse passer
  # — une feuille de style qui ne compile pas, un import de composant qui ne se
  # résout pas, un script client qui casse au regroupement.
  ( cd "$d" || exit 1
    etape "$j.build" "build"  npm run build || exit 1 ) || e=1
  cat "$j".{test,types,build} > "$j" 2>/dev/null
  return $e
}

lancer_licence() {
  # Deux étapes seulement, et c'est la mesure du projet : zéro dépendance, donc
  # rien à installer, rien à construire. Ses tests tournent sans D1 ni réseau.
  local d="licence-serveur"; local j="$journal/licence"; local e=0
  ( cd "$d" || exit 1; etape "$j.typecheck" "typecheck" npm run typecheck ) & local a=$!
  ( cd "$d" || exit 1; etape "$j.test"      "tests"     npm test ) & local b=$!
  wait $a || e=1; wait $b || e=1
  cat "$j".{typecheck,test} > "$j" 2>/dev/null
  return $e
}

lancer_comptes() {
  # Même mesure que licence-serveur, même raison : zéro dépendance, rien à
  # installer. Ses tests tournent sans D1 ni Resend.
  local d="comptes-serveur"; local j="$journal/comptes"; local e=0
  ( cd "$d" || exit 1; etape "$j.typecheck" "typecheck" npm run typecheck ) & local a=$!
  ( cd "$d" || exit 1; etape "$j.test"      "tests"     npm test ) & local b=$!
  wait $a || e=1; wait $b || e=1
  cat "$j".{typecheck,test} > "$j" 2>/dev/null
  return $e
}

lancer_motion() {
  # Deux étapes, et c'est délibéré : ici `npm run build` REND UNE VIDÉO — il
  # lance un Chromium, prend des minutes, et n'a rien à faire dans une
  # vérification. Ce qui se garde est l'invariant de la zone sûre, qui se lit
  # sans rendre une seule image.
  local d="motion"; local j="$journal/motion"; local e=0
  ( cd "$d" || exit 1; etape "$j.typecheck" "typecheck" npm run typecheck ) & local a=$!
  ( cd "$d" || exit 1; etape "$j.test"      "tests"     npm test ) & local b=$!
  wait $a || e=1; wait $b || e=1
  cat "$j".{typecheck,test} > "$j" 2>/dev/null
  return $e
}

lancer_titan() {
  local d="titan-builder"; local j="$journal/titan"; local e=0
  # Lint et typecheck ne se lisent pas l'un l'autre : ils partent ensemble.
  ( cd "$d" || exit 1; etape "$j.lint"      "lint"      npm run lint ) & local a=$!
  ( cd "$d" || exit 1; etape "$j.typecheck" "typecheck" npm run typecheck ) & local b=$!
  ( cd "$d" || exit 1; etape "$j.test"      "tests"     npm test ) & local c=$!
  wait $a || e=1; wait $b || e=1; wait $c || e=1
  # Le build ferme la marche, seul à voir ce que `tsc` laisse passer.
  ( cd "$d" || exit 1; etape "$j.build" "build" npm run build || exit 1 ) || e=1
  # La démonstration est régénérée puis regardée : c'est la sortie réelle du
  # générateur, et un changement de feuille de style s'y voit là et nulle part
  # ailleurs.
  ( cd "$d" || exit 1
    etape_regard "$j.regard" "regard 393 × 873" sh -c 'npm run demo --silent >/dev/null && npm run regarder --silent demo' ) || e=1
  cat "$j".{lint,typecheck,test,build,regard} > "$j" 2>/dev/null
  return $e
}

lancer_bilan() {
  local d="bilan-patrimoine"; local j="$journal/bilan"; local e=0
  # Ni build ni interface : ce lot est du calcul pur. Les deux étapes ne se
  # lisent pas l'une l'autre, donc elles partent ensemble.
  ( cd "$d" || exit 1; etape "$j.test"  "tests" npm test ) & local a=$!
  ( cd "$d" || exit 1; etape "$j.check" "types" npm run check ) & local b=$!
  wait $a || e=1; wait $b || e=1
  cat "$j".{test,check} > "$j" 2>/dev/null
  return $e
}

lancer_iptv() {
  local d="iptv"; local j="$journal/iptv"; local e=0
  # Les deux premières ne se lisent pas l'une l'autre : elles partent ensemble.
  ( cd "$d" || exit 1; etape "$j.test"  "tests" npm test ) & local a=$!
  ( cd "$d" || exit 1; etape "$j.check" "types" npm run check ) & local b=$!
  wait $a || e=1; wait $b || e=1
  # Le build ferme la marche, seul : il est le seul à voir ce que `tsc` laisse
  # passer dans une application App Router — un composant serveur qui importe du
  # client, une page qu'on pré-rendrait alors qu'elle lit la base.
  ( cd "$d" || exit 1; etape "$j.build" "build" npm run build ) || e=1
  cat "$j".{test,check,build} > "$j" 2>/dev/null
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

# Le réseau d'annuaires : les données, puis les pages dans un vrai navigateur.
#
# Ces onze sites n'ont ni compilateur, ni typage, ni test unitaire possible :
# tout ce qui compte — la charte qui suit la niche, la modale, l'adresse
# profonde — ne se voit qu'en exécutant la page. Le parcours prend **environ
# cinq minutes**, et c'est cher ; mais il est la seule vérification que ce
# projet possède, et la fiche de cette compétence le promettait déjà sans que
# rien ne le lance. Une couverture annoncée et absente est pire que pas de
# couverture : on lit « couvert », on voit vert, on pousse.
lancer_annuaire() {
  local d="annuaire-ia"; local j="$journal/annuaire"; local e=0
  # Les tests d'abord : ils éprouvent le validateur lui-même, et valider onze
  # bases avec un filet troué ne prouve rien. Puis `valider`, rapide, qui dit si
  # les données tiennent — inutile de promener un navigateur sur onze sites
  # bâtis sur une base fausse.
  ( cd "$d" || exit 1; etape "$j.test" "tests du validateur" npm test ) || e=1
  if [ $e -eq 0 ]; then
    ( cd "$d" || exit 1; etape "$j.valider" "données" npm run valider ) || e=1
  fi
  if [ $e -eq 0 ]; then
    ( cd "$d" || exit 1; etape "$j.parcours" "parcours Chromium (~5 min)" npm run verifier ) || e=1
  fi
  cat "$j".{test,valider,parcours} > "$j" 2>/dev/null
  return $e
}

# L'outillage : la syntaxe des scripts changés, et rien d'autre.
#
# Ce pas est **volontairement partiel**, et c'est écrit ici pour que personne ne
# le prenne pour davantage : il attrape la faute qui casse tout — un `fi`
# manquant, une accolade en trop — et il ne dit rien du comportement. Un
# vérificateur peut passer `bash -n` et mesurer la mauvaise chose ; seul le
# geste de le casser exprès l'établit.
#
# Le partiel vaut mieux que le rien qui existait avant : un script de hook cassé
# ne se découvrait qu'au démarrage de la session suivante, chez quelqu'un
# d'autre.
lancer_outillage() {
  local j="$journal/outillage"; local e=0
  # Les journaux de pas vivent dans un sous-dossier, et on les recolle par une
  # liste explicite. Un `cat "$j".*` ramassait aussi les `.brut` et les `.echec`
  # que `etape` dépose à côté : la sortie d'erreur se retrouvait au milieu du
  # verdict, avant même la section qui doit la porter.
  local d="$journal/outillage.d"; mkdir -p "$d"
  local etapes=(); local n=0

  while IFS= read -r f; do
    [ -f "$f" ] || continue
    local verif=()
    case "$f" in
      .claude/*.sh)  verif=(bash -n "$f") ;;
      .claude/*.mjs|.claude/*.js) verif=(node --check "$f") ;;
      .claude/*.py)  verif=(python3 -m py_compile "$f") ;;
      *) continue ;;
    esac
    etape "$d/$n" "syntaxe $f" "${verif[@]}" || e=1
    etapes+=("$d/$n"); n=$((n + 1))
  done <<< "$fichiers"

  [ ${#etapes[@]} -gt 0 ] && cat "${etapes[@]}" > "$j" 2>/dev/null
  # Les détails d'échec sont relus par un `*.echec` à la racine du journal.
  for fichier in "$d"/*.echec; do
    [ -f "$fichier" ] && cp "$fichier" "$journal/outillage-$(basename "$fichier")"
  done
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
    artisan) lancer_artisan & pid_de[artisan]=$! ;;
    flutter) lancer_flutter & pid_de[flutter]=$! ;;
    hypersensible) lancer_hypersensible & pid_de[hypersensible]=$! ;;
    titan)   lancer_titan & pid_de[titan]=$! ;;
    iptv)    lancer_iptv  & pid_de[iptv]=$! ;;
    bilan)   lancer_bilan & pid_de[bilan]=$! ;;
    motion)  lancer_motion & pid_de[motion]=$! ;;
    licence) lancer_licence & pid_de[licence]=$! ;;
    comptes) lancer_comptes & pid_de[comptes]=$! ;;
    annuaire) lancer_annuaire & pid_de[annuaire]=$! ;;
    outillage) lancer_outillage & pid_de[outillage]=$! ;;
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
    artisan) echo "Artisan Express (page de vente)" ;;
    flutter) echo "Look & Find" ;;
    hypersensible) echo "Hypersensible & Bienveillance" ;;
    titan)   echo "TITAN Builder" ;;
    iptv)    echo "IPTV / VOD" ;;
    bilan)   echo "Bilan Patrimoine" ;;
    motion)  echo "Habillages animés (motion)" ;;
    licence) echo "Serveur de licence" ;;
    comptes) echo "Serveur de comptes" ;;
    annuaire) echo "Réseau d'annuaires IA" ;;
    outillage) echo "Outillage du dépôt (syntaxe seule)" ;;
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
    echo "  • les politiques RLS : npm run test:rls, sur un vrai PostgreSQL"
    echo "  • la sauvegarde d'une base client : npm run test:sauvegarde,"
    echo "    qui sauvegarde, détruit la base et restaure — quelques secondes" ;;
esac
case " $projets " in
  *" artisan "*)
    echo "  • l'envoi réel du formulaire : il demande une clé Resend, que rien"
    echo "    ici ne détient — le premier envoi se regarde en ligne" ;;
esac
case " $projets " in
  *" flutter "*)
    echo "  • les builds Android et iOS, la caméra et la réalité augmentée :"
    echo "    appareil réel ou workflow Look & Find, jamais ce conteneur" ;;
esac
case " $projets " in
  *" hypersensible "*)
    echo "  • le quota des cinq analyses, le radar et la tournée de veille :"
    echo "    npm run db:init, npm run preview, npm run cron — rien de tout cela"
    echo "    ne tourne sous astro dev, seul wrangler sert les Pages Functions" ;;
esac
case " $projets " in
  *" iptv "*)
    echo "  • le dialogue avec un vrai panneau Xtream et une vraie liste : les"
    echo "    tests injectent fetch et ne touchent pas au réseau, et Xtream"
    echo "    Codes n'a aucune spécification publiée à leur opposer"
    echo "  • l'interface, le lecteur et le mandataire de flux : npm run verify"
    echo "    (dans iptv/, Chromium réel et flux HLS fabriqué par ffmpeg)" ;;
esac
case " $projets " in
  *" bilan "*)
    echo "  • si le bilan se lit vraiment : npm run exemple (dans"
    echo "    bilan-patrimoine/), trois profils contrastés à parcourir des yeux."
    echo "    Les deux défauts les plus sérieux trouvés jusqu'ici — un rapport"
    echo "    qui ouvrait sur des reproches, un conseil qui contredisait son"
    echo "    propre texte — sont passés à travers cinquante-trois tests verts"
    echo "  • si les taux de référence sont à jour : ils portent leur date, et"
    echo "    les valeurs livrées sont à confirmer avant toute mise en ligne" ;;
esac
case " $projets " in
  *" py:kdp "*)
    echo "  • la chaîne KDP de bout en bout : python3 kdp/pipeline/valider.py"
    echo "    sur de vrais PDF assemblés" ;;
esac
echo "  • et partout : si c'est beau, si c'est juste, si ça s'entend bien."

exit $echec
