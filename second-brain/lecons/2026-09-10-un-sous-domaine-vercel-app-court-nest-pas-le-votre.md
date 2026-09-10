# `amorce.vercel.app` n'a jamais été à nous — un sous-domaine court appartient à quelqu'un d'autre

*10/09/2026 — trouvé en faisant la QA du §8 bis sur la production d'Amorce.*

## Le fait, mesuré

```
curl -s https://amorce.vercel.app | grep -o '<title>[^<]*</title>'
<title>IdeaForge — Construis ton projet</title>
```

Ce n'est pas Amorce. C'est le site d'un autre compte Vercel.

Le studio vit à **`https://amorce-erwannchevallier-6916s-projects.vercel.app`**,
et les trois adresses du projet rendent bien le bon titre — l'alias de
production, celui de la branche `main`, et celui du déploiement.

| adresse | titre servi |
| --- | --- |
| `amorce.vercel.app` | *IdeaForge — Construis ton projet* |
| `amorce-erwannchevallier-6916s-projects.vercel.app` | *Amorce — le studio qui rend tes vidéos IA virales* |

## Pourquoi c'est structurel, et pas un accident

Les sous-domaines `*.vercel.app` sont **globaux**, pas propres à un compte : le
premier projet nommé `amorce` sur toute la plateforme a pris `amorce.vercel.app`,
et il n'est pas le nôtre. Ce que Vercel donne à un projet dont le nom est déjà
pris, c'est la forme longue `<projet>-<équipe>.vercel.app`.

C'est exactement pour ça que le tableau de bord n'affiche jamais d'erreur : rien
n'est cassé chez nous. L'adresse courte n'a simplement jamais été assignée au
projet. Et un mot commun — `amorce`, `coffre`, `studio` — a toutes les chances
d'être déjà pris.

## Ce que ça rend faux dans le dépôt

**Trois endroits citent l'adresse courte**, et ils ne coûtent pas la même chose :

1. `comptes-serveur/README.md:41` — `wrangler secret put ADRESSE_SITE` avec
   `"https://amorce.vercel.app"` en exemple. Ce secret **sert à construire le
   lien de connexion envoyé par courriel**. Posé tel quel le jour du
   déploiement, chaque client cliquerait vers le site d'un inconnu. C'est le
   seul des trois qui soit une bombe à retardement plutôt qu'une note d'archive.
2. `second-brain/lecons.md`, leçon « `curl` atteint un site que Chromium ne peut
   pas ouvrir » — la mesure reste juste (elle porte sur le **client**, pas sur
   le site), seul l'hôte cité est mal attribué.
3. `second-brain/lecons.md`, leçon « Un déploiement "Ready" ne dit pas que
   l'adresse le sert » — **et celle-ci a une conclusion incomplète à cause de
   ça**. Voir ci-dessous.

## La leçon du 02/09 qui cherchait au mauvais endroit

Elle constatait, à juste titre, que trois fusions vertes et un déploiement
`Ready` laissaient « l'adresse publique servir la version d'avant ». Elle
énumérait ensuite trois causes à départager : la branche de production n'est pas
celle qu'on fusionne, le domaine est assigné à la main, ou la promotion n'a pas
eu lieu.

**Il en manquait une quatrième, et c'est celle qui était vraie ce jour-là :
l'adresse n'appartient pas au projet.** Aucune des trois autres ne pouvait être
départagée « dans le tableau de bord », puisque le tableau de bord du projet
n'a rien à dire d'un site qui n'est pas le sien.

Le détail qui aurait dû mettre la puce à l'oreille était déjà dans les mesures
de l'époque : `age: 19192`, soit une réponse vieille de cinq heures **sur une
adresse qu'aucun de nos déploiements ne touchait**. Un cache de bordure vieux de
cinq heures sur un site qui reçoit trois fusions dans la journée n'est pas un
cache lent, c'est un autre site.

## La règle qui se généralise

**Avant de croire qu'une adresse est la sienne, lui demander son titre.** Une
requête, et elle départage ce qu'aucun statut de déploiement ne dira jamais :

```bash
curl -s https://<adresse> | grep -o '<title>[^<]*</title>'
```

Le dépôt savait déjà qu'« un déploiement `Ready` ne dit pas ce qu'une adresse
rend ». Il manquait le cran d'en dessous : **une adresse ne dit pas non plus à
qui elle est.** Les deux se mesurent séparément, et la seconde est la plus
sournoise des deux — parce que l'adresse répond 200, se charge vite, et
ressemble à un site fini.

## Sondé ensuite : aucun nom court n'est à nous

La règle a été vérifiée sur les autres adresses citées dans le dépôt, le même
jour, en croisant le titre servi avec les `domains` que le connecteur Vercel
donne pour chaque projet.

| adresse courte | ce qu'elle sert | à nous ? |
| --- | --- | --- |
| `amorce.vercel.app` | *IdeaForge — Construis ton projet* | **non** |
| `artisan-express.vercel.app` | *Artisan Express — Plombier à Bordeaux* | **non** — le projet ne porte que les formes longues |
| `iptv.vercel.app` | *iptv-online* | **non** |
| `amorce-51up.vercel.app` | 404 | projet supprimé le 03/09 |
| `reseau-annuaires.vercel.app` | 404 | projet supprimé le 03/09 |
| `artisan-express-ashy.vercel.app` | *Site vitrine artisan express — 300 €* | **oui** |
| `coffre-puce.vercel.app` | *Le Tiroir Secret* | **oui** |

**Le cas d'`artisan-express` est le plus instructif des trois.** Son README
écrit qu'`artisan-express.vercel.app` « n'a jamais existé » — une adresse par
défaut inventée dans `layout.tsx`, qu'une session avait lue comme une preuve de
mise en ligne. Elle **existe** aujourd'hui et sert une page qui ressemble à
notre marchandise, au point qu'on serait tenté d'aller corriger le README. Elle
n'est toujours pas à nous : `get_project` ne lui donne que
`artisan-express-erwannchevallier-6916s-projects.vercel.app` et sa jumelle en
`-git-main`. **Une adresse qui sert un contenu plausible n'est pas une preuve de
possession** ; les `domains` du projet en sont une.

**La forme qui vaut, donc :** toutes nos adresses Vercel sans domaine propre
s'écrivent `<projet>-erwannchevallier-6916s-projects.vercel.app`, ou portent un
suffixe aléatoire (`-ashy`, `-puce`) pour un dépôt de fichiers. Un
`<projet>.vercel.app` nu n'est à nous dans **aucun** cas mesuré ici.

## Ce qui n'est pas mesuré

Le contenu servi par ces trois sites tiers n'a pas été examiné au-delà de son
titre, et rien ne dit qu'il restera le même. Le point de la leçon ne porte pas
sur eux : il porte sur nous, et sur l'écart entre une adresse qui répond et une
adresse qui nous appartient.
