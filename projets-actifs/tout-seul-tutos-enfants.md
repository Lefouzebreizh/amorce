# Tout seul — les gestes qu'on apprend une fois

> **Hypothèses posées** : module de Look & Find, pas une application séparée —
> il réutilise la caméra et la voix déjà en place. Public visé : quatre à huit
> ans, **un enfant qui ne sait pas encore lire**. C'est cette hypothèse-là qui
> commande toute la conception.

## Pitch

L'enfant pointe l'appareil photo sur ses lacets, sa brosse à dents ou son
manteau. Il reçoit le tuto du geste, en quatre à sept étapes courtes, lues à
voix haute. **Le corpus est écrit à l'avance, jamais généré.**

## Objectif mesurable

**Sur les dix-sept gestes du corpus, un enfant de cinq ans en réussit au moins
douze sans qu'un adulte reformule une étape.** Et sur vingt objets hors corpus,
vingt refus explicites — jamais un geste approchant.

## Score de faisabilité — 8/10

| Critère | Note | Justification |
| --- | --- | --- |
| Temps / Effort | 8/10 | La caméra, la reconnaissance d'objet et la voix existent déjà dans Look & Find. Le travail neuf est le corpus et un aiguillage d'étiquette vers un geste. |
| Complexité technique | 8/10 | Aucune brique à inventer : une table, une normalisation d'étiquette, un refus. La difficulté n'est pas technique, elle est rédactionnelle. |
| Coût / Rentabilité | 9/10 | **Aucune dépendance externe.** Pas de clé, pas d'API, pas de quota — le contenu s'écrit ici. C'est la seule des trois idées du jour dans ce cas. |
| Alignement | 8/10 | Même caméra, même voix, même discipline de refus que le module Accord. Public différent de Look & Find, mais l'appareil et la maison sont les mêmes. |

**Verdict :** aucun critère ne coince, et le critère qui départage les trois
idées de la journée est le coût — celle-ci ne dépend de personne.

## La décision qui décide de tout : le corpus est fermé

L'idée est arrivée sous la forme « des lacets **et cetera** ». C'est ce
« et cetera » qu'il faut refuser, et c'est le seul point où j'ai dit non.

Périmètre ouvert veut dire un tuto **généré à la volée**, sur n'importe quel
objet, pour un enfant. Aujourd'hui les lacets ; demain « comment ouvrir cette
boîte », « comment brancher ça ». Trois raisons de fermer :

1. **Un geste physique improvisé peut blesser.** Le public n'a pas cinq ans
   d'expérience pour reconnaître un conseil absurde.
2. **Un enfant qui ne sait pas lire ne peut pas vérifier.** Il n'ira pas
   recouper ailleurs. La réponse fausse est reçue comme vraie.
3. Un corpus fermé **répond instantanément et fonctionne hors ligne** — sans
   réseau, sans attente, sans facture.

Ce que la fermeture coûte : dix-sept gestes, pas mille. Ce qu'elle rapporte :
aucune surveillance adulte nécessaire.

## Le corollaire, et c'est le cœur du module

Quand l'objet reconnu n'est pas au corpus, l'application **refuse et le dit** —
« je ne connais pas encore ce geste, montre-moi tes chaussures ou ta brosse à
dents » — plutôt que de proposer le geste le plus proche.

C'est la discipline d'Accord, transposée : mieux vaut une porte fermée qu'une
réponse fausse. Elle se code **avant** le corpus, pas après.

## Pourquoi la caméra n'est pas un gadget ici

L'objection évidente : dix-sept gestes tiennent dans une liste, à quoi bon
photographier ?

Parce que **l'utilisateur ne sait pas lire.** Une liste de dix-sept intitulés
lui est inaccessible ; pointer l'appareil sur l'objet qu'il a dans les mains ne
l'est pas. La caméra n'est pas un raccourci vers le menu, elle est la seule
interface qu'il maîtrise. C'est ce qui fait la valeur du produit, et c'est aussi
ce qui interdit de le remplacer par une grille d'icônes.

## Ce que la version un ne fait pas

- Pas de suivi de progression, pas de récompense, pas de compte. Rien qui
  demande une donnée sur un enfant.
- Pas de vidéo : des phrases et une illustration par étape. Une vidéo pèse,
  demande du réseau, et se regarde passivement.
- Pas d'ajout de geste par l'utilisateur en version un — un corpus qu'on peut
  étendre depuis l'application n'est plus un corpus relu.

## Prochain pas

Couche domaine et corpus écrits et testés (`look_and_find/lib/features/tout_seul/`),
puis l'écran et la lecture à voix haute.
