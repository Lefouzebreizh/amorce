# Artisan Express — la page de vente du site à 299 €

Une page, un prix, un formulaire. Elle vend un site vitrine d'une page à un
artisan du bâtiment : 299 € une fois, livré en 48 h, sans abonnement.

Le formulaire n'ouvre pas de compte, ne pose pas de mouchard et n'enregistre
rien : ce que l'artisan écrit part dans une boîte aux lettres, et nulle part
ailleurs.

## Lancer

```bash
cd artisan-express
npm install
cp .env.example .env.local   # puis remplir ce qu'on a
npm run dev
```

Avant de pousser :

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Les variables, et ce qui se passe sans elles

| Variable | Sans elle |
| --- | --- |
| `NEXT_PUBLIC_DEVIS_MAILTO` | **La seule qui ne demande aucun compte.** Sans elle, un formulaire en panne n'a plus que le téléphone — absent lui aussi tant qu'aucun numéro n'est réglé. Avec elle, la demande part de la messagerie de l'artisan, déjà écrite. |
| `RESEND_API_KEY` | Le formulaire répond « c'est de mon côté » et bascule sur le repli ci-dessus, ou sur le téléphone. |
| `DEVIS_DESTINATAIRE` | Idem : sans boîte, rien n'est envoyé. |
| `DEVIS_EXPEDITEUR` | Le courriel part du domaine partagé de Resend. Marche, mais tombe plus souvent en indésirable. |
| `NEXT_PUBLIC_TELEPHONE` | Les boutons d'appel disparaissent. |
| `NEXT_PUBLIC_WHATSAPP` | Le bouton WhatsApp disparaît. |
| `NEXT_PUBLIC_LIEN_STRIPE` | Le bouton d'achat renvoie au formulaire au lieu du paiement. |

**Le minimum pour encaisser une demande, c'est une adresse.** Une page déployée
sans rien réglé était une page morte : le formulaire s'excusait, et les boutons
de repli — téléphone, WhatsApp — disparaissaient faute de valeurs. Avec la seule
`NEXT_PUBLIC_DEVIS_MAILTO`, il reste toujours un chemin pour joindre le vendeur,
sans créer le moindre compte. Resend et Stripe restent meilleurs ; ils ne sont
plus la condition d'une première vente.

**Rien n'est jamais inventé pour combler un trou.** Un numéro de téléphone
faux sur une page de vente coûte plus cher qu'un bouton en moins : ce qui n'est
pas réglé disparaît de l'écran.

## Déployer sur Vercel

Projet Next.js standard, dossier racine `artisan-express`. Les six variables
ci-dessus se posent dans les réglages du projet. La route `/api/devis` a besoin
du runtime Node : elle le déclare elle-même, rien à régler.

## Les décisions qui tiennent la page

- **Un seul accent.** Le bleu (#004AAD) porte la structure, l'orange ne sert
  qu'à ce qui engage quelque chose. On ne cherche jamais où cliquer.
- **18 px de base.** Cette page se lit dehors, au soleil, sur un téléphone tenu
  à bout de bras. Le plancher tactile est monté à 56 px (`min-h-14`) plutôt
  qu'aux 44 px habituels : des mains de chantier, et un achat au bout.
- **Aucune image.** Le téléphone du haut de page et les deux maquettes
  « avant / après » sont dessinés en HTML. L'invariant du dépôt interdit tout
  binaire versionné, et une capture serait de toute façon fausse — le site
  montré est celui qu'on promet, pas un qui existe.
- **Aucun témoignage inventé.** La place du premier client est vide et le dit.
  C'est le seul argument qu'un concurrent ne peut pas copier.
- **Pas d'annuaire nommé.** La comparaison « avant / après » décrit ce que vit
  l'artisan — quatrième sur une liste, 49 € par mois — sans citer de marque.
- **La validation est partagée.** `src/lib/demande.ts` sert au navigateur et au
  serveur : l'artisan voit son erreur avant l'envoi, et la route publique ne
  fait confiance à personne.
- **Aucune dépendance ajoutée.** Ni SDK de courriel, ni bibliothèque d'icônes,
  ni animation : quatre traits de SVG et une requête `fetch` suffisent.

## Ce qui n'est pas vérifié ici

`npm test` couvre la validation et la fabrication du courriel, sans réseau.
**Le premier envoi réel ne l'est pas** : `resend.com` est refusé par le
mandataire de la machine qui a écrit ce code, et le corps de la requête a donc
été rédigé sans pouvoir relire la documentation. S'il faut le corriger, tout
tient dans `construireCorpsResend` (`src/lib/courriel.ts`), qui est éprouvée
pour elle-même.

Le parcours visuel a été mesuré dans Chromium à 393 px et 1280 px : aucun
défilement horizontal, aucune cible tactile sous 44 px hors du piège à robots.

## À remplir avant la première vente

- Le lien de paiement Stripe à 299 €.
- Le numéro de téléphone et celui de WhatsApp.
- La ligne du domaine dans `Offre.tsx` : elle annonce « une douzaine d'euros
  par an, payés au fournisseur ». C'est le seul chiffre de la page qui n'a pas
  été dicté — à confirmer ou à changer.
