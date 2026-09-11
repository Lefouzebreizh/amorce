# Git Bash sous Windows mange le `:` de `ref:chemin`

**11/09/2026, mesuré sur le PC.** Sur Git Bash (MSYS), un argument de la forme
`origin/main:.github/workflows/psy-ia.yml` n'arrive **pas** tel quel à git :

```
$ git cat-file -p "origin/main:.github/workflows/psy-ia.yml"
fatal: Not a valid object name origin\main;.github\workflows\psy-ia.yml
```

MSYS prend le `:` pour le séparateur d'une liste de chemins à l'unix, la
traduit en `;` façon Windows, et retourne les barres obliques au passage. Les
guillemets n'y changent rien — la conversion a lieu après.

## Pourquoi ça coûte, et ça a coûté deux fois dans la même séance

Le message part sur **stderr**. Dans le geste le plus courant —

```bash
git show origin/main:un/fichier | grep -c "quelque chose"
```

— il ne reste que le `0` de `grep`, qui se lit « ce fichier ne contient pas ce
que je cherche » alors qu'il veut dire « git n'a rien rendu du tout ».

Mesuré : deux conclusions fausses de suite, dans les deux sens. D'abord
« `main` n'a ni `.gitignore`, ni routage dans `verifier.sh`, ni entrée dans le
hook » — les trois y étaient. Puis « l'étape *Regarder la détection* a été
perdue à la fusion » — elle y était aussi, ligne 62. Chaque fois, un `0`
parfaitement lisible au-dessus duquel se trouvait un `fatal:` que le
pipeline avait ravalé.

C'est le §8 sous une forme de plus : **une mesure disait vert et le fichier
était faux** — ici, une mesure disait « absent » et le fichier était présent.

## Les parades, toutes les trois mesurées

```bash
MSYS_NO_PATHCONV=1 git cat-file -p "origin/main:.github/workflows/psy-ia.yml"  # marche
git show origin/main:./.github/workflows/psy-ia.yml                            # marche
git cat-file -e "$ref:$f"   # dans une boucle avec variables : marche aussi
```

Et la règle qui vaut au-delà de git : **quand un pipeline rend `0`, vérifier
que la commande d'avant a bien rendu quelque chose.** Un `| grep -c` sur une
commande muette rend le même `0` qu'un fichier qui ne contient rien.
