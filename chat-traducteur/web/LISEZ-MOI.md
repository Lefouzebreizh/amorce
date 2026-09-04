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

## L'application, et ce qu'on a vu en la regardant

`page/index.html` est l'application : un bouton, un repli par fichier, la
carte, un bouton pour l'enregistrer. Elle n'a **aucune logique de décision** —
elle branche des pièces déjà éprouvées. Si une intention paraît fausse, ce
n'est pas là qu'il faut chercher.

```bash
npm run temoins:chaine   # engendre le WAV d'épreuve et la référence Python
npm run bati && npm run epreuve
```

L'épreuve la conduit à **393 × 873**, le terrain de référence, part d'un
**fichier** et compare au Python — ce qui fait entrer le décodage, le
rééchantillonnage et le fenêtrage dans la comparaison, la partie que les
témoins précédents ne couvraient pas. Trois fenêtres des deux côtés, même
verdict, même phrase.

**Et un défaut n'est sorti que du regard.** Toutes les mesures étaient vertes,
et la capture montrait le bouton « Enregistrer la carte » **sous la ligne de
flottaison** : un aperçu 9:16 large de 300 px en fait 533 de haut, si bien
qu'il fallait défiler pour trouver le bouton qui fait exactement ce pour quoi
le produit existe. L'aperçu est désormais borné en **hauteur** — `min(42dvh,
380px)` — et tout tient sur un écran.

## L'épreuve sur des vrais chats — 04/09/2026

Les épreuves ci-dessus comparent deux moteurs sur des signaux **fabriqués**, au
bit près. Celle-ci pose l'autre question, la seule qui compte pour quelqu'un qui
appuie sur le bouton : **les deux chaînes concluent-elles la même chose sur du
son réel ?**

```bash
python3 ../scripts/mesurer_esc50.py        # récupère 40 chats + 20 témoins
npm run temoins:corpus                     # la référence, par le noyau Python
npm run bati && npm run epreuve:corpus
```

**60 verdicts identiques sur 60.**

Ce n'était pas acquis, et c'est même le contraire d'un bit à bit : les fichiers
sont en 44,1 kHz, donc ffmpeg les rééchantillonne d'un côté et le navigateur de
l'autre, avec deux filtres différents. Les décimales divergent ; **la décision
ne bouge pas**. Exiger le bit ici reviendrait à exiger que deux filtres soient
le même filtre.

Le corpus n'est pas versionné — CC BY-NC, et binaire. L'épreuve rend **3**,
« non effectué », quand il manque, et **dit laquelle des six pièces manque** —
éprouvé en retirant la référence, puis le corpus.

**Elle n'est pas branchée dans `verifier.sh`, et c'est délibéré.** Soixante
fichiers passés dans un modèle WASM prennent plusieurs minutes, là où toute la
barrière du dépôt tient en quelques secondes. Une vérification qu'on n'ose plus
lancer parce qu'elle est longue finit par ne plus être lancée du tout, et
c'est pire qu'une vérification absente : on croit qu'elle tourne. Celle-ci se
lance à la main, quand la règle de lecture bouge — c'est-à-dire exactement
quand elle sert.

### Ce que cette mesure ne couvre pas

Les quatre signaux sont **fabriqués** — un accord, du silence, un bruit, un
glissando. Aucun n'est un chat, et ce n'est pas le sujet : l'épreuve compare
deux moteurs, elle ne mesure pas la justesse de YAMNet. La chaîne complète sur
un vrai enregistrement, du micro à la carte, **n'a pas encore été éprouvée dans
le navigateur** — c'est le prochain lot, et il attend le corpus décrit dans
`../CORPUS.md`.

**Le micro, lui, est éprouvé depuis le 04/09/2026 — mais pas de la même
façon, et la nuance est le sujet.** Chromium rejoue un fichier à la place du
matériel (`--use-file-for-fake-audio-capture`), ce qui rend `getUserMedia`
mesurable sans micro et sans clic.

Cette épreuve-là ne compare **rien** au Python, et c'est délibéré : une
capture passe par le rééchantillonnage de l'appareil — 48 kHz — puis par un
encodage Opus avec perte. Exiger l'égalité serait exiger l'impossible. Ce
qu'elle prouve est plus modeste et n'était pas prouvé : `getUserMedia`,
`MediaRecorder`, le décodage, le retour à 16 kHz et le fenêtrage
s'enchaînent pour de bon, et l'application rend un verdict au lieu de rester
muette.

**Elle a été verte à tort d'abord, et il faut savoir pourquoi.** Le premier
jet lisait `dernierVerdict()` sans remettre l'état à zéro : la boucle
d'attente sortait aussitôt sur le verdict de l'étape *précédente*, et
l'épreuve annonçait « contentement » sur un glissando. Impossible, et verte.
Ce qui l'a fait voir n'est aucun test : c'est d'avoir lu le résultat et de
l'avoir trouvé absurde. L'épreuve recharge désormais la page avant de
mesurer, ce qui repart d'un état vierge et éprouve en prime
l'initialisation.

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
