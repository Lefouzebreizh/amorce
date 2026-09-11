# `ssoProtection: all_except_custom_domains` ne protège pas tous les alias `.vercel.app`

Mesuré le 11/09/2026, en créant le projet Vercel `psy-ia` pour une adresse de
travail privée demandée explicitement pour un aperçu interne, jamais public.

## Ce qui a été mesuré

À la création, un projet Vercel neuf porte `ssoProtection: enabled,
all_except_custom_domains` — c'est la valeur que ce dépôt tenait déjà pour
suffisante (voir `CLAUDE.md`, section Déploiements Vercel : « le réglage
`ssoProtection` à `all_except_custom_domains` met **toutes** les adresses en
`.vercel.app` derrière l'authentification du compte »).

`psy-ia` a reçu trois alias : deux préfixés par le nom d'équipe
(`psy-ia-erwannchevallier-6916s-projects.vercel.app`,
`…-git-main-…vercel.app`) et un alias court, suffixé au hasard parce que
`psy-ia.vercel.app` était déjà pris ailleurs (`psy-ia-ecru.vercel.app`) —
même piège que `amorce-five.vercel.app`, déjà connu.

Avec `all_except_custom_domains` :

| Alias | Réponse |
| --- | --- |
| `psy-ia-erwannchevallier-6916s-projects.vercel.app` | 302 vers `vercel.com/sso-api` |
| `psy-ia-git-main-erwannchevallier-6916s-projects.vercel.app` | 302 vers `vercel.com/sso-api` |
| **`psy-ia-ecru.vercel.app`** | **200 — la page réelle servie en clair, cache Vercel `HIT`** |

Le contenu servi était bien le nôtre (`data-dpl-id` identique au déploiement
créé), pas un site tiers. L'alias court, celui qu'on aurait donné au
propriétaire pour un accès rapide, était donc le seul des trois à fuir.

## Le correctif, et ce qu'il révèle

`update_project_deployment_protection` avec `ssoProtection.deploymentType:
"all"` (au lieu de `all_except_custom_domains`) a fermé l'alias court —
revérifié quatre requêtes de suite, 302 à chaque fois, plus aucune fuite de
contenu.

Donc **`all_except_custom_domains` et `all` ne sont pas équivalents pour
l'alias court sans domaine personnalisé** — alors que les deux couvrent la
même famille de domaines (`*.vercel.app`, aucun n'est un domaine
personnalisé). La différence exacte entre les deux valeurs n'a pas été
creusée plus loin ; ce qui est acquis est la conséquence pratique, pas
l'explication interne de Vercel.

## Ce que ça change dans ce dépôt

La phrase de `CLAUDE.md` qui dit que `all_except_custom_domains` protège
« toutes les adresses en `.vercel.app` » est **incomplète** — elle protège
certains alias, pas nécessairement l'alias court. **Tout projet dont l'accès
doit rester privé doit vérifier son alias court spécifiquement (celui sans
préfixe d'équipe ni suffixe de branche), pas seulement se fier au champ
`ssoProtection.enabled` ou à un des deux alias préfixés.** Une vérification
qui ne teste que l'alias préfixé par l'équipe passerait à côté de ce défaut
exactement comme celle qui a suivi cette découverte.

Reste à vérifier, et non fait ici faute de nécessité immédiate : si les
projets déjà branchés du dépôt (`amorce`, `iptv`, `coffre`,
`chat-traducteur`, `artisan-express`) qui n'ont pas vocation à être privés
ont ce même comportement sur un alias court — sans conséquence pour eux
puisqu'ils sont voulus publics, mais la mesure vaudrait si un futur projet
doit rester privé.
