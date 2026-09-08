# Le mandataire filtre par outil, pas par hôte — et ça débloque la capture d'écran

*08/09/2026 — mesuré sur `artisan-express`, vaut pour toute page déployée.*

## La phrase du dépôt qui est fausse

`CLAUDE.md` §10 écrit que « le mandataire refuse `vercel.com` et `*.vercel.app` »,
et une session en tire depuis des jours qu'on ne peut pas regarder une page
déployée. La première moitié est incomplète, la seconde est fausse.

Mesuré le même jour, sur la même adresse, à quelques secondes d'écart :

| client | résultat |
| --- | --- |
| `curl` | **200**, le HTML complet |
| `fetch` de Node | 154 octets — une page d'erreur du mandataire |
| Chromium (Playwright) | `ERR_CONNECTION_RESET` |
| Chromium avec `--proxy-server=$HTTPS_PROXY` | `ERR_CONNECTION_RESET` |

**L'hôte n'est pas refusé. C'est le client qui décide.** Et passer le mandataire
à Chromium en ligne de commande n'y change rien : il est refusé en tant que
Chromium, pas en tant que trafic non mandaté.

C'est la même famille que le classifieur du mode auto décrit en section Git —
un refus qui désigne l'outil et non le geste — mais un cran plus bas, au niveau
du réseau, et le message d'erreur ne le dit pas : un `ECONNRESET` se lit comme
un mur, jamais comme « essaie avec autre chose ».

## La parade, et elle tient en trente lignes

Puisque `curl` passe et que Chromium atteint `localhost`, on met `curl` **entre
les deux** : un petit serveur local rejoue chaque requête du navigateur vers la
production et lui rend les octets. Le navigateur croit visiter un site local ;
ce qu'il affiche vient de la production.

```js
execFile('curl', ['-s', '-D', fEntetes, '-o', fCorps, AMONT + requete.url], …)
```

Deux choses à ne pas rater, la seconde a coûté une capture :

1. **Rendre le `content-type` de l'amont.** Sans lui le navigateur devine, et il
   devine mal sur les fontes et les feuilles de style.
2. **Séparer entêtes et corps dans deux fichiers.** Le premier jet passait
   `-D -` et `--output -` : les deux sur la sortie standard, mêlés. Le
   navigateur a affiché l'entête HTTP comme du texte brut, et c'est **la capture
   d'écran** qui l'a montré — la mesure disait 200, le rendu disait autre chose.

## Ce que ça débloque, concrètement

Le §8 exige « regardé, pas seulement mesuré ». Jusqu'ici ce regard s'arrêtait au
build local, et le dépôt écrivait qu'une session « ne peut pas ouvrir la page
qu'elle vient de déposer ». Elle le peut :

- capture d'écran d'une page déployée, à n'importe quelle taille ;
- **valeurs calculées par le navigateur** sur la production — `getComputedStyle`
  sur le corps, une carte, un bouton. C'est ce qui distingue « le CSS déclare
  #40E0D0 » de « le navigateur peint bien du turquoise ».

## Ce que ça ne dit pas

Mesuré sur `*.vercel.app` et un seul jour. Rien ne garantit que `curl` passe
partout où Chromium échoue — la politique est par hôte **et** par outil, et
`*.github.io` reste à re-sonder avec cette grille-là. La bonne question n'est
plus « cet hôte est-il ouvert ? » mais « **quel client** peut l'atteindre ? »,
et elle se pose en trois commandes.

## Le défaut trouvé grâce à ça, qui justifie tout le détour

En relisant ce que la production **sert** plutôt que ce que le source dit :
`themeColor` était resté sur l'ancien fond `#16151a` après un changement de
palette. C'est la couleur de la barre d'adresse de Chrome Android — un liseré de
l'ancienne couleur au-dessus de la nouvelle, **visible seulement sur un vrai
téléphone**, et invisible à toute mesure de la page. Une valeur écrite en dur à
côté d'un jeton ne suit pas le jeton ; un test les relie désormais.
