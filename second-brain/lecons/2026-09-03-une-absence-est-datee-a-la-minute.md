# Une absence constatée est datée à la minute, pas acquise

**03/09/2026, 07 h 22 → 07 h 25.**

## Ce qui a été mesuré

Une session écrivait une compétence `site-web` et devait s'appuyer sur une
compétence `web-artisan`. Elle l'a cherchée : `ls .claude/skills/`, `find`,
`grep -rn "web-artisan"` sur tout le dépôt. **Zéro résultat.** Elle a donc écrit
en tête du fichier, et dans son message de commit : « il n'existe pas, vérifié
le 03/09/2026 ».

`git log` sur le dossier rend :

```
23e619d 03/09 07:25 Écrire la compétence web-artisan, et ranger les leçons une par fichier
```

**Trois minutes.** La recherche était exacte à la seconde où elle a tourné, et
fausse le temps d'écrire deux cents lignes. Aucune erreur de méthode : le
`grep` portait sur le bon motif, dans le bon dépôt, sur la bonne branche — une
branche qui, elle, avait dix minutes de retard sur `main`.

## Ce que ça coûte

Une affirmation d'inexistence est la seule dont la durée de validité est nulle
dans un dépôt à sessions parallèles. Une présence constatée reste vraie — un
fichier vu ne disparaît pas dans la minute. Une **absence**, elle, se dément à
chaque poussée de n'importe qui.

Et elle coûte cher parce qu'elle **autorise à écrire** : c'est sur la foi de
cette absence que la session a produit un doublon de 220 lignes, avec deux
descriptions qui répondaient à la même demande. Le §0 bis règle 4 dit qu'un
doublon arrête le geste ; encore faut-il le voir.

## La règle

**`git fetch` juste avant d'écrire, jamais seulement avant de chercher.** Le
`grep` qui autorise la création se refait sur `origin/main` frais, au moment de
la première écriture — pas au moment où la question s'est posée.

Et dans un message de commit, une inexistence se date à l'heure, pas au jour :
« absent de `origin/main` à 07 h 22 » se relit sans induire personne en erreur,
là où « il n'existe pas » devient un mensonge que la session suivante recopie.
