# Cœur de calcul du Bilan Patrimoine — copie du lot 1

Ces cinq fichiers (`modeles.ts`, `baremes.ts`, `valorisation.ts`, `constats.ts`,
`redaction.ts`) sont une **copie** de `bilan-patrimoine/src/`, adaptée
seulement pour que `agence/` (résolution de modules `bundler`, sans
`allowImportingTsExtensions`) puisse les importer : les imports internes ont
perdu leur suffixe `.ts`.

**Trois sont figés, deux sont adaptés** — et la phrase « aucune logique n'a
changé » qui figurait ici était fausse, mesurée le 03/09/2026 :

| Fichier | État | Ce qui diffère |
| --- | --- | --- |
| `modeles.ts`, `baremes.ts`, `valorisation.ts` | **figés** | rien, hors imports et commentaires |
| `constats.ts` | adapté | une variable morte du lot 1 n'a pas été recopiée |
| `redaction.ts` | adapté | `premierGesteTexte` exporté au lieu de `premierGeste` interne, table des gestes hissée au module, `null` au lieu d'une chaîne vide |

**Pourquoi une copie plutôt qu'un import inter-projets** : ce dépôt n'a ni
`workspaces` npm ni import relatif entre dossiers de premier niveau nulle
part — chaque projet (`agence/`, `bilan-patrimoine/`, `iptv/`…) est autonome.
Le seul précédent écrit dans ce dépôt pour faire traverser du code entre
projets (le moteur d'alertes du lot 4, `bilan-patrimoine/README.md` §6) dit
« extrait, jamais réécrit » — extraction, pas dépendance vivante. C'est ce
précédent que cette copie suit.

**`bilan-patrimoine/` reste la source de vérité**, avec ses 55 tests.

**Et la resynchronisation à la main a désormais un garde-fou**, parce qu'elle a
échoué dès son premier usage : la copie initiale avait perdu l'espace insécable
de `INSECABLE`, remplacée par une espace ordinaire. La constante ne faisait donc
plus rien — or elle sert de séparateur de milliers *et* de liant avant le
symbole, si bien que « 40 000 € » pouvait se couper en « 40 » puis « 000 € » sur
un téléphone de 393 px. Rien ne le signalait : les deux fichiers compilaient, les
deux rendaient une chaîne, et l'écart tenait à un caractère invisible.

`__tests__/sans-derive.test.ts` relit donc le voisin **en texte** : identité
stricte pour les trois fichiers figés, égalité des **nombres exportés** pour les
deux adaptés, et un contrôle propre sur le point de code d'`INSECABLE` — celui-là
tient même dans un projet client recopié du socle, où le voisin est absent.

## Comment resynchroniser après une mise à jour du lot 1

1. Relire le diff de `bilan-patrimoine/src/{modeles,baremes,valorisation,constats,redaction}.ts`.
2. Reporter les mêmes changements ici, fichier par fichier.
3. Dans les imports internes de ce dossier seulement, ne pas réintroduire le
   suffixe `.ts` retiré à la copie initiale.
4. `npm run typecheck && npm run test` dans `agence/`.

La dérive la plus probable : les huit taux de `baremes.ts` (Livret A, LDDS,
LEP, PEL, fonds euros, inflation), revus une à deux fois par an d'après
`bilan-patrimoine/README.md` §2 — c'est le premier endroit à comparer.
