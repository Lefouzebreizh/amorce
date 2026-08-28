# TITAN BUILDER — la plateforme qui prépare le dossier à ma place

Le client choisit un modèle, configure son site en cinq étapes et envoie son
dossier. Je reçois tout d'un coup — infos, fonctions cochées, photos, textes,
prix recalculé — et je livre en 48 h.

Ce que ça remplace : quatre allers-retours par téléphone pour réclamer un logo,
une couleur et une liste de services.

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
