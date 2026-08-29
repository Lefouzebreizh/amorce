# Ce que le serveur de licence doit faire

Écrit depuis le client, qui existe déjà et le tient : `client.ts` pour les
requêtes, `types.ts` pour les formes, `etat.ts` pour la condition d'affichage.
Rien ici n'est une intention — c'est ce que le code appelle aujourd'hui.

L'hébergeur n'est pas décidé, et ce document n'en suppose aucun. Deux routes,
un stockage minuscule, aucune dépendance à Amorce.

## Deux routes, et pas une de plus

### `GET /etat`

Rend le statut de la clé passée en `Authorization: Bearer <clé>`.

**Pas de comptes.** Amorce se vend une fois : pas de mot de passe à perdre, pas
de courriel à confirmer, pas de session à renouveler. Un achat rend une clé, on
la colle dans le studio, et c'est tout. Le serveur ne sait donc pas **qui** vous
êtes — seulement **qu'une clé a été payée**. Moins de données chez nous, moins à
protéger, et plus proche de la promesse d'Amorce qu'un système de comptes.

```json
{ "statut": "libre" }
```

- `statut` vaut `libre` ou `pro`. Toute autre valeur est traitée comme
  inconnue par le client, donc comme l'offre libre.
- **Un statut, et rien d'autre.** Amorce se vend une fois : pas de date de fin,
  pas de renouvellement, rien à faire expirer. Tout champ supplémentaire est
  ignoré par le client, jamais recopié.
- Clé absente, inconnue ou remboursée : `{"statut":"libre"}` avec un code 200.
  Pas de 401 — le studio n'a pas à savoir qu'on ne le connaît pas, il a à savoir
  quoi proposer.
- Le client n'appelle même pas quand il n'a pas de clé : la requête partirait
  pour se faire refuser, et apprendrait au serveur qu'un studio tourne là.
- La comparaison de clé se fait **à temps constant**. Une comparaison naïve
  laisse mesurer les premiers caractères justes, et une clé se devine alors
  caractère par caractère.

Le client abandonne au bout de **4 secondes** et retombe sur l'offre libre.
Un serveur lent ne doit jamais suspendre un montage.

### Le webhook Stripe

**Un seul événement compte : `checkout.session.completed`.** Il fait passer le
compte en `pro`, définitivement.

Pas d'événements d'abonnement — il n'y a pas d'abonnement. Le seul retour en
arrière est `charge.refunded` (ou `charge.dispute.created`), qui remet le compte
en `libre` : un remboursement rend la licence, c'est la contrepartie honnête.

**La signature Stripe se vérifie, sans exception.** Une route de webhook non
vérifiée accorde la licence à quiconque connaît son adresse.

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

## Le prix

**49 €, une fois, définitivement.** Pas d'abonnement, et ce n'est pas un choix
de confort : la page de vente d'`artisan-express` attaque frontalement le
prélèvement mensuel — « 299 € une fois. Rien le mois suivant. » Vendre Amorce
autrement contredirait ce que ce dépôt dit déjà à son public.

Le chiffre vient de `montage-titan`, qui vend **un** montage 49 €. L'argument
tient en une phrase : *un montage fait pour toi coûte 49 € ; Amorce coûte 49 €
et tu en fais autant que tu veux.*

Et la licence perpétuelle n'est pas une dette : le studio tourne entièrement
dans le navigateur, donc un client ne coûte **rien** après l'achat — ni
stockage, ni calcul, ni bande passante. Seule la vérification de licence tourne,
et elle est gratuite à cette échelle. C'est l'architecture qui rend l'offre
possible, pas de la générosité.

## Le stockage

Une table, deux colonnes utiles : **l'empreinte** de la clé et le fait qu'elle a
été payée. L'identifiant de paiement Stripe s'y ajoute pour retrouver une
transaction, rien de plus. Aucune date : il n'y en a pas.

L'empreinte et non la clé : une base qui fuite ne doit pas livrer des licences
utilisables. C'est le même raisonnement que pour un mot de passe, et il coûte
une ligne.

## L'ordre dans lequel ça s'allume

1. Le serveur répond à `/etat` — même en rendant toujours `libre`.
2. `NEXT_PUBLIC_LICENCE_URL` est renseignée. **La signature apparaît alors
   d'elle-même** sur l'offre libre : le studio ne l'affiche pas tant qu'il
   n'existe pas d'endroit où payer.
3. Le webhook Stripe est branché, et un paiement de 49 € fait passer un compte
   en `pro`. La signature disparaît pour lui, définitivement.

Chaque étape se vérifie seule, et aucune n'exige la suivante.
