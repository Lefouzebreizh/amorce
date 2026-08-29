# Serveur de licence d'Amorce

Deux routes, une table de deux colonnes utiles, zéro dépendance. Il sait deux
choses : cette clé est-elle authentique, et ce paiement tient-il toujours.

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

## La clé

`AMO-<référence>-<sceau>`, où le sceau est un HMAC de la référence. Elle porte
donc sa propre preuve : le serveur recalcule et compare, sans rien lire.

L'alphabet écarte `I`, `O`, `0` et `1` : une clé se recopie parfois à la main
depuis un courriel, et ces quatre-là s'échangent sans qu'on s'en aperçoive.

**`SECRET_CLES` ne se change pas à la légère** : il scelle les clés, et toutes
celles déjà émises cesseraient de se vérifier.
