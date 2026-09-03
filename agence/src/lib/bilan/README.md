# Cœur de calcul du Bilan Patrimoine — copie du lot 1

Ces cinq fichiers (`modeles.ts`, `baremes.ts`, `valorisation.ts`, `constats.ts`,
`redaction.ts`) sont une **copie** de `bilan-patrimoine/src/`, adaptée
seulement pour que `agence/` (résolution de modules `bundler`, sans
`allowImportingTsExtensions`) puisse les importer : les imports internes ont
perdu leur suffixe `.ts`. Aucune logique n'a changé.

**Pourquoi une copie plutôt qu'un import inter-projets** : ce dépôt n'a ni
`workspaces` npm ni import relatif entre dossiers de premier niveau nulle
part — chaque projet (`agence/`, `bilan-patrimoine/`, `iptv/`…) est autonome.
Le seul précédent écrit dans ce dépôt pour faire traverser du code entre
projets (le moteur d'alertes du lot 4, `bilan-patrimoine/README.md` §6) dit
« extrait, jamais réécrit » — extraction, pas dépendance vivante. C'est ce
précédent que cette copie suit.

**`bilan-patrimoine/` reste la source de vérité**, avec ses 55 tests. Cette
copie est un instantané figé, à resynchroniser à la main.

## Comment resynchroniser après une mise à jour du lot 1

1. Relire le diff de `bilan-patrimoine/src/{modeles,baremes,valorisation,constats,redaction}.ts`.
2. Reporter les mêmes changements ici, fichier par fichier.
3. Dans les imports internes de ce dossier seulement, ne pas réintroduire le
   suffixe `.ts` retiré à la copie initiale.
4. `npm run typecheck && npm run test` dans `agence/`.

La dérive la plus probable : les huit taux de `baremes.ts` (Livret A, LDDS,
LEP, PEL, fonds euros, inflation), revus une à deux fois par an d'après
`bilan-patrimoine/README.md` §2 — c'est le premier endroit à comparer.
