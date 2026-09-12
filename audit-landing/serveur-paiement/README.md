# serveur-paiement — brancher Stripe sur « Audit de page de vente en 24h »

Deux routes, zéro dépendance d'exécution — même mesure que `licence-serveur/`,
dont il reprend la vérification de signature Stripe (`src/signature.ts`,
copie assumée, voir son en-tête) :

- **`POST /creer-session`** — reçoit `{ url }`, crée une session Stripe
  Checkout (mode paiement unique) pour le prix configuré, pose l'URL du
  client en métadonnée (`url_a_auditer`) et rend uniquement une adresse HTTPS
  de `checkout.stripe.com`.
- **`POST /webhook`** — vérifie la signature Stripe, et sur
  `checkout.session.completed`, relit l'URL en métadonnée et déclenche
  `.github/workflows/audit-landing-lancer-audit.yml` via
  `repository_dispatch` (événement `nouvel-audit-paye`).

## Le prix n'est pas décidé, et c'est assumé

`idPrixStripe` est **vide par défaut** — même décision que `TARIFS` dans
`generation-serveur/` et `PACKS` dans `comptes-serveur/` : ce n'est pas à
cette session d'inventer ce que vaut l'audit. Tant qu'il est vide,
`/creer-session` refuse (503) plutôt que de créer une session à un prix
inventé. **Ce qui manque avant tout déploiement réel** :

1. Créer le produit et son prix dans le tableau de bord Stripe (test, puis
   live une fois validé), et renseigner `idPrixStripe` avec l'ID du prix
   (`price_...`).
2. Le secret du webhook Stripe (`whsec_...`), obtenu en créant l'endpoint
   dans le tableau de bord Stripe une fois ce serveur déployé.
3. Une clé d'analyse disponible sur le processus opérateur, pour que
   `audit-landing-lancer-audit.yml` puisse appeler `analyser_captures.py`.
4. Le déploiement lui-même (Cloudflare Worker, comme `licence-serveur/`) —
   **pas fait depuis cette session**, et volontairement : c'est un geste
   d'infrastructure sur un compte auquel cette session n'a pas la main, et
   toucher aux paiements est une zone sensible du dépôt (`CLAUDE.md`,
   section Git) qui attend l'accord du propriétaire même une fois vert.

## Ce qui est vérifié, et comment

**Le connecteur Stripe de cette session a servi à trouver la forme réelle de
l'appel** — `stripe_implementation_planner` a confirmé Stripe Checkout hébergé
comme bon chemin pour ce cas (paiement unique, redirection, pas
d'abonnement), et `search_stripe_documentation` a donné la forme exacte du
corps de `POST /v1/checkout/sessions` (`mode`, `line_items[0][price]`,
`line_items[0][quantity]`, `success_url`, métadonnées) — vérifiée contre la
documentation réelle, pas de mémoire, comme le demande `/api-tierce-verifiee`.

**La création réelle d'une session n'a en revanche pas pu être exercée** : la
clé Stripe connectée à cette session (compte de test lié à
`artisan-express-ashy.vercel.app`) n'a pas la permission d'appeler
`PostCheckoutSessions` — `stripe_api_details` l'a confirmé en retour d'erreur
explicite, pas en silence. Ce qui est vérifié à la place, en tests hors ligne
(`npm test`, dix cas, aucun réseau) :

- le veto sur le prix absent, avant toute autre vérification ;
- la validation de l'URL envoyée par le client ;
- la forme exacte de la requête construite pour Stripe (corps
  form-urlencodé, authentification Basic, métadonnée `url_a_auditer`) ;
- la vérification de signature du webhook (signature forgée, absente,
  rejouée, secret erroné — quatre refus, un seul cas accepté) ;
- le déclenchement de `repository_dispatch` avec l'URL et l'identifiant de
  session sur un paiement confirmé, et son absence sur tout autre type
  d'événement ;
- qu’un échec du déclenchement rend 503 pour permettre une nouvelle tentative.

**Et le formulaire de commande de `site/index.html` est vérifié à l'œil**,
dans un vrai Chromium : sans backend déployé, il affiche la même note
honnête qu'avant (« Paiement en ligne sécurisé — bientôt disponible »),
jamais un bouton qui échoue en silence ; avec un backend simulé (route
interceptée), la redirection vers l'adresse de paiement rendue par Stripe se
produit réellement.

**Ce qui reste entièrement non exercé** : `.github/workflows/audit-landing-lancer-audit.yml`,
qui enchaîne les trois scripts pour de vrai — aucun paiement réel ne l'a
encore déclenché. Voir son en-tête.

## Tests

```bash
npm test        # dix tests, sans réseau ni clé
npm run typecheck
```


## Contrôle du 12/09/2026 — proposition Codex

12 tests hors réseau réussis. Le prévol OPTIONS est pris en charge pour les
origines configurées. Seul un statut `paid` déclenche l’analyse ; les paiements
asynchrones confirmés sont également écoutés. Un refus GitHub rend 503 au lieu
d’accuser réception d’une commande perdue.

Références : https://docs.stripe.com/checkout/fulfillment et
https://docs.stripe.com/webhooks .

Blocages avant ouverture : déduplication durable par session Stripe (la
concurrence du workflow ne suffit pas), livraison au client après relecture,
configuration réelle et essai complet. Les nouvelles tentatives peuvent
actuellement produire plusieurs audits : ne pas ouvrir la vente en cet état.
Le rapport stocké en artefact GitHub ne constitue pas une livraison client.

## Raccordement durable préparé (branche Codex)

Le webhook utilise désormais `receptionCommandes: {url, secret}` pour appeler
`reception.py` sur `/commandes`, après vérification de signature et du statut
payé. La réception acquitte seulement après l'écriture SQLite. Les doublons
identiques rendent 200 ; une commande incompatible rend 409 ; une panne rend
503. La création Checkout refuse une configuration de réception absente.

Cette version remplace l'appel direct à GitHub : le workflow historique ne se
lance donc plus depuis ce webhook. Le consommateur de la file, l'hébergement
WSGI avec HTTPS et les secrets restent à configurer avant toute ouverture.
Ce changement n'est pas déployé. Les scénarios locaux ne prouvent pas un
parcours Stripe réel. Le secret partagé ne remplace pas la signature Stripe :
la réception est un service interne réservé au serveur qui l'a vérifiée.
