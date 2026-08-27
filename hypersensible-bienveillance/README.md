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

1. **Qui vient du groupe a tout.** Un lien avec `?src=groupe` ouvre l'accès
   illimité : pas de compte, pas de carte, pas de compteur, aucune écriture en
   base. Rien n'est vendu dans le groupe.
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

Puis, pour essayer l'accès communauté : <http://localhost:8788/?src=groupe>.

> `npm run dev` (Astro seul) ne sert **pas** les Pages Functions : le radar et la
> reformulation répondent « indisponible », et c'est normal. C'est `npm run
> preview` qui monte les deux.

La tournée de nuit se déclenche à la main :

```bash
npm run cron
curl "http://localhost:8787/__scheduled?cron=0+4+*+*+*"
```

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
