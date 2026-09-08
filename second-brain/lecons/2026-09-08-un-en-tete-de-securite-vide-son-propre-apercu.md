# Un en-tête de sécurité vide son propre aperçu, et rien ne le dit

*08/09/2026 — trouvé sur `artisan-express/`, vaut pour tout projet qui pose ses
propres en-têtes.*

## Ce qui a été mesuré

La page de vente montre désormais un aperçu **vivant** de chaque site livré :
un `<iframe>` qui charge `/modeles/<metier>.html` plutôt qu'une capture
d'écran, laquelle se périmerait au premier changement de charte sans que
personne le voie — et que l'invariant « aucun binaire versionné » interdit de
toute façon.

Les sept cadres étaient **vides**. Un rectangle blanc et l'icône de document
cassé du navigateur.

Ce qui disait vert au même instant :

| contrôle | verdict |
| --- | --- |
| `lint`, `typecheck` | vert |
| 73 tests | vert |
| `build` | vert |
| les sept `iframe` présents dans le DOM | oui |
| leurs dimensions rendues | justes, au pixel |

La cause : `next.config.ts` posait `X-Frame-Options: DENY` sur `/:path*`,
c'est-à-dire sur **tout le site, y compris pour lui-même**. `DENY` n'a pas de
notion de « sauf moi » — c'est `SAMEORIGIN` qui l'a.

## Le second piège, dans la correction elle-même

La règle corrigée a été posée en premier dans le tableau, la générale ensuite.
Les en-têtes rendus disaient toujours `DENY` sur les deux chemins.

**Next.js n'arrête pas au premier bloc qui correspond : il applique tous ceux
qui correspondent, dans l'ordre, et le dernier gagne sur une clé déjà posée.**
Un `/:path*` placé après reprend donc `/modeles/...` au passage et écrase ce
qu'on venait de lui donner. Le motif général doit **exclure** le cas
particulier — `'/((?!modeles/).*)'` — et non compter sur sa position.

Le geste qui tranche tient en une ligne, et il porte sur ce que le serveur
rend, jamais sur ce que le fichier de configuration a l'air de dire :

```bash
curl -s --noproxy '*' -D - -o /dev/null http://localhost:PORT/le/chemin | grep -i x-frame
```

## Pourquoi c'est plus général qu'un défaut de cadre

C'est la forme habituelle de ce dépôt sous un habit neuf : **une mesure juste
sur le mauvais objet**. Les sept cadres étaient bien là, bien dimensionnés,
bien chargés — on mesurait le *conteneur*, quand le défaut était dans la
*réponse HTTP*. Un test d'intégration ne l'aurait pas vu davantage : il n'y
avait rien à assertir côté DOM.

Ce qui l'a trouvé est le « regardé, pas seulement mesuré » du §8, sans
variante : une capture d'écran, ouverte, regardée.

La famille à laquelle ce défaut appartient — un en-tête de sécurité posé
largement qui casse un usage légitime du même site — se reconnaît à ceci :
**la panne est silencieuse côté serveur et visible seulement à l'œil**. Aucun
`4xx`, aucune trace, aucune exception. Le navigateur refuse d'afficher et n'en
parle qu'à sa console. Même forme pour une politique de sécurité de contenu qui
oublie une source, ou un `Referrer-Policy` qui casse une intégration.

## Ce que ça ne dit pas

L'assouplissement n'était licite que parce que ces six pages sont **statiques,
sans formulaire, sans session et sans une ligne de JavaScript** : le
détournement de clic qu'un `X-Frame-Options` traite n'a rien à y détourner. Le
`DENY` reste sur tout le reste, page de vente et formulaire de devis compris,
qui sont les seuls endroits où un clic a une conséquence. Assouplir par défaut
pour faire marcher un aperçu serait la mauvaise leçon.

*Écrit sur `claude/refonte-socle-visuel`, PR #818.*
