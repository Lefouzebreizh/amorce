# Hypersensible & Bienveillance

Deux outils gratuits pour hypersensibles, et un radar des prix.

- **Réponse bienveillante** — tu colles le message qui t'est resté en travers,
  l'outil le réécrit en Communication Non Violente : le fait, le sentiment, le
  besoin, la demande. Et une ligne d'humour, parce qu'un message parfaitement
  bienveillant et parfaitement sérieux, personne ne l'envoie jamais.
- **Journal émotionnel** — un espace d'écriture libre qui te renvoie une météo,
  ce qu'il a entendu, et une seule piste. Il ne quitte jamais ton navigateur.
- **Radar Bien-être** — ce que coûtent dix applications de bien-être ce mois-ci,
  et comment ça a bougé. Aucun lien affilié, aucune commission.

Le tout adossé à un groupe Facebook de 48 000 personnes qui n'est pas un
produit, et ne le deviendra pas.

## Les trois règles

Elles priment sur n'importe quelle considération technique. Une amélioration qui
les contredit est une amélioration qu'on refuse.

1. **Qui vient du groupe a tout.** Un lien avec `?src=groupe` **et le jeton du
   groupe** ouvre l'accès illimité : pas de compte, pas de carte, pas de
   compteur, aucune écriture en base. Rien n'est vendu dans le groupe.

   Le jeton est nécessaire depuis le 02/09/2026 : le seul paramètre suffisait,
   et n'importe qui l'ajoutait à l'adresse pour ne plus jamais être décompté
   (`AUDIT.md`, H-1). Sans jeton on ne refuse personne — on retombe sur le
   quota ordinaire.
2. **Rien de ce que tu écris n'est conservé.** Ni le message collé dans la
   reformulation, ni la page de journal. Pas en clair, pas haché, pas tronqué.
   La base ne contient que des compteurs, et ton adresse n'y figure que sous
   forme d'empreinte salée.
3. **Ce qui est simulé est annoncé.** Les liens du radar sont réellement
   vérifiés chaque nuit ; les variations de prix, elles, sont encore fabriquées
   le temps qu'un analyseur de tarifs soit écrit — et la page le dit.

Le trafic venu d'ailleurs a cinq analyses par jour, puis une proposition de
soutien à 19 €. Proposée une fois, sans bandeau qui revient.

## Démarrer

```bash
npm install
npm run db:init      # crée et remplit la base D1 locale (rejouable sans doublon)
npm run build        # Astro → dist/
npm run preview      # site + fonctions sur http://localhost:8788
```

Puis, pour essayer l'accès communauté : `http://localhost:8788/?src=groupe&jeton=…`,
avec la valeur posée dans `JETON_GROUPE`. Sans elle, l'adresse s'ouvre mais le
quota ordinaire s'applique — c'est le comportement voulu, pas une panne.

> `npm run dev` (Astro seul) ne sert **pas** les Pages Functions : le radar et la
> reformulation répondent « indisponible », et c'est normal. C'est `npm run
> preview` qui monte les deux.

La tournée de nuit se déclenche à la main :

```bash
npm run cron
curl "http://localhost:8787/__scheduled?cron=0+4+*+*+*"
```

## Mettre en ligne

Rien de tout cela n'a encore été fait : le site tourne en local, la base D1
distante n'existe pas, et `database_id` vaut `local-d1-id` dans les deux
configurations — un marqueur, pas un identifiant.

**L'ordre compte, et une étape ne peut pas se rattraper après coup :** le sel du
hachage des adresses doit exister *avant* le premier déploiement. Sans lui, le
code retombe sur `sel-local-a-remplacer`, une valeur écrite en clair dans ce
dépôt — les empreintes ne seraient alors salées par rien du tout. C'est pour
cela que le projet Pages est créé vide, avant d'être déployé : un projet vide
accepte déjà ses secrets.

