# Serveur de licence d'Amorce

Trois routes, une table de deux colonnes utiles, zéro dépendance. Il sait deux
choses : cette clé est-elle authentique, et ce paiement tient-il toujours.

| Route | Qui l'appelle |
| --- | --- |
| `GET /etat` | le studio, à chaque démarrage, avec la clé en `Bearer` |
| `POST /webhook` | Stripe, à chaque paiement, remboursement ou contestation |
| `GET /remise?session=cs_…` | la page de succès, pour remettre sa clé à l'acheteur |

**Aucun média ne l'atteint jamais**, aucun nom de fichier, aucune trace
d'usage. Le contrat complet est dans `../src/licence/CONTRAT.md` ; il a été
écrit depuis le client, qui existait déjà.

## Vérifier

```bash
npm test        # 9 contrôles, sans réseau ni wrangler
npm run typecheck
```

Tout ce qui décide vit dans `src/index.ts`, qui ne connaît que l'interface
`Base`. C'est ce qui permet d'éprouver le serveur entier — signature Stripe
comprise — sans D1 et sans déployer.

## Déployer

```bash
npx wrangler d1 create amorce-licence          # reporter l'identifiant dans wrangler.toml
npx wrangler d1 execute amorce-licence --file schema.sql --remote
npx wrangler secret put SECRET_CLES            # une chaîne longue, tirée au hasard
npx wrangler secret put SECRET_WEBHOOK         # celui que Stripe affiche
npx wrangler deploy
```

Puis dans Stripe : un webhook vers `https://<adresse>/webhook`, abonné à
`checkout.session.completed`, `charge.refunded` et `charge.dispute.created`.

Enfin, côté Amorce : `NEXT_PUBLIC_LICENCE_URL=https://<adresse>`. **La
signature de l'offre libre apparaît alors d'elle-même** — le studio ne
l'affiche pas tant qu'il n'existe pas d'endroit où payer.

Et l'adresse de succès Stripe doit porter la session :
`https://<amorce>/merci?session={CHECKOUT_SESSION_ID}`. Sans ce paramètre, le
paiement aboutit et **l'acheteur n'a aucun moyen d'obtenir sa clé** — c'est le
seul réglage de la console Stripe qu'aucun test d'ici ne peut rattraper.

`/remise` ne garde rien : la référence se dérive de la session et la clé se
recalcule par son sceau. Une colonne qui stockerait la clé en clair serait une
table de licences distribuables, et il n'y en a pas besoin. Le revers, dit
franchement : qui connaît un identifiant de session obtient la clé
correspondante — c'est le même secret que la clé elle-même, et Stripe ne le
donne qu'à l'acheteur. Un paiement inconnu rend 404, et non un refus : le
webhook a quelques secondes de retard sur la redirection, et la page de succès
doit pouvoir réessayer sans annoncer un échec à quelqu'un qui vient de payer.

## La clé

`AMO-<référence>-<sceau>`, où le sceau est un HMAC de la référence. Elle porte
donc sa propre preuve : le serveur recalcule et compare, sans rien lire.

L'alphabet écarte `I`, `O`, `0` et `1` : une clé se recopie parfois à la main
depuis un courriel, et ces quatre-là s'échangent sans qu'on s'en aperçoive.

**`SECRET_CLES` ne se change pas à la légère** : il scelle les clés, et toutes
celles déjà émises cesseraient de se vérifier.
