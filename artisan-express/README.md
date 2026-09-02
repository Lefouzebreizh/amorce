# Artisan Express — la page de vente du site à 300 €

Une page, un prix, un formulaire. Elle vend un site vitrine d'une page à un
artisan du bâtiment : 300 € une fois, livré en 48 h, sans abonnement.

Le formulaire n'ouvre pas de compte, ne pose pas de mouchard et n'enregistre
rien : ce que l'artisan écrit part dans une boîte aux lettres, et nulle part
ailleurs.

## État : **déployé, et public depuis le 02/09/2026**

Mesuré le 02/09/2026 par le connecteur Vercel : le projet `amorce-51up` —
dossier racine `artisan-express` — existe, et l'adresse ci-dessous rend **200**
en servant bien cette page, titre « Site vitrine artisan express — 300 €, livré
en 48 h ».

https://amorce-51up.vercel.app

**Elle a pourtant été déployée et invisible, et c'est ce piège-là qu'il faut
retenir.** Le projet portait `ssoProtection` à `all_except_custom_domains` :
**toutes** ses adresses en `.vercel.app` étaient derrière l'authentification
Vercel, et un artisan qui cliquait sur le lien tombait sur un mur de connexion.
Le réglage a été mis à `false` le 02/09/2026, sur accord explicite du
propriétaire — rendre publique une page de vente à son nom relève de la première
exception du §0.

**Le mur ne se voit pas en ouvrant l'adresse, et c'est ce qui le rend coûteux.**
Depuis un navigateur connecté à Vercel — celui du propriétaire — la page
s'affiche normalement ; depuis n'importe quel autre, elle ne s'affiche pas. Une
vérification « j'ouvre le lien, ça marche » conclut donc toujours au vert, quel
que soit l'état réel. Ce qui tranche est le réglage de *Deployment Protection*,
pas la page. Une lecture anonyme reste hors d'atteinte d'une session — le
mandataire refuse `*.vercel.app`, et le connecteur Vercel passe par
l'authentification du compte : **le seul contrôle qui vaut de l'extérieur est
d'ouvrir l'adresse en navigation privée.**

Ce README a longtemps affirmé « pas déployé », et une session avait affirmé le
contraire plus tôt encore — les deux sur des indices, aucune sur une mesure. La
première erreur est instructive : `layout.tsx` portait une adresse par défaut,
`artisan-express.vercel.app`, qui n'a jamais existé. Une session l'a lue et en a
conclu que le site était en ligne ; un résumé de reprise l'a répété. L'adresse
inventée est retirée — sans `NEXT_PUBLIC_SITE_URL`, la page ne déclare plus où
elle habite, et un test le garde.

**Ce qui reste à régler sur le projet**, et qui n'a pas été mesuré ici :

1. `NEXT_PUBLIC_DEVIS_MAILTO` — la seule variable qui ne demande aucun compte,
   et celle sans laquelle un formulaire en panne ne laisse aucun moyen de te
   joindre.
2. `NEXT_PUBLIC_SITE_URL` sur l'adresse ci-dessus, sans quoi les métadonnées de
   partage restent muettes.

Rien d'autre n'est requis : Resend, Stripe, téléphone et WhatsApp améliorent la
page, ils ne la conditionnent pas.

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

## Aller chercher les clients

La page ne se vend pas toute seule : personne n'y arrive par hasard.
`PROSPECTION.md` contient les cinq messages — premier contact, relance, la
réponse à « montrez-moi » qui envoie l'exemple, l'objection sur le prix, le
démarrage — et la règle qui les empêche d'être du spam :
**chacun porte une phrase que seul le vendeur peut écrire, ce qu'il a vraiment
vu sur la page de l'artisan.** Sans elle, c'est un publipostage et ça se sent.

## Facturer

`FACTURER.md` : le modèle de facture, les mentions obligatoires et ce que
chacune évite. Il commence par ce qui bloque tout le reste — **une facture
porte un SIRET**, et sans numéro il n'y a pas d'encaissement possible.

Deux choses y sont marquées comme non vérifiées, faute d'accès : la liste exacte
des mentions et l'effet d'une activité déclarée sur des allocations en cours.
`service-public.fr` rend `000` depuis ce conteneur. Elles se vérifient une seule
fois, avant la première facture.

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

- Le lien de paiement Stripe à 300 €.
- Le numéro de téléphone et celui de WhatsApp.
- La ligne du domaine dans `Offre.tsx` : elle annonce « une douzaine d'euros
  par an, payés au fournisseur ». C'est le seul chiffre de la page qui n'a pas
  été dicté — à confirmer ou à changer.

## Regarder la page comme elle sera lue

```bash
npm run build && npx next start -p 3000 &
npm run regarder http://localhost:3000
```

Un vrai Chromium à **393 × 873** — le terrain de référence du dépôt — et un
refus sur ce qui ne se lit pas : contraste sous 4,5:1, texte sous 18 px, cible
sous 44 px, page qui déborde à droite. Il faut un serveur : la page a une route
d'API, elle ne s'ouvre pas depuis le disque.

