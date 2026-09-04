# Un témoin qui diverge accuse d'abord le témoin

*04/09/2026 — mesuré en faisant tourner YAMNet dans un navigateur.*

## Ce qui a été mesuré

Le même vecteur de 15 600 échantillons, passé dans deux moteurs TFLite — le
`ai_edge_litert` de Python et le WASM de `@tensorflow/tfjs-tflite` conduit par
un vrai Chromium — rend **exactement les mêmes 521 scores** :

    écart maximum sur les 521 classes : 0.000e+0

Bit pour bit, sur quatre signaux et sept fenêtres. Ce n'était pas acquis : un
moteur WASM et une bibliothèque native peuvent différer sur le dernier bit
d'une multiplication flottante, et l'usage aurait été d'accepter un epsilon.

**Accepter un epsilon aurait coûté la leçon qui suit.**

## Le piège, avec sa cause

Au premier passage, trois signaux sur quatre étaient identiques et le
quatrième affichait un écart de **1,7e-1** — énorme, pas un arrondi. Le
réflexe était de mettre en cause le moteur alpha, qui en porte l'air :
`0.0.1-alpha.10`.

Le moteur n'y était pour rien. Le signal fautif était un bruit engendré par
congruence linéaire, avec le multiplicateur classique 1103515245 :

```
1103515245 × état  vaut jusqu'à  1,6e18
JavaScript compte juste jusqu'à  9,0e15
```

Python calcule en entiers exacts, JavaScript arrondit **en silence** dès qu'on
dépasse 2^53. Les deux langages produisaient donc deux bruits différents, et
comparaient fidèlement deux choses qui n'étaient pas les mêmes. Mesuré : au
troisième tirage, Python dit `1449466924`, JavaScript dit `1358247936`.

La parade tient au choix du multiplicateur — MINSTD, 48271 modulo 2^31−1, dont
le produit plafonne à 1,04e14. Les quatre signaux sont passés à zéro d'écart.

## Ce qu'il faut en retenir, et qui dépasse ce projet

**Quand un témoin diverge, le suspect numéro un est le témoin.** Un banc de
comparaison a deux moitiés : ce qu'on éprouve, et ce qui fabrique l'entrée. La
seconde est écrite à la va-vite parce qu'elle « ne fait que produire des
données », et c'est précisément pour ça qu'elle est fausse plus souvent.

**Et c'est la tolérance zéro qui l'a montré.** Un epsilon de 1e-3 aurait
masqué l'écart de 1,7e-1 ? Non — mais il aurait masqué les cas suivants, et
surtout il aurait autorisé à ne pas chercher. Une comparaison exacte force à
expliquer chaque divergence, et l'explication est parfois que le banc est
cassé. Là où deux implémentations doivent rendre la même chose, **exiger le
bit** coûte une enquête et rend une certitude ; tolérer un voisinage coûte
zéro et ne rend rien.

## Un troisième constat, sur le paquet lui-même

`@tensorflow/tfjs-tflite@0.0.1-alpha.10` **épingle exactement**
`@tensorflow/tfjs-core@4.9.0` en dépendance de pair. Installer le `^4.22.0`
courant fait échouer `npm install` sur un `ERESOLVE`. Il ne faut ni forcer ni
`--legacy-peer-deps` : s'aligner sur ce que l'alpha exige, et l'écrire dans le
`package.json` en version fixe.

Et la crainte principale n'était pas fondée : **les fichiers WASM sont livrés
dans le paquet npm**. `setWasmPath` sur un dossier local suffit, aucun CDN
n'est joint — ce qui compte doublement ici, où le mandataire les refuse tous
et où le produit promet que rien ne quitte l'appareil.
