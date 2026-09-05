# Une suite de tests qui grossit peut avoir perdu des tests

Mesuré le 05/09/2026 sur `pepites/`, en ajoutant un témoin au bulletin du
radar. Le défaut a vécu quinze minutes et trois exécutions vertes.

## Ce qui s'est passé

Le lot ajoutait un fichier de tests. Écrit d'un `cat > tests/test_temoin.py`,
sans regarder si le nom était pris. **Il l'était** — par un fichier créé la
veille, dans la même session, pour un autre outil du même projet. Le `cat`
l'a remplacé, et ses cinq tests ont disparu.

La suite est restée verte à chaque relance. Voici la seule trace qu'il y avait :

| exécution | tests | ce que ça aurait dû être |
| --- | --- | --- |
| avant le lot | 172 | — |
| après 4 tests ajoutés | **176** | 176 ✓ |
| après 8 de plus | **179** | **184** |

**Le nombre montait.** C'est tout le piège : une suppression de tests ne se
voit pas dans un compteur qui augmente, tant qu'on ajoute plus qu'on ne
détruit. Aucune ligne rouge, aucun avertissement, et un `git diff --stat` qui
annonçait `266 insertions, 68 suppressions` sur un fichier qu'on croyait neuf —
les soixante-huit suppressions étaient les tests de la veille.

## La règle

**Le compte attendu d'une suite se calcule avant de la lancer**, et se compare
au compte rendu. `172 + 12 = 184` ; le vert affichait 179. Un total qui monte
n'est pas une preuve : seule l'égalité en est une.

Et sa cause, qui est la règle du dépôt appliquée là où on ne l'attend pas :
**chercher avant d'écrire vaut aussi pour un fichier de tests.** Le `CLAUDE.md`
le dit déjà pour le code — « le `grep` porte sur ce que la chose fait, jamais
sur le nom qu'on comptait lui donner ». Un fichier de tests échappe au réflexe
parce qu'il paraît sans conséquence : il n'a pas d'appelant, rien n'en dépend,
on le croit inerte. Il est au contraire le seul fichier dont la destruction
**rend le dépôt plus vert**.

Le geste coûte une seconde et se fait avant toute création :

```bash
test -e <chemin> && echo "PRIS — choisir un autre nom"
```

## Ce qui a failli aggraver le cas

La falsification du test — l'injecter d'un défaut pour vérifier qu'il rougit —
a d'abord été lancée par `python3 -m unittest tests.test_x`, qui ne met pas
`tests/` sur le chemin d'import. Les deux exécutions, avec et sans défaut, ont
échoué **à l'import** et rendu le même `FAILED (errors=1)`. Lu vite, ça
ressemblait à la preuve attendue.

Une falsification se lance donc par la commande **du dépôt** — ici
`unittest discover -s tests` — et pas par une invocation improvisée : deux
rouges identiques pour deux raisons différentes ne prouvent rien, et c'est le
genre de preuve qu'on ne relit pas.

## Ce que ça ne dit pas

Que le nommage soit en cause. Le nom court était le bon des deux fois — un
banc d'essai sur marché fabriqué et un témoin sur marché réel s'appellent tous
les deux « témoin ». Ce qui manquait n'est pas un préfixe, c'est le regard
avant l'écriture.
