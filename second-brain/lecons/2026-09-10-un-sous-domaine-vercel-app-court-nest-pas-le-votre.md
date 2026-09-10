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

## Ce qui n'est pas mesuré

Les autres sous-domaines courts du compte n'ont pas été sondés un par un avec
cette grille. `artisan-express-ashy.vercel.app` et `coffre-puce.vercel.app`
portent un suffixe aléatoire, ce qui est justement la marque d'un nom déjà
pris — donc ils sont probablement à nous, mais « probablement » n'est pas une
mesure, et le geste ci-dessus coûte une seconde par adresse.
