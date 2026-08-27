#!/bin/bash
# Pousse la branche courante et rend un lien qui ouvre la pull request
# **déjà remplie** — titre et corps compris.
#
# Pourquoi : quand la session n'a pas les outils `mcp__github__*`, la PR ne peut
# pas s'ouvrir d'ici. Le dernier recours est de la faire ouvrir à la main, et ce
# recours coûte cher au propriétaire de ce dépôt, qui lit depuis un téléphone :
# retrouver le dépôt, la branche, taper un titre, taper un corps. Un lien
# pré-rempli ramène tout cela à un appui.
#
# GitHub accepte `title` et `body` en paramètres de son formulaire de
# comparaison. Les deux sont pris dans les commits de la branche — ce sont eux
# qui décrivent l'intention, il n'y a rien à réécrire.

set -uo pipefail

racine="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$racine" || exit 1

base="${1:-main}"
branche="$(git rev-parse --abbrev-ref HEAD)"

if [ "$branche" = "$base" ] || [ "$branche" = "HEAD" ]; then
  echo "Rien à ouvrir : la branche courante est « $branche »."
  exit 1
fi

commits="$(git log --format='%s' "origin/$base..HEAD" 2>/dev/null)"
if [ -z "$commits" ]; then
  echo "Aucun commit devant origin/$base — rien à proposer."
  exit 1
fi

echo "── Poussée"
# Sans `--force-with-lease` : une branche rebasée se pousse à part, délibérément.
# Un forçage caché dans un script d'aide écraserait un jour le travail d'une
# autre session sans que personne ne l'ait demandé.
git push -u origin "$branche" 2>&1 | tail -2

depot="$(git remote get-url origin | sed -e 's|.*github\.com[:/]||' -e 's|\.git$||')"

# Un seul commit : son sujet fait le titre et son corps fait le corps. Plusieurs :
# le premier sujet fait le titre, et la liste des sujets fait un corps honnête.
nombre="$(echo "$commits" | wc -l | tr -d ' ')"
if [ "$nombre" -eq 1 ]; then
  titre="$commits"
  corps="$(git log --format='%b' "origin/$base..HEAD")"
else
  titre="$(echo "$commits" | head -1)"
  corps="$(git log --reverse --format='- %s%n%n%b' "origin/$base..HEAD")"
fi

# Les mentions de fin appartiennent au commit, pas au corps de la PR : GitHub les
# affiche déjà sous chaque commit. Et un corps trop long est ramené à son premier
# paragraphe — au-delà, le lien devient illisible et certains navigateurs mobiles
# le tronquent ; les messages de commit disent le reste.
lien="$(TITRE="$titre" CORPS="$corps" DEPOT="$depot" BASE="$base" BRANCHE="$branche" python3 -c '
import os, re, urllib.parse
corps = re.sub(r"(?m)^(Co-Authored-By|Claude-Session|Signed-off-by):.*\n?", "", os.environ["CORPS"]).strip()
if len(corps) > 1200:
    corps = corps.split("\n\n")[0].strip() + "\n\nLe détail est dans les messages de commit."
q = urllib.parse.quote
print("https://github.com/%s/compare/%s...%s?expand=1&title=%s&body=%s"
      % (os.environ["DEPOT"], os.environ["BASE"], os.environ["BRANCHE"],
         q(os.environ["TITRE"]), q(corps)))
')"

echo
echo "── À ouvrir d'un appui"
echo "$lien"
