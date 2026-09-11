# Un rouge peut nommer le mauvais défaut, et cacher le vrai à côté

*11/09/2026 — Amorce, en corrigeant le montage express. Ce dépôt a beaucoup
écrit sur les verts qui mentent ; celui-ci porte sur un rouge qui ment.*

## Ce qui a été mesuré

Après avoir branché une trame de sous-titres sur le montage automatique, le
parcours Chromium a rendu :

```
ECHEC | L’étalonnage agit sur l’image — chroma 39.2 en naturel → 9.0 en noir et blanc
```

Lu tel quel, ce rouge dit : **le noir et blanc ne désature plus**. C'est faux.
La capture que le même parcours venait d'enregistrer le montre en une seconde :
l'image est parfaitement grise, et un texte **rouge vif** — `QUEL [ROYAUME]
TOMBE ENSUITE ?` — occupe le tiers du cadre. Les 9,0 de chroma résiduel sont
entièrement ce texte.

Le contrôle mesure la moyenne des écarts entre canaux sur **tout** le canevas.
Or l'invariant n° 7 du projet trace les sous-titres **après** l'étalonnage, à
dessein : un texte coloré survit donc au noir et blanc, par construction. Le
contrôle était juste tant qu'aucun texte coloré n'existait, et il n'en existait
pas — le montage automatique n'en posait qu'un, blanc.

## Le vrai défaut, que le rouge ne nommait pas

Le montage automatique s'était mis à **imposer un genre**. Branché sur le
premier jeu de la liste — une bande-annonce — il posait ce texte rouge et son
« QUEL [ROYAUME] TOMBE ENSUITE ? » sur quatre rushes quelconques.

Aucun des 343 tests unitaires ne l'a vu : ils comptaient des sous-titres, des
instants, une couverture. Tous verts, tous justes, tous à côté. Le seul signal
existant était ce rouge, et il désignait l'étalonnage.

## Le geste qui a tranché, et il coûte une seconde

**Ouvrir la capture.** Le parcours en enregistre une à chaque étape, et
personne ne les regarde tant que tout est vert. Devant un rouge dont la cause
n'est pas évidente, elle passe avant toute hypothèse sur le code : ici elle
distinguait « la fonction est cassée » de « la fonction marche et autre chose
est entré dans le cadre ».

La règle générale, et elle est symétrique de celle que le dépôt applique déjà
aux verts : **avant de croire un rouge, dire en une phrase ce qu'il mesure** —
sur quel objet, à quelle étape, avec quoi d'autre dans le champ. Un rouge dont
on corrige la cause annoncée sans vérifier laisse le vrai défaut intact, et
l'aura en plus rendu invisible, puisque le signal s'éteint.

## Le second défaut, né de la correction elle-même

Deux modules peuvent être justes séparément et se contredire ensemble. Mesuré
le même jour, après avoir empêché le montage automatique de plaquer des
bruitages sur des rushes qui portent déjà leur son :

| rushes | bruitages posés | note « son » | ce que le guide répondait |
| --- | --- | --- | --- |
| muets | 9 | 60 % | « 3 textes du gabarit restent à remplir » |
| qui portent leur son | **0** | **0 %** | **« Ponctue tes coupes »** |

Le produit retirait les bruitages d'un côté et les réclamait de l'autre. Aucun
test ne pouvait l'attraper : chaque module faisait exactement ce qu'il annonce.

Ce qui l'a trouvé est une mesure de dix lignes, écrite **après** la correction
et avant de la livrer : monter, analyser, et lire la phrase que le guide rend.
**Quand un correctif change ce qu'un produit fabrique, mesurer ce que le produit
dit ensuite de ce qu'il vient de fabriquer.**

## Ce qui rend une phrase de ce dépôt incomplète

`CLAUDE.md` §8 dit « avant de croire un vert, dire en une phrase ce qu'il
mesure ». La même phrase manquait pour les rouges, et c'est le cas le plus
coûteux des deux : un vert qu'on ne croit pas fait perdre une vérification, un
rouge qu'on croit fait corriger le mauvais fichier.
