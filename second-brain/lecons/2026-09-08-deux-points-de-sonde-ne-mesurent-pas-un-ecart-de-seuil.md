# Deux points de sonde ne mesurent pas un écart entre deux seuils

*08/09/2026 — trouvé en gardant deux modules d'Amorce qui doivent basculer sur
la même durée. Vaut partout où deux endroits décident sur une même frontière.*

## Le problème

Deux modules lisent le même seuil. On les ramène à une constante unique, et il
faut un test qui rougisse le jour où quelqu'un en réécrit une copie.

## Trois versions du test, et les deux premières étaient vertes à tort

La vérification n'a pas été raisonnée, elle a été faite : **on réintroduit la
divergence** — 3,8 d'un côté contre 3,5 de l'autre — et on regarde la suite.

| version | sur la divergence injectée |
| --- | --- |
| comparer les deux constantes (`assert.equal(A, B)`) | **verte** |
| sonder « à la borne » puis « au-delà » | **verte** |
| balayer l'intervalle par pas de 0,1 | **rouge**, enfin |

La première échoue pour une raison évidente une fois dite : deux littéraux égaux
**sont** égaux. Elle ne teste rien d'autre que l'arithmétique.

La seconde est plus insidieuse, et c'est elle qui vaut le fichier. Sonder à
3,5 puis à 4,0 encadre les **deux** seuils de la même façon : à 3,5 aucun des
deux ne s'allume, à 4,0 les deux s'allument. Le désaccord n'existe qu'**entre**
3,5 et 3,8, précisément là où aucun point de sonde n'était posé.

## La règle

**Un écart entre deux frontières ne se voit qu'à l'intérieur de l'écart.** Deux
points choisis de part et d'autre ne peuvent pas le voir, quels qu'ils soient,
parce qu'on ne sait pas où est l'autre frontière — c'est ce qu'on cherche.

Le test qui tient balaie l'intervalle et affirme que les deux décisions
**coïncident partout**, avec un pas plus fin que le plus petit écart qu'on
accepte de laisser passer. Il coûte quelques dizaines d'itérations, c'est-à-dire
rien.

## Le geste qui a tranché, et il vaut plus que la règle

Aucune des trois versions n'a été jugée sur sa lecture. **On a cassé le code
exprès et on a regardé la suite.** Les deux premières auraient été fusionnées
vertes, en croyant garder quelque chose.

Un test de non-régression qu'on n'a jamais vu rougir sur la régression qu'il
prétend garder n'est pas un test : c'est une phrase rassurante que l'intégration
continue exécute tous les jours.
