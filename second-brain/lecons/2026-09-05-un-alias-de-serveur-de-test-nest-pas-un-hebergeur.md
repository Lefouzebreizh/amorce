# Un serveur d'épreuve qui reconstitue les chemins ne prouve rien sur l'hébergement

*05/09/2026 — trouvé en mettant en ligne l'application du traducteur de chat.*

## Ce qui a été mesuré

`chat-traducteur/web/outils/epreuve.mjs` conduit l'application dans un vrai
Chromium depuis un an de mesures fiables : 521 scores comparés au Python au bit
près, la chaîne complète depuis un fichier, le micro simulé. Tout vert.

Et l'application n'était servable nulle part.

Son serveur porte une table d'alias qui fait **exister** `./tf/tf-core.js` et
`./wasm/` sans qu'aucun fichier soit à ces endroits — ils sont montés à la volée
depuis `node_modules`. C'est un choix défendable et écrit en clair dans le
fichier : ne pas recopier 45 Mo, parce qu'une copie se périme. Mais il a une
conséquence que personne n'avait tirée : **le serveur d'épreuve n'est pas
l'hébergeur en petit.** Il est plus capable que lui.

## Ce que ça a coûté, et ce qui l'a attrapé

Un second serveur, qui sert le dossier assemblé **à plat** et compte les 404, a
trouvé en un passage ce qu'aucun test unitaire ne pouvait voir :

    ✗ 2 fichier(s) manquant(s) : /donnees/etiquettes.json, /favicon.ico

`donnees/etiquettes.json` porte les 521 étiquettes d'AudioSet et se charge par
`fetch`, **pas par une balise** — il est donc invisible à la lecture de
`index.html`, qui est exactement comme on écrit une liste de fichiers à copier.
Sans lui la page se charge, le bouton répond, et le premier son reste sans
verdict pour toujours. Aucune erreur, aucun symptôme lisible.

## La règle

**Un test qui fabrique son environnement ne mesure pas le déploiement.** Dès
qu'un projet passe de « ça tourne » à « c'est en ligne », il lui faut une
épreuve qui parte du **tas de fichiers réel** et qui échoue sur un 404 — pas
seulement une qui parte du code.

Le corollaire pratique, et il est bon marché : **compter les 404 dans le serveur
d'épreuve**. Trois lignes, et c'est la seule chose qui distingue un dossier
complet d'un dossier plausible.

## Le 404 qu'il faut nommer, pas taire

Il en reste un, et il est bénin — mais bénin **parce qu'on l'a mesuré**, pas
parce qu'il en avait l'air :

| instant | requête |
| --- | --- |
| 826 ms | `404 /tf/tflite_web_api_cc_simd.js` — sonde de `tf-tflite.js` à côté de lui-même |
| 879 ms | l'application se déclare prête |
| 1296 ms | `200 /wasm/tflite_web_api_cc_simd.js` — le vrai, après `setWasmPath` |

`setWasmPath` vit dans `ouvrir()`, donc après le chargement du script : la
bibliothèque cherche d'abord au chemin par défaut. L'épreuve tolère ce
404-**là**, nommément, et refuse tous les autres. Une liste de 404 tolérés sans
raison écrite finit par tout tolérer, et c'est ainsi qu'un fichier vraiment
manquant passe.
