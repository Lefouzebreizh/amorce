# Une fusion sans conflit peut rendre un document qui se contredit

**03/09/2026 — `CLAUDE.md`, deux fois dans la même journée.**

## Ce qui a été mesuré

Reprendre `origin/main` dans une branche de compétence a produit, dans la fiche
`artisan-express/` :

```
  inventée. Se vérifie depuis son dossier.
  Ce que ce projet a appris sur les sites vitrine d'une page — ... dans `/site-web`.
  inventée. Se vérifie depuis son dossier. Ce qu'on vend **après** les 300 € —
  mise à jour annuelle, avis Google — est chiffré dans son `OPTIONS.md`.
```

**`inventée. Se vérifie depuis son dossier.` écrit deux fois**, une phrase
orpheline derrière, et **zéro marqueur de conflit**. `git merge` a rendu
`Merge made by the 'ort' strategy` sans un mot.

La cause est mécanique et vaut d'être sue : deux sessions avaient ajouté du
texte **à des endroits différents du même paragraphe**. Git considère alors
qu'il n'y a rien à arbitrer — il garde les deux ajouts et recoud. Chaque moitié
est le travail légitime de quelqu'un ; c'est leur somme qui ne veut rien dire.

Le même jour, une autre fusion sur ce fichier avait produit un paragraphe
orphelin et une règle inversée, également sans marqueur.

## Ce que ça coûte

Rien ne le signale. Le contrôle de cohérence passe au vert : il vérifie que le
dépôt dit vrai sur *lui-même* — les compétences citées existent, les projets
déclarés sont là — pas que les phrases s'enchaînent. Un dépôt peut donc être
cohérent au sens du vérificateur et illisible au sens du lecteur.

Et c'est la prose qui trinque, jamais le code : un doublon de deux lignes dans
un `.ts` casse la compilation, un doublon de deux phrases dans un `.md` se lit
six mois plus tard.

## La règle

**Relire ce que la fusion a produit, pas seulement constater qu'elle a réussi.**
Sur un fichier de texte partagé, `git diff HEAD~1` après le merge et lire le
paragraphe touché en entier — pas le diff, le paragraphe.

C'est le pendant exact du §8 : « une mesure disait vert et le fichier était
faux ». Ici la mesure est `git`, et elle ne mesure pas ce qu'on croit — elle
mesure l'absence de collision textuelle, jamais la cohérence du résultat.
