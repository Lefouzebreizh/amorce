# Le jeu de démonstration fixe un plancher, et ce plancher cache des défauts

06/09/2026 — mesuré sur `iptv/`, en accordant ses compteurs d'écran.

## Ce qui était faux, et depuis toujours

Neuf compteurs d'interface écrivaient leur pluriel en dur : « 1 séries »,
« 1 thèmes », « 1 résultats », « 1 vérifiées vivantes ». Cinq messages de la
ligne de commande aussi — « Importé : 1 entrées ».

Le défaut n'est pas subtil : il se voit au premier coup d'œil. Il n'avait
pourtant jamais été vu, et la raison est arithmétique.

## Les deux nombres du projet, et celui qui manque

| d'où viennent les données | combien d'entrées |
| --- | --- |
| `iptv demo`, que `demarrer.sh` charge sur un cache vide | **6** |
| un vrai abonnement | **120 000** |
| **le premier utilisateur qui importe une chaîne pour essayer** | **1** |

Aucun des deux jeux disponibles ne descend à un. Le seul état où le défaut
existe est donc **exactement celui du premier lancement de quelqu'un qui
essaie** — et c'est le seul que ni la démonstration ni la production ne
produisent jamais.

## Ce que la vérification ne pouvait pas voir

`verifier.sh` est passé au vert avant et après, tests, types et construction
compris. Ce n'est pas une lacune de la suite : le pluriel d'un mot dans une
chaîne de caractères ne casse aucun type, ne fait échouer aucune assertion, et
ne se distingue en rien d'un texte juste. Il n'existe qu'à l'écran, et
seulement sous un seuil que le décor n'atteint pas.

Il a fallu monter une base de trois entrées à la main — une par genre, dans un
fichier à part via `--base` — et conduire les six écrans pour le voir. Une
minute, une fois qu'on sait qu'il faut le faire.

## Ce que ça ajoute à ce qui est déjà écrit

`lecons.md` porte déjà « Un décor trop favorable rend un contrôle vert sans
rien prouver » : un cas limite ne s'éprouve que dans un décor qui le rend
possible. Cette leçon-ci en est le cas le plus insidieux, parce qu'il ne s'agit
pas d'un état **hostile** qu'on aurait négligé de fabriquer — panne réseau,
quota atteint, catalogue condamné — mais d'un état parfaitement ordinaire :
celui de tout nouvel utilisateur.

D'où la règle à ajouter : **le jeu de démonstration d'un produit fixe un
plancher, et rien en dessous n'est jamais regardé.** Quand ce jeu sert aussi de
premier contact — ce que `demarrer.sh` en fait ici — il devient le seul état
que quiconque observe, et il masque précisément la tranche que le vrai premier
utilisateur traverse.

Le geste, quand un affichage dépend d'un nombre : le regarder à **zéro, un et
beaucoup**, jamais seulement à « beaucoup ». Un et zéro ne se ressemblent pas
non plus — en français, zéro prend le singulier, ce qui rend le test `n > 1`
juste et le test `n !== 1` faux.
