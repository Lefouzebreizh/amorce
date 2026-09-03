# Une leçon, un fichier

`../lecons.md` a grossi jusqu'à devenir le fichier le plus disputé du dépôt.
Plusieurs sessions travaillent en parallèle ; elles écrivent toutes leur leçon
au même endroit, et **au même endroit du fichier** — à la fin. Git ne sait pas
fusionner deux ajouts à la même ligne : il rend un conflit, à chaque fois.

Mesuré : **une seule nuit de retard a produit trois conflits sur le même
fichier**, chacun résolu à la main. Le coût n'est pas la résolution, c'est ce
qu'elle fait perdre — une session pressée garde sa version et écrase la leçon
de l'autre sans la lire.

## La règle

**Une leçon nouvelle s'écrit ici, dans son propre fichier**, nommé
`AAAA-MM-JJ-sujet-en-minuscules.md`. Deux sessions qui écrivent le même jour
créent deux fichiers différents : il n'y a plus rien à fusionner.

```
second-brain/lecons/2026-09-03-le-rem-vaut-16-px.md
second-brain/lecons/2026-09-03-une-adresse-dans-un-markdown.md
```

`../lecons.md` **n'est pas supprimé** et ne le sera pas : il porte des mois de
leçons, et les renuméroter en fichiers séparés casserait tous les renvois qui
le citent. Il devient l'archive ; ce dossier reçoit la suite.

## Ce qu'un fichier contient

Le même contenu qu'avant, et rien de plus — le §3 de `CLAUDE.md` ne change pas :

1. **ce qu'on a mesuré** et que personne n'avait mesuré, avec le nombre ;
2. **ce qui a coûté un aller-retour**, avec sa cause ;
3. **ce qui rend une phrase du dépôt fausse**, et où elle est écrite.

Ce qui ne s'y écrit pas : le récit de la séance, ce que le dépôt dit déjà, et
une leçon qu'on n'a pas mesurée.
