# Une pile plafonnée rend une sonde de longueur aveugle

*10/09/2026 — Amorce, branchement de la détection de cadrage*

## Ce qui a été mesuré

Un test devait garantir qu'une écriture n'ajoute **rien** à la pile
d'annulation. Il mesurait la seule chose qui semblait évidente :

```js
const avant = useStudio.getState().past.length;
useStudio.getState().poserCadrage('a', CADRAGE);
assert.equal(useStudio.getState().past.length, avant);
```

Le défaut a été injecté pour de bon — l'écriture repassée par `mutate`, donc
traitée comme un geste de montage ordinaire. **Le test est resté vert.** Mesuré
hors suite, la pile passait pourtant bien de 1 à 2.

## Pourquoi

`mutate` empile avec `.slice(-HISTORY_LIMIT)`. La fonction `reset()` du fichier
de tests ne vide pas l'historique : après deux cent cinquante tests, la pile est
**saturée**. Pousser une entrée de plus en retire alors une par le bas, et la
longueur ne change pas d'un iota.

La sonde n'était pas trop laxiste, elle n'était pas mal réglée : elle mesurait
une grandeur qui, dans les conditions du test, **ne pouvait plus varier**. Vider
la pile au début du test la fait rougir immédiatement.

## La règle

**Une longueur bornée cesse d'être une mesure dès qu'on atteint sa borne.** Le
piège vaut pour tout ce qui se plafonne discrètement : une pile `slice(-N)`, un
tampon circulaire, une file à capacité fixe, un journal qui tourne, un cache
LRU. La grandeur continue d'exister, elle continue de se lire, et elle a cessé
de répondre.

Le geste qui l'attrape n'est pas de mesurer autrement — c'est de **ramener le
système loin de sa borne avant de mesurer**. Une ligne, ici : vider la pile.

## Ce que ça ajoute aux deux leçons voisines

C'est la troisième forme du même défaut en trois jours, et les trois se
ressemblent assez pour qu'on les confonde, alors que la parade diffère à chaque
fois :

| le vert venait de… | la parade |
| --- | --- |
| une couche qui repeint et remplit le trou (l'étalonnage sur la sonde d'image) | neutraliser la couche |
| un seuil trop large pour l'écart qu'on cherche (17 → 85 ms) | lire le nombre, pas la couleur |
| **une grandeur saturée à sa borne** (cette pile) | **éloigner de la borne avant de mesurer** |

Le point commun tient en une phrase : **on avait vérifié que la sonde était
juste, jamais qu'elle était encore capable de bouger.**
