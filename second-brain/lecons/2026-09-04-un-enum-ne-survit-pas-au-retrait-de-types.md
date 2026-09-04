# Un `enum` ne survit pas au retrait de types

*04/09/2026 — mesuré en portant le cœur du traducteur de chat en TypeScript.*

## Ce qui a été mesuré

Node refuse d'exécuter un fichier TypeScript contenant un `enum`, en clair :

```
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]:
TypeScript enum is not supported in strip-only mode
```

La cause tient en une phrase : **un `enum` n'est pas un type.** Il produit du
code à l'exécution — un objet, et sa table inverse. Le retrait de types se
contente d'effacer ce qui est purement déclaratif ; il ne sait rien fabriquer.

La parade rend exactement le même usage et coûte trois lignes :

```ts
export const Intention = { DEMANDE: "demande", STRESS: "stress" } as const;
export type Intention = (typeof Intention)[keyof typeof Intention];
```

`Intention.DEMANDE` marche, `Record<Intention, …>` marche, et le fichier
s'exécute sans compilation.

## Pourquoi ça dépasse le projet où c'est arrivé

Ce dépôt n'a pas d'étape de compilation TypeScript hors Next.js. `bilan-patrimoine/`
se décrit lui-même comme « exécuté par simple retrait des types », le cœur
d'IPTV suit la même mesure, et les deux serveurs aussi. **Toute session qui
écrit un `enum` dans l'un d'eux casse son exécution**, alors que `tsc --noEmit`
reste parfaitement vert : le typecheck n'a aucune raison de s'en plaindre.

C'est la forme de défaut la plus coûteuse de ce dépôt, et la troisième fois
qu'elle se présente sous un autre visage : **l'outil qui vérifie et l'outil qui
exécute ne regardent pas la même chose.** Un test écrit sur l'ancienne barre de
contraste restait vert ; un `max()` sur des rangs différents rendait un verdict
plausible ; ici le typecheck valide un fichier que le moteur refuse d'ouvrir.

## Le second constat de la même séance, et il se lit à l'envers

Le `tsconfig.json` de la racine porte `include: ["**/*.ts", …]` avec une liste
d'exclusions **nommées** — six projets à pile propre y figurent. Un projet
TypeScript neuf qui n'y est pas ajouté est donc **avalé par le projet
TypeScript d'Amorce**.

Ce qui a été mesuré, et la nuance est le sujet : `tsc --listFilesOnly` compte
bien les huit fichiers du nouveau dossier, **et `tsc --noEmit` ne rend aucune
erreur**. L'absorption est réelle, la casse ne l'est pas.

La première rédaction de ce paragraphe annonçait que le typecheck de la racine
casserait, et allait jusqu'à demander l'accord du propriétaire pour toucher une
zone sensible — pour un correctif dont rien ne prouvait le besoin. **Avoir
mesuré l'absorption ne dit rien de la casse**, et les deux se confondent
d'autant plus facilement que la conclusion paraît évidente.

La dette existe et se réveillera ailleurs : le jour où un fichier de ce dossier
touchera une API de navigateur que la configuration racine refuse, c'est le
typecheck **d'Amorce** qui deviendra rouge, pour une cause que personne n'ira
chercher là. Elle est donc écrite là où le prochain la lira, dans le
`LISEZ-MOI.md` du dossier concerné, avec son correctif d'une ligne.
