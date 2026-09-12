# Une PR devenue redondante par fusion directe d'une branche sœur : le diff à trois points ne le montre pas

**Ce qu'on a mesuré et que personne n'avait mesuré.** Volet A (PR #921) et
volet B (PR #924) partageaient un historique : #924 avait été branchée depuis
la branche de #921 (déjà 3 commits), justement pour que ses propres ajouts au
README/CLAUDE.md puissent citer le texte de #921 sans attendre sa fusion —
`second-brain/lecons/2026-09-10-post-mortem-...` et la convention Git du dépôt
recommandent ce geste sans dire ce qu'il coûte ensuite. Erwann a fusionné #924
directement dans `main` (fusion normale, pas de rebase de #921 dessus). #921
s'est aussitôt retrouvée `mergeable_state: dirty`.

Premier réflexe — mesurer l'écart avec `git diff origin/main...FETCH_HEAD`
(trois points) — a rendu le diff **complet** des 605 lignes de #921, comme si
rien n'était fusionné. C'était faux : `git diff origin/main FETCH_HEAD` (deux
points, sans les trois) a montré que `main` est un **sur-ensemble strict** du
contenu de #921 (1123 lignes que la branche de #921 n'a pas, zéro perte dans
l'autre sens). Le diff à trois points compare **la branche à son propre point
de divergence** (`merge-base`) — il dit ce que #921 a fait depuis qu'elle a
divergé de `main`, jamais ce que `main` a acquis depuis par un autre chemin
(ici : les mêmes commits, rejoués sous d'autres hachages via le rebase de
#924). Sur une branche fusionnée en aval par sa sœur plutôt que par
elle-même, le triple-point ment par omission : il continue d'annoncer un
travail à faire qui est déjà fait ailleurs.

**Ce qui rend une phrase de ce dépôt incomplète.** `CLAUDE.md`, section Git,
dit « une pull request fusionnée est finie » et prescrit de repartir de `main`
à jour. Ça couvre le cas d'une branche fusionnée **elle-même** ; ça ne dit
rien du cas d'une branche sœur, jamais fusionnée en tant que telle, devenue
redondante par la fusion d'une autre qui l'englobait. Le signal `dirty` de
GitHub ne distingue pas non plus les deux cas : un vrai conflit de contenu et
une PR devenue un sous-ensemble strict de `main` rendent le même statut.

**La parade, à généraliser** : avant de tenter de résoudre un conflit sur une
PR qui partage un historique avec une autre déjà fusionnée, vérifier d'abord
avec un diff à **deux points** (jamais trois) si son contenu est déjà entré
dans `main` par l'autre chemin. Si oui, fermer sans fusionner et le dire dans
un commentaire plutôt que rebaser pour redécouvrir un conflit vide.
