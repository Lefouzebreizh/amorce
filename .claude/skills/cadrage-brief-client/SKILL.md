---
name: cadrage-brief-client
description: Transformer le brief d'un client en cahier des charges exploitable — questionnaire en cinq points (objectif, utilisateurs, fonctionnalités, données, design), traduction des réponses en schéma de données, découpage en lots livrables et estimation. S'arrête volontairement avant le code. À utiliser dès qu'un nouveau projet client arrive, qu'on parle de brief, de devis, de cadrage, de « voilà ce que je veux », d'un client qui décrit son besoin en vrac, ou avant d'écrire la moindre ligne pour un projet dont le périmètre n'est pas encore écrit. Enchaîne ensuite sur `stack-agence-supabase` pour la réalisation.
---

# Cadrer avant de coder

Un projet livré vite se joue au cadrage, pas à la vitesse de frappe. Le coût
d'une table oubliée se paie au moment où trente écrans en dépendent ; le coût
d'une question posée se paie en dix minutes.

Cette compétence produit **un document**, pas du code. Elle s'arrête quand le
schéma de données est stable et le périmètre écrit. La réalisation prend le
relais avec `stack-agence-supabase`.

## Le questionnaire

Le gabarit à envoyer est dans `assets/questionnaire.md`. Cinq questions :
objectif, utilisateurs, fonctionnalités clés, données, design.

Il est court exprès. Un client ne remplit pas un formulaire de quarante
champs — il répond à cinq questions ou il ne répond pas du tout. Ce qui manque
se récupère en relance ciblée, une fois qu'on a lu ses réponses et qu'on sait
quoi demander.

## Lire les réponses

Un client décrit presque toujours **une solution**, rarement son problème.
« Je veux un tableau Excel partagé en ligne » veut dire « trois personnes se
marchent dessus sur le même fichier ». Le problème dicte le schéma ; la
solution qu'il imagine ne dicte qu'un écran.

Reformule donc l'objectif en une phrase de la forme *« Aujourd'hui [qui] fait
[quoi] et ça coûte [quoi] ; l'application supprime [ce coût] »*, et fais-la
valider. Si le client corrige la phrase, tu viens d'éviter une réécriture.

### Ce qui se cache derrière chaque réponse

| Le client dit | Ce qu'il faut en tirer |
| --- | --- |
| « des employés et des admins » | Une colonne de rôle, et **une politique de sécurité par rôle**. Combien de rôles exactement, et qui a le droit de nommer un admin ? |
| « uploader une facture » | Un bucket de stockage, une taille maximale, une durée de conservation, et la question RGPD si la facture porte des données personnelles. |
| « recevoir une alerte » | Par quel canal (courriel, notification, SMS), déclenchée par quoi, et **qui la reçoit** ? Une alerte sans destinataire nommé n'est pas une fonctionnalité. |
| « voir un graphique de ventes » | Une agrégation. Sur quelle période, remise à zéro quand, et calculée à la volée ou stockée ? |
| « un historique » | Une table d'événements immuable, pas une colonne `updated_at`. Ce sont deux besoins différents et le client les confond toujours. |
| « comme le site X » | Regarde le site. Note ce qui s'y trouve **et que le client n'a pas listé** : il l'a intégré sans le voir, et il le réclamera à la recette. |

### Les trois questions qu'un client ne pense jamais à traiter

À poser systématiquement, parce que leur réponse change le schéma :

1. **Qui voit quoi.** « Chacun ses données » est la réponse par défaut, et elle
   est fausse dès qu'il y a un manager. Fais dessiner la matrice : pour chaque
   table, qui lit, qui écrit, qui supprime.
2. **Ce qui arrive aux données quand quelqu'un part.** Suppression en cascade,
   anonymisation, ou transfert au responsable ? Cela décide les `ON DELETE` et
   se change très mal après coup.
3. **Le volume à un an.** Cent lignes ou dix millions ne donnent pas la même
   application. Une seule question, et elle décide les index et la pagination.

## Du brief au schéma

Chaque nom propre du brief qui a un cycle de vie devient une table. Chaque
« et son / et ses » devient une clé étrangère. Chaque « en attente / validé /
refusé » devient une contrainte `CHECK` sur une colonne de statut, jamais un
booléen — un booléen ne sait pas grandir en troisième état, et il y a toujours
un troisième état.

Rends le schéma **avant** de rendre les écrans, et fais-le relire par le
client en français, ligne à ligne :

> Un **projet** appartient à un **utilisateur**. Il porte un titre, une
> description facultative, un statut parmi *brouillon*, *en cours* et
> *terminé*, et un montant estimé. Supprimer l'utilisateur supprime ses
> projets.

Cette relecture attrape les erreurs que trois semaines d'interface n'auraient
pas révélées. Un client ne sait pas lire un diagramme ; il sait très bien dire
« non, un projet peut avoir plusieurs intervenants ».

## Découper en lots

Un lot est livrable et démontrable seul. Trois lots typiques :

| Lot | Contenu | Livrable |
| --- | --- | --- |
| 1 — Socle | Schéma, sécurité, inscription, connexion, profil | Le client se connecte et voit son nom. |
| 2 — Métier | Les deux ou trois actions qui justifient le projet | Le client fait son travail dans l'application. |
| 3 — Confort | Recherche, exports, notifications, tableau de bord | Le client arrête d'ouvrir son tableur. |

Le lot 1 n'est jamais négociable : la sécurité se pose au début ou elle se
repose entièrement. Mais il est **déjà écrit** — c'est le socle `agence/`, qui
porte l'authentification, les rôles et la RLS durcie. L'estimer comme du
développement neuf reviendrait à facturer quatre jours pour un `git clone` ;
compter le temps réel, celui d'adapter le schéma au domaine du client.

Le lot 3 se négocie toujours — c'est là que se trouve la variable d'ajustement
quand le budget est tenu.

Ce qui n'entre dans aucun lot s'écrit dans une section **hors périmètre**,
nommément. Un besoin non listé est un besoin qui sera réclamé gratuitement.

## Le document rendu

```
# Cadrage — <client>

## Objectif        une phrase, validée par le client
## Utilisateurs    les rôles, et la matrice qui lit / écrit / supprime
## Périmètre       les fonctionnalités par lot
## Hors périmètre  ce qui n'est pas fait, nommément
## Données         les tables en français, puis le schéma
## Contraintes     RGPD, volume à un an, navigateurs, mobile
## Estimation      par lot, avec ce qui la ferait bouger
```

Une estimation sans la liste de ce qui la ferait bouger n'est pas une
estimation, c'est une promesse.

## S'arrêter ici

Le cadrage se termine sur un document validé, pas sur un début
d'implémentation. Tant qu'une des trois questions ci-dessus est sans réponse,
le schéma est provisoire — le dire au client plutôt que de choisir à sa place
et découvrir à la recette qu'on a choisi de travers.

Quand le document est validé, passer à `stack-agence-supabase`.
