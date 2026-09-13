# Serveur de paiement — audit de page de vente

Le gestionnaire `traiter(requete, reglages)` est servi par un adaptateur Node HTTP,
sans dépendance d'exécution, destiné à un reverse proxy HTTPS. Il reste à
configurer et déployer. Publier la landing statique ne déploie pas ces routes.

- **`POST /creer-session`** reçoit `{ "url": "https://…" }` et crée une session
  Stripe Checkout pour un paiement unique au prix configuré. L'URL auditée est
  transmise dans `metadata[url_a_auditer]`. La réponse contient uniquement une
  adresse HTTPS de `checkout.stripe.com`.
- **`POST /webhook`** vérifie la signature Stripe et le statut `paid`, puis
  transmet la commande à `reception.py`, sur `/commandes`, derrière HTTPS.
  Il écoute `checkout.session.completed` et
  `checkout.session.async_payment_succeeded`.
- **`GET /health`** confirme seulement que le serveur HTTP répond en mode test.
  Il ne contacte ni Stripe ni la réception et ne prouve pas leur disponibilité.

La réception acquitte après écriture SQLite sur un disque persistant. Une session
rejouée avec les mêmes données ne crée pas de deuxième commande ; une session
avec des données incompatibles est refusée. Une panne de réception rend **503**
au webhook pour conserver les nouvelles tentatives de Stripe.

Le webhook ne déclenche plus `repository_dispatch` ni le workflow historique
`audit-landing-lancer-audit.yml`. La production du rapport et sa livraison
passent par `operateur.py`, avec relecture humaine nominative avant envoi.

## Démarrage sur l'hébergement choisi

Node 22 ou supérieur et TypeScript 5.7 ou supérieur sont nécessaires à la
construction. Le compilateur et les types sont des outils de développement ;
le serveur compilé utilise uniquement Node. Depuis ce dossier :

```bash
npm install --no-save typescript@^5 @types/node@^22
npm run typecheck
npm test
npm run build
npm start
```

`npm start` lance `dist/demarrer.js`. Le serveur écoute par défaut sur
`127.0.0.1:8788`, derrière un reverse proxy HTTPS. Il refuse de démarrer si la
configuration est absente ou invalide. Cet adaptateur est volontairement limité
aux clés Stripe **test** ; le mode live nécessite une décision et une validation
séparées après le pilote.

Il conserve le corps UTF-8 reçu sans parser/recomposer le JSON avant la
vérification de signature. Les corps sont limités à 64 Kio (réponse 413), les
erreurs HTTP sont génériques et les secrets ne sont pas journalisés.

## Variables d'environnement

| Variable | Réglage / valeur attendue |
| --- | --- |
| `STRIPE_SECRET_KEY` | `cleSecreteStripe` : clé `rk_test_…` restreinte dédiée à Checkout, ou clé secrète test. |
| `STRIPE_PRICE_ID` | `idPrixStripe` : identifiant `price_…` du même compte Stripe test. Aucun prix n'est inventé par le code. |
| `STRIPE_WEBHOOK_SECRET` | `secretWebhook` : secret `whsec_…` du webhook test enregistré pour ce serveur. |
| `AUDIT_ORIGINES` | `origines` : origines HTTPS exactes séparées par des virgules, sans chemin ni slash final. |
| `AUDIT_URL_SUCCES` | `urlSucces` : page HTTPS existante de retour du paiement. Le retour navigateur ne prouve jamais un paiement. |
| `AUDIT_URL_ANNULATION` | `urlAnnulation` : page HTTPS existante d'annulation. |
| `AUDIT_RECEPTION_URL` | `receptionCommandes.url` : endpoint HTTPS `/commandes` du registre persistant. |
| `AUDIT_RECEPTION_SECRET` | `receptionCommandes.secret` : secret partagé d'au moins 32 caractères, identique dans la réception. |
| `HOST` | Optionnel : adresse d'écoute, `127.0.0.1` par défaut. |
| `PORT` | Optionnel : port d'écoute de 1 à 65535, `8788` par défaut. |

Conserver les secrets dans la configuration protégée de l'hébergeur. Ne pas les
placer dans la landing, le dépôt ou des journaux. La clé d'analyse et les
réglages Resend appartiennent au processus opérateur ; le serveur Checkout
n'en a pas besoin.

Le prix absent, un secret de réception trop court ou une URL de réception
invalide/HTTP bloquent la création de session **avant** tout appel Stripe.
Ce contrôle de configuration ne prouve pas que l'endpoint distant fonctionne :
sa disponibilité et sa persistance doivent être vérifiées lors de l'essai.

Les URL client contenant des identifiants, les noms locaux et les IP littérales
sont également refusés avant Checkout. Le moteur de capture effectue ensuite ses
contrôles réseau ; une URL syntaxiquement plausible ne garantit ni que la page
existe, ni qu'elle soit accessible. Son exécution doit rester isolée des réseaux
internes et métadonnées de l'hébergeur.

## Vérifications locales

Les 20 tests TypeScript utilisent des réponses Stripe/réception simulées.
Les tests de l'adaptateur démarrent un serveur sur `127.0.0.1` avec un port
temporaire. Le transport des réglages de test refuse tout appel externe imprévu.
Ces tests couvrent la configuration, la requête Checkout construite, la
signature, la transmission d'un paiement confirmé, le corps brut et la limite de
taille. Ils ne constituent pas une création réelle de session Stripe.

Les tests Python du registre, de la réception, de l'opérateur et de la livraison
se lancent depuis la racine du dépôt :

```bash
python -m unittest discover -s audit-landing/tests -v
```

L'opérateur conserve les fichiers sous
`<captures>/<empreinte-session>/capture-<identifiant-tentative>/<page>/`.
Deux achats d'une même URL et une reprise après échec produisent des dossiers
distincts ; aucun rapport déjà approuvé ni segment précédent n'est écrasé.

## Preuves encore nécessaires avant un achat test complet

1. Configurer le serveur HTTP derrière HTTPS et raccorder le registre SQLite
   à un disque persistant ; vérifier sa réception depuis le serveur.
2. Configurer le produit, le prix, la clé et le webhook Stripe **test**, les
   origines et les deux pages de retour.
3. Effectuer un achat test, constater une seule commande enregistrée, puis
   produire le rapport avec le moteur de capture et d'analyse réel.
4. Relire et approuver le rapport, faire accepter l'envoi par Resend, puis
   vérifier sa réception et l'ouverture du fichier HTML chez le destinataire.
5. Vérifier l'annulation, le rejeu du webhook et une panne contrôlée de réception.

Une réponse Resend acceptée ne prouve pas la remise en boîte de réception.
Un rapport en artefact GitHub ne constitue pas une livraison au client.
Le détail des preuves attendues reste dans
[`VALIDATION-ACHAT-TEST.md`](../VALIDATION-ACHAT-TEST.md).

Références : [Stripe Checkout](https://docs.stripe.com/api/checkout/sessions),
[exécution après paiement](https://docs.stripe.com/checkout/fulfillment),
[webhooks](https://docs.stripe.com/webhooks).
