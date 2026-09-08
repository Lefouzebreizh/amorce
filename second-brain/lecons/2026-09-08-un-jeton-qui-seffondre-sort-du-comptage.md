# Un jeton qui s'effondre sort du comptage, celui qui tient y reste

*08/09/2026 — trouvé en lisant le bulletin `bilan` du radar de pépites, tour 18.*

## Ce qui est mesuré

`pepites/bilan.py` ne juge un jeton qu'à partir de **deux relevés espacés de six
heures**. Sous cette barre, il rend `indécidable` — et c'est un bon refus : sur
un seul relevé, afficher « 0 % » inventerait une stabilité que personne n'a
mesurée.

Mais un relevé ne s'écrit que pour un **candidat**, c'est-à-dire un jeton qui
vient de passer l'entonnoir (`pipeline.py`, la boucle `for candidat in
candidats` qui appelle `memoire.enregistrer`). Un jeton n'obtient donc son
second relevé qu'en **repassant l'entonnoir six heures plus tard**.

Or l'entonnoir écarte par le bas. Au tour 18, les motifs de rejet portaient
**37 jetons sous le plancher de liquidité de Solana**, **9 pour trop peu de
transactions**, **1 pour capitalisation trop faible** — contre **1 seul** pour
« déjà parti (+400 % en 24 h) ». Un jeton qui s'effondre perd sa liquidité et
ses échanges, retombe sous ces planchers, cesse d'être relevé, et **se fige en
`indécidable` sans jamais compter comme une perte**. Un jeton qui tient reste
candidat, se fait relever à chaque tour, et finit jugé.

Au tour 18 : **17 jugeables, 3 trop tôt, 13 indécidables** sur 33 lignes. Deux
lignes sur cinq sont un « je ne sais pas » — et ce n'est pas un échantillon
tiré au hasard.

## Ce que ça rend faux

Tout taux de hausses calculé sur les jugeables **penche vers le haut**, et rien
dans le bulletin ne le signale. Les quatre refus de conclure documentés en tête
de `bilan.py` couvrent le relevé unique, l'écart trop court, le prix de départ
nul et l'échantillon trop petit — **aucun ne couvre celui-ci**, qui n'est pas un
défaut de taille mais de composition.

Le témoin (jetons écartés) est la seule parade sérieuse, et c'est une raison de
plus de ne pas lire le taux du radar tout seul quand il tombera.

## La forme générale, qui dépasse le radar

**Quand la condition d'entrée dans une mesure est la survie de ce qu'on mesure,
la mesure ne peut que flatter.** Ce n'est pas une question de volume : mille
jetons jugés par le même mécanisme pencheraient autant que dix-sept. Ajouter des
tours ne corrige rien, parce que le biais est dans la porte, pas dans le compte.

Le geste : avant de croire un taux, demander **ce qui a dû tenir pour entrer
dans le calcul**, et compter ce qui en est sorti en silence. Ici, c'est la
colonne `indécidable` — la seule qu'on ne regarde jamais, parce qu'elle n'affiche
aucun chiffre.

## Un piège de lecture, dans le même tableau

La colonne « Note » du bulletin est `note_max`, la **meilleure note jamais vue**
pour ce jeton, pas celle du scan du jour. BNBO y figure à 99 alors qu'il était
retenu à 60 ; MOS à 83 alors qu'il sortait à 60. Les deux tableaux d'un même
rapport ne se contredisent pas — ils ne mesurent pas la même chose.
