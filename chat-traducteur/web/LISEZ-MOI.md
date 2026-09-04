# Le cœur du traducteur, en TypeScript

Ce dossier est le **portage du noyau Python vers le navigateur**. Il ne
remplace rien : `noyau/` et `habillage/` restent la référence, et ce code-ci
est tenu honnête par des témoins engendrés depuis eux.

## Pourquoi un portage plutôt qu'une application native

Mesuré le 04/09/2026 dans la session qui l'a écrit : **Flutter, Dart et `adb`
sont absents** de l'environnement d'exécution. Une application native ne peut y
être ni construite ni regardée — or le §8 exige de regarder, pas seulement de
mesurer. Node 22 et Chromium sont là, donc une application web se vérifie ici.

Ce n'est pas qu'un choix par défaut : `licence-serveur/` sait déjà vendre un
produit qui tourne dans le navigateur, et « rien ne quitte l'appareil » est un
argument sur une application qui écoute chez les gens.

**La question du natif n'est pas tranchée pour autant.** Elle se posera le jour
où il faudra un magasin d'applications, et elle demandera une machine qui a
Flutter.

## Ce que ce dossier contient, et ce qu'il ne contient pas

| | |
| --- | --- |
| **Contient** | la porte, les deux étages, la tête acoustique, l'autocorrélation, l'habillage, la carte SVG 1080 × 1920 |
| **Ne contient pas** | **le modèle**. Rien ici ne produit les 521 scores de YAMNet |

C'est la couture, et elle est nette : tout ce qui décide part de
`fenetres: Record<string, number>[]`. Le jour où le modèle tourne dans le
navigateur, il se branche là et rien d'autre ne bouge. Tant qu'il n'y est pas,
**ce dossier ne fait pas une application** — il en fait la moitié qui décide.

## Les témoins de conformité, et pourquoi ils décident de tout

Un portage ne se relit pas, il se compare.

```bash
npm run temoins   # engendre temoins/cas.json depuis le noyau Python
npm test          # rejoue les mêmes entrées et exige les mêmes sorties
```

`tests/conformite.test.ts` ne contient **aucune valeur écrite à la main** :
tout vient de `temoins/cas.json`, produit en faisant tourner le Python. Écrire
les attentes à la main aurait donné un test qui vérifie ce que son auteur
croyait — la faute que ce projet a payée quatre fois.

La comparaison la plus sévère porte sur le **SVG entier**, au caractère près :
un arrondi qui diverge, une découpe de ligne différente ou une teinte recopiée
de travers s'y voient immédiatement.

**Relancer `npm run temoins` après toute modification du noyau Python.** Des
témoins périmés rendent un test vert sur un portage faux.

## Deux pièges mesurés, tous deux payés ici

### `enum` ne survit pas au retrait de types

Ce dépôt exécute son TypeScript par **simple retrait des types** — la
convention de `bilan-patrimoine/`, du cœur d'IPTV et des deux serveurs. Or un
`enum` n'est pas un type : il produit du code à l'exécution, et Node le refuse
en clair, `TypeScript enum is not supported in strip-only mode`.

La parade est un objet `as const` doublé d'un type du même nom, qui rend
exactement le même usage (`Intention.DEMANDE`, `Record<Intention, …>`). Elle
vaut pour tout projet de ce dépôt, pas seulement pour celui-ci.

### Le `tsconfig.json` de la racine avale ces fichiers

Son `include` vaut `**/*.ts` avec une liste d'exclusions nommées, où figurent
les cinq autres projets à pile propre. Ce dossier n'y est pas, et le `tsc` de
la racine compte donc **huit fichiers d'ici** dans le projet d'Amorce.

**Mesuré le 04/09/2026 : ça ne casse rien aujourd'hui**, zéro erreur. La dette
est écrite parce qu'elle mordra plus tard, et ailleurs : le jour où un fichier
d'ici touchera une API de navigateur que la configuration racine n'accepte pas,
c'est le typecheck **d'Amorce** qui deviendra rouge, pour une raison que
personne n'ira chercher dans `chat-traducteur/`.

Le correctif tient en un mot ajouté à `exclude`. Il n'a pas été fait ici parce
que `tsconfig.json` est une zone sensible au sens de `CLAUDE.md`, et qu'aucune
urgence ne justifiait d'en demander l'accord.
