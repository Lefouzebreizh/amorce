#!/usr/bin/env bash
# Rejoue en local ce que fait « Tests Python » sur un runner GitHub.
#
# Pourquoi un script plutôt qu'une ligne de commande : lancer les suites depuis
# le dépôt ne prouve rien. Une session Claude Code a des fichiers que la CI n'a
# pas (`/mnt/skills/…`, des rushes non versionnés, ffmpeg posé par le hook) et
# des bibliothèques que `.github/requirements-tests.txt` n'installe pas. Des
# tests verts ici sont donc régulièrement rouges là-bas — c'est arrivé, et
# `main` est resté rouge cinq exécutions durant sans que personne le voie.
#
# Ce script supprime les trois écarts d'un coup :
#   1. il copie les seuls fichiers **suivis par git**, contenu du répertoire de
#      travail compris — exactement ce que verrait la CI si on poussait ;
#   2. il exécute dans un environnement Python n'ayant que les bibliothèques de
#      `.github/requirements-tests.txt` ;
#   3. il pose la police du lettrage comme le fait le workflow.
#
# L'environnement et la police sont mis en cache dans `.verif-ci/` (ignoré) :
# le premier passage coûte une minute, les suivants une quinzaine de secondes.
#
#   .claude/skills/verifier/scripts/comme-la-ci.sh          # les sept suites
#   .claude/skills/verifier/scripts/comme-la-ci.sh kdp      # une seule
set -uo pipefail

racine=$(git rev-parse --show-toplevel) || { echo "Pas un dépôt git."; exit 1; }
cd "$racine"

cache="$racine/.verif-ci"
venv="$cache/venv"
polices="$cache/polices"
copie="$cache/copie"
filtre="${1:-}"

mkdir -p "$cache"

if [ ! -x "$venv/bin/python" ]; then
  echo "── Environnement vierge (première fois, une minute)"
  python3 -m venv "$venv" || exit 1
fi
"$venv/bin/pip" install --quiet --disable-pip-version-check \
  -r .github/requirements-tests.txt || exit 1

# Même source que le workflow. Absente, les tests de lettrage kdp échouent sur
# six « cannot open Lora-Regular.ttf » et emportent toute la vérification.
if [ ! -s "$polices/Lora-Regular.ttf" ]; then
  echo "── Police du lettrage"
  mkdir -p "$polices"
  amont=https://raw.githubusercontent.com/google/fonts/main/ofl/lora
  curl -sSfL -o "$polices/Lora-Regular.ttf" "$amont/Lora%5Bwght%5D.ttf" \
    && curl -sSfL -o "$polices/Lora-Italic.ttf" "$amont/Lora-Italic%5Bwght%5D.ttf" \
    || echo "   (téléchargement impossible : les tests de lettrage rougiront)"
fi

# Fichiers suivis uniquement, contenu du répertoire de travail : ce que la CI
# verrait si l'on poussait maintenant, modifications non committées comprises.
rm -rf "$copie" && mkdir -p "$copie"
git ls-files -z | while IFS= read -r -d '' f; do
  [ -f "$f" ] || continue
  mkdir -p "$copie/$(dirname "$f")"
  cp "$f" "$copie/$f"
done

cd "$copie"
echec=0
trouvees=0

# Un chemin sous /mnt/skills/ existe dans une session Claude Code et nulle part
# ailleurs. Aucune exécution locale ne peut le détecter — le fichier est là, les
# tests passent — et c'est exactement ce qui a laissé `main` rouge cinq
# exécutions durant. Seule une lecture du code le voit.
#
# Signalé sans faire échouer : un tel chemin ne casse la CI que si un test
# l'atteint, et la chaîne kdp en compte une dizaine dans des scripts que rien
# ne teste. Un repli par variable d'environnement n'est pas compté — c'est la
# forme correcte, pas le défaut.
python3 - <<'PY'
import pathlib
suspects = []
for f in pathlib.Path('.').rglob('*'):
    if f.suffix not in {'.py', '.mjs', '.js', '.ts'} or not f.is_file():
        continue
    lignes = f.read_text(encoding='utf-8', errors='ignore').splitlines()
    for i, ligne in enumerate(lignes):
        if '/mnt/skills/' not in ligne:
            continue
        voisinage = ' '.join(lignes[max(0, i - 1):i + 2])
        if 'environ' in voisinage or 'getenv' in voisinage:
            continue
        suspects.append(f"{f}:{i + 1}")
        break
if suspects:
    print("  AVERTIR  chemin de session en dur, invisible hors session :")
    for s in suspects:
        print(f"           {s}")
    print("           → à poser par variable d'environnement le jour où un test l'atteint.")
PY
for tests in $(find . -maxdepth 3 -type d -name tests -not -path '*/node_modules/*' | sort); do
  ls "$tests"/test_*.py >/dev/null 2>&1 || continue
  projet="${tests#./}"; projet="${projet%/tests}"
  [ -n "$filtre" ] && [[ "$projet" != *"$filtre"* ]] && continue
  trouvees=$((trouvees + 1))
  sortie="$cache/$(echo "$projet" | tr / -).log"
  # PATH réduit : le hook de démarrage relie ffmpeg, pas le runner. Un test qui
  # ne passe que grâce à un binaire posé par le hook doit se voir ici.
  if env -i HOME="$HOME" PATH=/usr/bin:/bin KDP_POLICES="$polices" \
       "$venv/bin/python" -m unittest discover -s "$tests" >"$sortie" 2>&1; then
    printf '  VERT   %s\n' "$projet"
  else
    printf '  ROUGE  %s  → %s\n' "$projet" "$sortie"
    echec=1
  fi
done

if [ "$trouvees" -eq 0 ]; then
  echo "Aucune suite trouvée${filtre:+ pour « $filtre »}."
  exit 1
fi

echo "$trouvees suite(s). $([ "$echec" -eq 0 ] && echo 'Tout vert.' || echo 'Voir les journaux ci-dessus.')"
exit "$echec"
