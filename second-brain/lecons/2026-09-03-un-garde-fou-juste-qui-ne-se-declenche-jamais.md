# Un garde-fou juste qui ne se déclenche jamais

**03/09/2026** — trouvé en mesurant le nommage des couleurs de `look_and_find`
sur quatre-vingt-six cadres réels.

## Ce qui a été mesuré

`NameColor` porte une règle de prudence, écrite exprès et bien écrite : devant
une teinte chaude peu saturée, elle répond « beige, ou blanc **sous lumière
chaude** » au lieu d'affirmer. Elle existe parce que la fiche du projet dit que
la lumière est « le seul vrai problème du sujet », et que la personne visée ne
peut pas vérifier ce qu'on lui annonce.

Sur douze cadres réels où l'application s'engage sur un nom unique, **six sont
faux** — de la pierre, du beige et du bois sous ampoule, annoncés « orange » ou
« marron ». La règle de prudence n'a parlé sur aucun.

Elle demande trois choses réunies : teinte entre 20 et 65°, saturation sous
0,35, **et clarté au-dessus de 0,62**. Les six remplissent les deux premières et
échouent toutes sur la troisième — elles valent 0,34 à 0,61. **L'une la manque
d'un centième.**

## La leçon

**Un garde-fou dont les conditions se cumulent n'est actif que sur son terme le
plus étroit**, et rien ne le signale. Celui-ci était juste sur la teinte, juste
sur la saturation, et muet en pratique : sa troisième condition l'éteignait
exactement là où l'ambiguïté est la pire — un intérieur chaud et **sombre**,
c'est-à-dire le cas courant.

Ce qui rend le défaut coûteux, c'est qu'il est **invisible des deux côtés** :

- les tests passent, puisqu'ils éprouvent la règle sur des cas qui la
  déclenchent ;
- le code se relit bien, puisque chaque condition est défendable prise seule ;
- et l'application ne se tait jamais : elle répond, avec aplomb, autre chose.

Une règle absente se voit. Une règle présente qui ne se déclenche pas ressemble
à une règle qui marche.

## Le geste qui l'attrape

**Compter combien de fois un garde-fou s'est déclenché sur un corpus réel**, et
traiter zéro comme une alerte plutôt que comme un succès. C'est la seule mesure
qui distingue « rien à signaler » de « je ne signale rien ».

Corollaire pour l'écriture : quand une prudence cumule plusieurs conditions,
noter à côté **laquelle est la plus restrictive**. C'est elle qui décide de la
fréquence, et c'est presque toujours celle qu'on n'a pas mesurée.

## Ce qui n'a pas été fait, et pourquoi c'est la bonne fin

Le seuil n'a pas été descendu. À 0,30, un vrai marron — du bois, du cuir —
s'entendrait répondre « ou blanc sous lumière chaude », ce qui est faux et
bavard. Un beige sombre sous ampoule et un brun franc **rendent la même
moyenne** : aucune règle sur trois nombres ne les sépare.

Trouver pourquoi un garde-fou est muet ne dit donc pas comment le réveiller. Les
deux questions sont distinctes, et confondre l'une avec l'autre fait élargir une
règle jusqu'à ce qu'elle crie sur tout — ce qui la rend muette d'une seconde
façon, celle qu'on n'écoute plus.