```bash
# 1. S'identifier auprès de Cloudflare (ou poser CLOUDFLARE_API_TOKEN).
npx wrangler login

# 2. Créer la base. La commande rend un `database_id` — le garder sous la main.
npx wrangler d1 create hypersensible-db

# 3. Reporter cet identifiant dans les DEUX configurations, à la place de
#    `local-d1-id` : wrangler.toml et wrangler.veille.toml. Les Pages et le
#    Worker de veille doivent viser la même base, sans quoi le radar affiche
#    des prix que la tournée de nuit écrit ailleurs.

# 4. Créer le seau des archives quotidiennes.
npx wrangler r2 bucket create emotions-data

# 5. Poser le schéma sur la base DISTANTE. `npm run db:init` ne fait que le
#    local : sans `--remote`, la base en ligne resterait vide et chaque route
#    répondrait « no such table ».
npx wrangler d1 execute DB --remote --file=./schema.sql

# 6. Créer le projet Pages vide, pour pouvoir lui donner son sel avant qu'il
#    ne serve la moindre requête.
npx wrangler pages project create hypersensible-bienveillance

# 7. Les deux secrets. Le sel : n'importe quelle chaîne longue et aléatoire,
#    par exemple `openssl rand -base64 32`. Le changer plus tard remet tous
#    les compteurs de quota à zéro — sans autre dégât.
npx wrangler pages secret put SEL_QUOTA
npx wrangler secret put RESEND_API_KEY --config wrangler.veille.toml

# 8. Déployer : le site et ses fonctions, puis la tournée de nuit.
npm run build && npm run deploy
npm run deploy:veille
```

Puis vérifier, dans cet ordre — chaque ligne échoue d'une manière différente :

```bash
curl -s https://<domaine>/api/radar | head -c 300      # attendu : "simule": true
curl -s -X POST https://<domaine>/api/reforme \
  -H 'content-type: application/json' \
  -d '{"texte":"tu ne réponds jamais","src":"externe"}' | head -c 200
npx wrangler pages secret list                          # SEL_QUOTA doit y être
npx wrangler tail --config wrangler.veille.toml         # la tournée de 04 h 00
```

> **Tant que le radar est simulé, ne pas brancher le domaine public.** La
> troisième règle dit que ce qui est simulé est annoncé, et la page l'annonce ;
> elle ne dit pas qu'un radar de démonstration mérite d'être publié. `RADAR_SIMULE`
> et `SIMULER_PRIX` tombent ensemble à « 0 » le jour où l'analyseur de tarifs
> existe — c'est ce jour-là que le domaine se branche.

## Vérifier

```bash
npm test        # moteur CNV et lecture de journal — node --test, sans dépendance
npm run check   # astro check + tsc --noEmit
npm run build   # le build doit passer avant toute mise en ligne
```

Les tests couvrent ce qui est calculable hors navigateur : la reformulation et
la lecture de journal. Le reste — quota, radar, tournée de veille — se vérifie
en lançant `npm run preview` et en appelant les routes, ce que documente
`public/llms.txt`.

## Mettre en ligne

```bash
wrangler d1 create hypersensible-db        # reporter l'identifiant dans les deux .toml
wrangler d1 execute DB --remote --file=./schema.sql
wrangler pages secret put SEL_QUOTA        # sans lui, les empreintes d'IP se cassent
npm run deploy                             # le site et ses fonctions
wrangler secret put RESEND_API_KEY --config wrangler.veille.toml
npm run deploy:veille                      # la tournée de nuit
```

## Architecture

Cloudflare Pages pour le front statique, Pages Functions pour l'API, D1 pour les
données, R2 pour les archives de nuit, et un Worker séparé pour le cron — Pages
ne sait pas déclencher de tâche planifiée.

Les décisions et les pièges déjà payés sont écrits dans **`public/llms.txt`**,
qui sert de mémoire du projet d'une session à l'autre. Le lire avant de toucher
à l'architecture ; le tenir à jour en la changeant.

---

*L'humain donne le cap, l'IA accélère le chemin.* — Erwann Lefouzèbreizh
