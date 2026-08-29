# Ce que le serveur de licence doit faire

Écrit depuis le client, qui existe déjà et le tient : `client.ts` pour les
requêtes, `types.ts` pour les formes, `etat.ts` pour la condition d'affichage.
Rien ici n'est une intention — c'est ce que le code appelle aujourd'hui.

L'hébergeur n'est pas décidé, et ce document n'en suppose aucun. Deux routes,
un stockage minuscule, aucune dépendance à Amorce.

## Deux routes, et pas une de plus

### `GET /etat`

Rend l'abonnement de la personne identifiée par le témoin de session.

```json
{ "statut": "libre", "finLe": 1767225600000 }
```

- `statut` vaut `libre` ou `pro`. Toute autre valeur est traitée comme
  inconnue par le client, donc comme l'offre libre.
- `finLe` est facultatif, en millisecondes. Il sert à **l'affichage**, jamais à
  décider : une date lue côté client se modifie, et c'est au serveur de dire si
  l'abonnement court encore.
- Sans session valide : `{"statut":"libre"}` avec un code 200. Pas de 401 — le
  studio n'a pas à savoir qu'on ne le connaît pas, il a à savoir quoi proposer.

Le client abandonne au bout de **4 secondes** et retombe sur l'offre libre.
Un serveur lent ne doit jamais suspendre un montage.

### Le webhook Stripe

Reçoit `checkout.session.completed`, `customer.subscription.updated` et
`customer.subscription.deleted`, et met à jour le statut.

**La signature Stripe se vérifie, sans exception.** Une route de webhook non
vérifiée accorde un abonnement à quiconque connaît son adresse.

## Ce que le serveur ne doit jamais recevoir

Le client ne l'envoie pas, et le serveur ne doit pas l'accepter s'il arrivait :
nom de fichier, durée, nombre de plans, compte d'exports, contenu d'un projet.
La requête d'état n'a **pas de corps**.

Ce n'est pas de la prudence : c'est la promesse fondatrice d'Amorce, et le
serveur de licence en est l'exception unique et bornée — `CLAUDE.md` §4.

## Ce qu'on ne compte pas, et pourquoi

Aucune limite de quantité — ni exports par jour, ni minutes, ni projets. Le
montage tourne dans le navigateur : un compteur local s'efface, et un compteur
distant demanderait de savoir **ce que la personne fabrique et quand**, ce que
ce dépôt s'interdit. Ce que l'offre borne vit dans l'image produite : la
signature et la définition.

Le serveur n'a donc **aucun événement d'usage à recevoir**. C'est ce qui le
rend minuscule.

## Le stockage

Une table, trois colonnes utiles : identifiant de la personne, identifiant
client Stripe, fin d'abonnement. Rien d'autre n'est nécessaire pour répondre à
`/etat`.

## L'ordre dans lequel ça s'allume

1. Le serveur répond à `/etat` — même en rendant toujours `libre`.
2. `NEXT_PUBLIC_LICENCE_URL` est renseignée. **La signature apparaît alors
   d'elle-même** sur l'offre libre : le studio ne l'affiche pas tant qu'il
   n'existe pas d'endroit où payer.
3. Le webhook Stripe est branché, et un paiement fait passer un compte en
   `pro`. La signature disparaît pour lui.

Chaque étape se vérifie seule, et aucune n'exige la suivante.
