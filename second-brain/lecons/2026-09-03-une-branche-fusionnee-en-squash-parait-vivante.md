# Dans un dépôt qui fusionne en squash, git ne sait pas dire quelles branches sont mortes

**03/09/2026 — 320 branches distantes, trois mesures, trois réponses.**

## Ce qui a été mesuré

Question simple : lesquelles des 320 branches distantes peut-on supprimer sans
rien perdre ? Trois façons de la poser, trois résultats incompatibles :

| mesure | « encore vivantes » |
| --- | --- |
| `git rev-list origin/main..origin/<b> --count` > 0 | **225** |
| `git diff --quiet origin/main...origin/<b>` échoue | **224** |
| pas de pull request **fusionnée** sur cette branche | **32** |

C'est la troisième qui est juste, et l'écart n'est pas un détail : les deux
premières condamnaient à la conservation **193 branches parfaitement
absorbées**.

## La cause

Ce dépôt fusionne en **squash**. La fusion réécrit l'histoire : le commit qui
entre dans `main` est un commit neuf, qui ne partage aucun identifiant avec ceux
de la branche. Donc :

- `rev-list main..branche` compte des commits qui n'existent effectivement pas
  dans `main` — alors que leur contenu y est ;
- `diff main...branche` compare la branche à la **base de divergence**, pas à
  `main`. Les changements de la branche apparaissent donc toujours, même
  intégralement fusionnés.

Les deux commandes répondent exactement à ce qu'on leur demande. C'est la
question qui était mauvaise.

## La règle

**La seule source qui tranche est l'état de la pull request**, pas l'historique
git :

```bash
curl -sS "https://api.github.com/repos/<owner>/<repo>/pulls?state=closed&per_page=100&page=N" \
  | python3 -c 'import sys,json
for pr in json.load(sys.stdin):
  if pr.get("merged_at"): print(pr["head"]["ref"])'
```

Croiser cette liste avec `git ls-remote --heads origin` donne les branches
réellement mortes. Et une branche supprimée ainsi n'est pas perdue : sa PR garde
son historique, et GitHub propose « Restore branch » pendant des mois.

Vaut au-delà des branches : **une commande git juste sur un dépôt qui réécrit
son histoire répond à côté**, sans jamais se signaler. Même famille que le §8 —
une mesure disait vert et le fichier était faux.
