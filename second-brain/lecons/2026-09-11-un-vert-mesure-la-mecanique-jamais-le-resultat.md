# Un vert mesure la mécanique, jamais le résultat perçu

*11/09/2026 — Amorce, mais la mécanique vaut pour tout produit gardé par des tests.*

## Ce qui a été mesuré

Le studio d'Amorce sortait **149 contrôles verts** pendant que son propriétaire
disait, à répétition, que le montage ne convenait pas. Les trois défauts qu'il
a fini par nommer étaient tous dans le code, et aucun contrôle ne les voyait :

| Défaut vécu | Ce que le contrôle vert mesurait |
| --- | --- |
| **12,8 %** de couverture texte sur une vidéo de trente secondes — le produit exige 55 % dans sa propre note | `scripts/verify.mjs:678` : le texte est **visible**. Présence, pas couverture. |
| Bruitages plaqués, sans rapport avec le contenu | `scripts/verify.mjs:1313` : le curseur « Bruitages » existe et sa valeur bouge |
| Cinquante coupes sur cinquante secondes, sans signal | `MIN_CLIP_DURATION = 0,3 s` : un plan n'est jamais invisible, rien d'autre |

Les trois causes, localisées : `src/lib/autoEdit.ts:188` pose **un seul**
sous-titre en dur quelle que soit la durée ; `src/lib/autoEdit.ts:245` choisit
le bruitage par un compteur qui tourne — `RACCORD_CYCLE[(index - 1) % 6]`, donc
purement positionnel, rien ne regarde l'image ni le son du rush ;
`src/lib/store.ts:677` ne connaît que le plancher de 0,3 s.

## La cause commune, et c'est elle qui vaut

**Le studio sait juger, et il ne juge jamais au moment du geste.**
`src/lib/analysis.ts` porte les bons seuils — plan moyen entre 1,1 et 2,8 s,
texte entre 55 et 95 % — mais ni le code qui produit ni le code qui laisse
produire ne les consulte. Ils ne servent qu'à noter **après coup**, dans un
panneau qu'il faut aller ouvrir.

Un produit peut donc porter la bonne mesure et le mauvais résultat en même
temps, sans qu'aucun test ne rougisse.

## Ce que ça change

Une suite de contrôles a besoin de **deux familles**, et n'en avait qu'une :

1. **La mécanique** — le bouton existe, l'export sort, rien ne plante. C'est ce
   que les 149 mesuraient, et ils le mesuraient bien.
2. **Le résultat perçu** — la couverture réelle sur la durée, la pertinence et
   pas seulement la présence, le garde-fou assorti d'un signal explicite. Elle
   n'existait pas.

Le seuil de la seconde famille ne s'invente pas : il est déjà écrit dans le
produit, dans sa propre notation. Ce qui manque n'est pas un chiffre, c'est
qu'on le consulte au moment où le geste se fait.

## Le piège de rédaction, qui est le plus coûteux

Le vert le plus trompeur des trois est celui du texte : il passe **précisément
parce qu'il y a un texte**. Un contrôle qui teste la présence d'une chose ne
dira jamais qu'il en fallait dix. Avant de croire un vert, dire en une phrase
ce qu'il mesure — c'est déjà la règle du §8 bis, et elle se vérifie ici une
fois de plus.

## Où c'est écrit

`CLAUDE.md` §1 bis, « La vision humaine prime sur le vert », posée par le
propriétaire le jour même.