**Onze défauts à sa première exécution, et le pire portait la vente :**

| Ce qui n'allait pas | Mesuré | Pourquoi personne ne l'avait vu |
| --- | --- | --- |
| Le bouton principal, blanc sur `#e35d00` | 3,60:1 | La teinte du **survol** était déjà à 4,65:1 : la page se lisait mieux le doigt posé qu'au repos. |
| « Pas d'abonnement… », `text-white/85` sur bleu | 2,58:1 | Une opacité ne se voit pas — elle divise le contraste en silence. |
| Six textes en `text-sm` | 15,75 px | La racine est à **18 px** ici, pas à 16 : `text-sm` vaut donc 0,875 × 18. |

Ce que le contrôle **ne** compte pas : tout ce qui est `aria-hidden`. Les
maquettes de téléphone dessinées en HTML imitent une capture d'écran, 9 px et
gris pâles compris. Les mesurer donnait quarante défauts dont trente ne
devaient rien à personne, et un contrôle qui crie pour du décor cesse d'être lu.

## Ce qui se passe sur une page nue

Une page déployée **sans aucune variable** doit rester capable d'encaisser une
demande. C'était faux : sans `RESEND_API_KEY` la route rend 503 — honnêtement,
sans faux accusé de réception — mais sans `NEXT_PUBLIC_DEVIS_MAILTO` non plus,
le formulaire n'avait plus rien à proposer et affichait « réessaie dans quelques
minutes » à quelqu'un qui venait de taper son nom, son métier et son numéro.

`NEXT_PUBLIC_DEVIS_MAILTO` a donc une **valeur par défaut**, seule variable de
ce fichier à en avoir une : sans elle, l'absence ne faisait pas disparaître un
bouton, elle perdait des prospects en silence.

Ce que ça coûte : l'adresse part dans le paquet du navigateur, lisible par un
ramasseur d'adresses. Un indésirable de plus contre une demande perdue — et le
compromis se défait en réglant la variable sur une adresse dédiée.

| Variable | Sans elle |
| --- | --- |
| `RESEND_API_KEY` + `DEVIS_DESTINATAIRE` | La route rend 503, le formulaire bascule sur la messagerie de l'artisan. |
| `NEXT_PUBLIC_DEVIS_MAILTO` | Le repli vise l'adresse par défaut du vendeur. |
| `NEXT_PUBLIC_TELEPHONE` | Le bouton d'appel disparaît. |
| `NEXT_PUBLIC_WHATSAPP` | Le bouton WhatsApp disparaît. |
| `NEXT_PUBLIC_LIEN_STRIPE` | Le bouton d'offre renvoie au formulaire. |

## L’exemple qu’un prospect demande

« Montre-moi un exemple » est sa première question, et sans lien la conversation
s'arrête là. `public/exemple.html` est servi à **`/exemple.html`**, et la page de
vente y renvoie sous l'avant/après. Depuis le 02/09/2026, l'adresse existe et se
colle telle quelle dans les messages de `PROSPECTION.md` :

https://amorce-51up.vercel.app/exemple.html

**Trois autres démonstrations existent, publiées en artefacts**, et le dépôt ne
les portait nulle part — ce qui obligeait à les rechercher à chaque fois. Elles
ne sont pas servies par ce projet et ne se régénèrent pas par `npm run exemple` :

| Métier | Adresse |
| --- | --- |
| Plomberie Kerhervé — Rennes | https://claude.ai/code/artifact/cd3c916f-1768-4615-ba10-d1e7e60ce21e |
| Couverture Tanguy — Rennes | https://claude.ai/code/artifact/a553d824-123e-4b04-b4eb-ccd75b38153c |
| Maçonnerie Le Goff | https://claude.ai/code/artifact/df8ad2ff-67b2-461f-bed6-39c69264ffdd |

**Avant d'en envoyer une, l'ouvrir en navigation privée.** Un artefact partagé
peut servir une **version épinglée**, antérieure à celle que son auteur voit en
direct — c'est le même piège que le mur de connexion plus haut, et il se règle
du même geste. Les trois portaient d'ailleurs le métier et la ville de Rennes
quand `exemple.html` porte Auray : ce sont bien des pages distinctes, pas des
copies.

```bash
npm run exemple      # régénère depuis titan-builder/demo, puis recopie
```

Ce n'est pas une maquette : c'est la sortie du **même générateur** que celui
d'un client payant. Le refaire à la main dériverait ; la commande le refait en
une seconde.

**La page sort en `noindex`.** L'entreprise n'existe pas et son numéro ne sonne
nulle part : indexée, elle se présenterait dans les résultats comme un vrai
artisan, et concurrencerait un jour un client réel au nom voisin. C'est ce qui
distingue un exemple d'un mensonge en ligne, et le générateur porte le drapeau
(`--demonstration`) plutôt que la copie.

**Adresse en `.html`, et pas un dossier.** Next sert `public/` tel quel et **ne
résout aucun index de dossier** : `/exemple/` rend un 308 puis un 404, seul
`/exemple/index.html` répondait. Un fichier à plat donne une adresse courte qui
se dicte au téléphone.
