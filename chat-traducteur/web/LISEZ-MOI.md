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
| **Ne contient pas** | ~~le modèle~~ — il tourne depuis le 04/09/2026, voir plus bas |

C'est la couture, et elle est nette : tout ce qui décide part de
`fenetres: Record<string, number>[]`. Le modèle s'y branche par
`adaptateurs/yamnet.ts` et rien d'autre n'a bougé — c'est ce qu'une couture
doit faire.

## Le modèle tourne dans le navigateur, et c'est mesuré

Le même vecteur de 15 600 échantillons dans les deux moteurs — le
`ai_edge_litert` de Python et le WASM de `@tensorflow/tfjs-tflite` conduit par
un vrai Chromium :

    écart maximum sur les 521 classes : 0.000e+0

Bit pour bit, sur quatre signaux et sept fenêtres. C'est ce qui autorise à
parler d'**un** produit plutôt que de deux : tout ce que le corpus Python a
mesuré — le plancher de `Caterwaul`, la classe muette `Hiss`, le bâillement
rangé en rugissement — vaut ici sans être remesuré.

```bash
npm run bati       # tsc vers dist/, ce que le navigateur charge
npm run epreuve    # Chromium + le vrai modèle, comparés au Python
```

L'épreuve rend **3** — « non effectué » — quand Chromium, le modèle ou les
dépendances manquent, et écrit alors sa propre raison. Le compter vert serait
une mesure qui n'a rien mesuré ; le compter rouge punirait le code d'un manque
de la machine.

### Deux choses à savoir avant d'y toucher

**`tfjs-tflite` épingle exactement `tfjs-core@4.9.0`.** Installer le `^4.22.0`
courant fait échouer `npm install` sur un `ERESOLVE`. Ni `--force` ni
`--legacy-peer-deps` : les versions sont fixes dans le `package.json`, alignées
sur ce que l'alpha exige.

**Les WASM sont livrés dans le paquet npm.** `setWasmPath` sur un dossier local
suffit : aucun CDN n'est joint, ce qui compte doublement ici — le mandataire les
refuse tous, et le produit promet que rien ne quitte l'appareil.

### Ce que cette mesure ne couvre pas

Les quatre signaux sont **fabriqués** — un accord, du silence, un bruit, un
glissando. Aucun n'est un chat, et ce n'est pas le sujet : l'épreuve compare
deux moteurs, elle ne mesure pas la justesse de YAMNet. La chaîne complète sur
un vrai enregistrement, du micro à la carte, **n'a pas encore été éprouvée dans
le navigateur** — c'est le prochain lot, et il attend le corpus décrit dans
`../CORPUS.md`.

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
