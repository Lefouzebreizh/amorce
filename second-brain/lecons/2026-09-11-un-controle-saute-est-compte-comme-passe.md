# Un contrôle sauté est compté comme passé

*11/09/2026 — Amorce, en vérifiant un changement de niveaux sonores avant de le fusionner.*

## Ce qui a été mesuré

Le parcours complet d'Amorce rend un bilan chiffré. Sur le runner GitHub, pour
la même version du code :

```
—    | Cadence non mesurée (ffprobe absent)
—    | Images vides non mesurées (ffmpeg absent)
—    | Silence non mesuré (ffmpeg absent)
—    | Vrai pic non mesuré (ffmpeg absent)

--- BILAN : 112/112 vérifications passées ---
```

Sur la machine de session, qui a ffmpeg : **120/120**. L'écart de huit est
exactement l'ensemble des mesures qui dépendent de ffmpeg, deux profils
d'appareil compris.

**Le bilan annonce donc « tout passe » sur un total qui a rétréci.** Rien n'est
faux dans ce que le script imprime — chaque ligne dit honnêtement « non
mesurée » — mais le nombre final, qui est la seule chose qu'on lit d'un coup
d'œil, ne distingue pas un contrôle réussi d'un contrôle absent. Un vert de
112/112 se lit comme un vert de 120/120.

## Ce que ça a failli coûter

La session s'apprêtait à fusionner un changement de **niveaux sonores** —
limiteur de crête, correction de gain sur treize bruitages — en s'appuyant sur
ce vert d'intégration. Or les quatre mesures manquantes sont précisément celles
qui portent sur le son : le vrai pic du fichier livré, le silence, la cadence.
Le seul contrôle qui aurait pu voir un écrêtage introduit par ce diff était
parmi les sautés.

## Le geste

**Avant de faire reposer une décision sur un vert d'intégration, lire le
journal du job et compter ce qu'il a réellement exécuté** — pas seulement son
verdict. Un total qui varie d'une machine à l'autre est le signe qu'il ne
mesure pas partout la même chose.

Et sur cet hôte-ci, la règle pratique : **le parcours qui juge le son se lance
en local**, où ffmpeg existe. L'intégration couvre l'interface, l'export et le
rendu ; elle ne couvre rien de ce qui s'écoute.

## Ce qui reste vrai après coup, et qui est le vrai enseignement

Relancé en local, le parcours a rendu **−6,49 et −6,97 dBFS de vrai pic**,
c'est-à-dire **exactement les valeurs d'avant le changement**. Non parce que le
changement est sans effet, mais parce que les cinq rushes d'épreuve portent
tous une piste son : depuis la correction du même jour, le montage express ne
pose donc **aucun** bruitage sur eux. Le parcours n'en exerçait pas un seul.

Deux verts successifs, l'un amputé et l'autre complet, ne disaient donc rien du
diff — et c'est le second qui trompe le plus, puisque rien n'y manque. Ce qui
couvre réellement ce changement est l'outil écrit pour lui,
`npm run ecouter`, qui rend chaque bruitage par le code réel et le mesure.

**Un parcours de bout en bout ne vérifie que ce que son jeu d'épreuve
déclenche.** Quand une correction change ce qui est *produit*, il faut se
demander si le jeu d'épreuve produit encore la chose corrigée — sans quoi on
relit le même chiffre qu'avant et on le prend pour une non-régression.
