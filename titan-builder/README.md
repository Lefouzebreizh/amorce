# TITAN BUILDER — la plateforme qui prépare le dossier à ma place

Le client choisit un modèle, configure son site en cinq étapes et envoie son
dossier. Je reçois tout d'un coup — infos, fonctions cochées, photos, textes,
prix recalculé — et je livre en 48 h.

Ce que ça remplace : quatre allers-retours par téléphone pour réclamer un logo,
une couleur et une liste de services.

## Livrer le site

`titan-builder` recueillait tout puis s'arrêtait sur un `commande.json` : le
site se construisait ensuite à la main, et vendre trois sites dans la semaine
voulait dire les écrire trois fois.

```bash
npm run generer dossiers/maconnerie-le-goff-2026-08-29
```

Le dossier **devient** le site : un `index.html` autonome atterrit à côté des
photos. On le dépose tel quel sur n'importe quel hébergement, on le zippe, ou
on l'ouvre depuis le disque pour le montrer au client avant publication.

Une page HTML et rien d'autre — pas de cadre applicatif. Le site d'un artisan
tient sur une page : y mettre Next.js ajouterait une compilation, un hébergeur
qui exécute du Node, et un redéploiement pour changer un numéro de téléphone.

Toute la fabrication est dans `src/lib/site.ts`, **pur** : il rend une chaîne,
il ne touche ni au disque ni au réseau. Seul le script écrit.

## Quand un client dit oui ailleurs que sur la plateforme

Le formulaire en ligne suppose que le client vient s'y configurer. Dans la vraie
vente, il dit oui sur Messenger et donne ses informations en trois messages :
c'est le vendeur qui les a sous les yeux.

```bash
npm run nouveau-client            # neuf questions, puis le dossier et la page
```

Les questions sont exactement les champs du formulaire, et la validation est
exactement celle de la route d'API — `reproches()`, partagée. Une seconde règle
écrite pour le terminal aurait dérivé de celle du web sans que rien ne le
signale, et fabriqué des dossiers qu'un autre chemin refuse.

Le script s'arrête après le dossier et la page. Les photos se déposent dedans
ensuite, et `npm run generer` les reprend : séparer les deux évite d'attendre un
transfert de photos pendant que le client est encore en ligne.

## Mettre le site du client en ligne

Le générateur produit un dossier autonome : **une page HTML, les photos, et
rien d'autre.** Aucun JavaScript, aucune police distante, aucun chemin absolu —
vérifié par deux tests et regardé dans un vrai navigateur, servi depuis un
sous-dossier comme le ferait un hébergement gratuit.

C'est ce qui le rend publiable partout, **sans compte à créer et sans quota** :

| Où | Comment | Ce que ça coûte |
| --- | --- | --- |
| **GitHub Pages** | un dépôt par client, *Settings → Pages*, branche `main` | rien |
| **Netlify Drop** | glisser le dossier sur `app.netlify.com/drop` | rien, sans même un compte |
| **Cloudflare Pages** | *Upload assets*, glisser le dossier | rien |
| Un hébergement à soi | déposer le dossier par FTP | ce qu'il coûte déjà |

**Ne pas déployer les sites clients là où l'on déploie les siens.** Un compte
Vercel gratuit plafonne à cent déploiements par jour, et ce dépôt les consomme
tout seul : un client dont le site attend un quota est un client qui doute.

**Ce que le dossier permet aussi, et qui vaut le détour :** `index.html`
s'ouvre depuis le disque, sans serveur. On montre le site au client sur son
téléphone avant de publier quoi que ce soit — et c'est souvent là que se décide
la vente, pas dans le devis.

## Lancer

```bash
cd titan-builder
npm install
cp .env.example .env.local   # puis remplir ce qu'on a
npm run dev                  # http://localhost:3000
```

Avant de pousser :

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Les variables, et ce qui se passe sans elles

| Variable | Sans elle |
| --- | --- |
| `RESEND_API_KEY` | Le dossier est **écrit quand même**, mais rien ne part. La page le dit au client au lieu de lui laisser croire que c'est envoyé. |
| `COMMANDE_DESTINATAIRE` | La boîte par défaut est `erwannchevallier@gmail.com`. |
| `COMMANDE_EXPEDITEUR` | Le courriel part du domaine partagé de Resend. Marche, mais tombe plus souvent en indésirable. |
| `DOSSIER_COMMANDES` | Les dossiers atterrissent dans `/tmp/titan-commandes`. |

**Rien n'est jamais inventé pour combler un trou.** Un accusé de réception faux
coûte plus cher qu'un message honnête : on ne rappelle pas quelqu'un qui se
croit servi.

## Ce que `/tmp` veut dire sur Vercel

Le dossier de commande est une **trace locale**, pas un stockage. Sur Vercel,
`/tmp` appartient à une invocation et disparaît avec elle : le courriel est donc
le seul chemin par lequel une commande sort réellement de la machine.

Le jour où les photos doivent survivre, l'endroit est un stockage objet (R2,
comme `hypersensible-bienveillance/`) — pas un dossier sur le serveur.

## La carte du code

```
src/lib/commande.ts    modèles, options, prix, validation — pur, testé
src/lib/config.ts      les variables d'environnement et leur absence
src/lib/dossier.ts     l'écriture du dossier de commande
src/lib/courriel.ts    l'envoi par Resend, et le corps du message
src/components/        la carte de modèle, le configurateur en cinq étapes
src/app/api/commande/  la route qui reçoit, revalide, écrit, envoie
```

## Trois décisions qui tiennent le projet

**Le prix est recalculé côté serveur, jamais lu.** Un total envoyé par le
navigateur est une valeur que n'importe qui réécrit avant l'envoi. Le formulaire
et la route appellent la **même** fonction `prixTotal`.

**Le formulaire et le serveur partagent `reproches`.** Deux validations séparées
finissent par diverger, et le serveur accepte alors ce que l'écran refuse.

**Aucun sous-composant n'est défini dans un rendu.** Une fonction écrite dans le
corps d'un composant est redéfinie à chaque rendu : React démonte et remonte le
sous-arbre, et le curseur saute à chaque frappe dans les champs. Le défaut ne se
voit dans aucun test unitaire.

## Déployer sur Vercel

Racine du projet : `titan-builder`. Rien d'autre à régler — pas d'image
distante, pas de réécriture, pas d'en-tête sur mesure.
