# Serveur de comptes d'Amorce

Phase 1 de la génération intégrée : des comptes et un grand livre de crédits.
Séparé de `../licence-serveur`, qui garde son rôle inchangé — vérifier la
licence d'édition à 49 €. Celui-ci gère une monnaie qui bouge à chaque appel
de génération, pas un paiement unique.

| Route | Qui l'appelle |
| --- | --- |
| `POST /connexion` | le studio, avec une adresse — envoie un lien par courriel |
| `GET /verifier` | le navigateur, en suivant le lien reçu — rend un jeton de session |
| `GET /solde` | le studio, à chaque ouverture, avec le jeton de session en `Bearer` |
| `POST /webhook` | Stripe, à chaque achat de crédits ou remboursement |

Aucun mot de passe : la connexion se fait par lien envoyé par courriel,
quinze minutes de validité, comme la remise de licence le fait déjà pour la
clé d'Amorce. Aucune table de sessions non plus — le jeton de session est
scellé par HMAC (trente jours), pas stocké côté serveur. Voir `src/jetons.ts`
pour ce que ce choix coûte : pas de révocation avant expiration.

## Vérifier

```bash
npm test        # sans réseau, sans D1, sans Resend
npm run typecheck
```

Tout ce qui décide vit dans `src/index.ts`, qui ne connaît que l'interface
`Base` — c'est ce qui permet d'éprouver le serveur entier, webhook Stripe
compris, sans déployer quoi que ce soit.

## Déployer

```bash
npx wrangler d1 create amorce-comptes          # reporter l'identifiant dans wrangler.toml
npx wrangler d1 execute amorce-comptes --file schema.sql --remote
npx wrangler secret put SECRET_JETONS          # une chaîne longue, tirée au hasard
npx wrangler secret put SECRET_WEBHOOK         # celui que Stripe affiche pour CE webhook — différent de celui de licence-serveur
npx wrangler secret put CLE_RESEND             # la clé d'API Resend
npx wrangler secret put EXPEDITEUR             # "Amorce <compte@ton-domaine>"
npx wrangler secret put ADRESSE_SITE           # "https://amorce.vercel.app" — sert à construire le lien de connexion
npx wrangler deploy
```

Puis dans Stripe : un second webhook (ou le même avec des événements en
plus), vers `https://<adresse>/webhook`, abonné à `checkout.session.completed`,
`charge.refunded` et `charge.dispute.created` — les trois mêmes événements
que `licence-serveur`, sur une adresse différente.

**`PACKS` reste à `{}` tant que le prix des packs de crédits n'est pas
décidé.** C'est une correspondance montant payé en centimes → crédits
accordés, ex. `{"1900": 100, "4900": 300}` pour un pack à 19 € qui donne 100
crédits et un pack à 49 € qui en donne 300. Tant qu'un montant reçu n'a pas
de palier connu dans cette table, le webhook l'ignore silencieusement plutôt
que de le refuser — voir la note dans `src/index.ts`, fonction `webhook` :
Stripe réessaierait pendant des jours un événement qu'aucun redéploiement ne
répare tout seul.

Les packs eux-mêmes se posent comme des liens de paiement Stripe classiques,
un par palier — pas d'appel à l'API Stripe depuis ce serveur pour créer une
session à la volée, exprès : ça garde ce fichier sans dépendance sortante
autre que Resend. Le lien de paiement doit porter `client_reference_id` égal
à l'identifiant de compte (`compteId` rendu par `/verifier`), posé par le
studio au moment de rediriger vers Stripe.

## Ce qui manque encore, et ce n'est pas un oubli

- **Aucune route de dépense.** Ce fichier pose le grand livre et le crédite ;
  rien n'y débite encore de crédits contre une génération, parce que la
  passerelle de génération (phase 2) n'existe pas. `Base.crediter` accepte
  déjà un `delta` négatif — le débit est prêt côté grand livre, il attend son
  appelant.
- **Aucune interface studio.** Ni champ de connexion, ni affichage du solde
  dans Amorce lui-même — ce serveur répond, personne ne l'appelle encore
  depuis le navigateur.
