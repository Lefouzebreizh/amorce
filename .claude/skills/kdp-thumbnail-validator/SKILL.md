---
name: kdp-thumbnail-validator
description: Juger une couverture de livre à cent cinquante pixels, la taille où elle apparaît dans une liste Amazon — mesurer si les personnages restent reconnaissables et si le bandeau du titre peut accueillir du texte. À charger dès qu'il est question de valider, comparer ou choisir une couverture, de vignette, de miniature, de visibilité en liste marchande, ou avant de déposer une couverture sur KDP. Utile aussi quand quelqu'un demande simplement « est-ce que cette couverture est bonne ? ».
---

# Juger une couverture à cent cinquante pixels

Une couverture d'autoédition ne se décide pas en grand format. Elle se décide
dans une liste marchande, en vignette d'environ **150 pixels de côté**, à côté
de vingt autres. C'est cette image-là que les gens voient avant de cliquer.

D'où la seule épreuve qui compte :

> Réduisez la couverture à 150 px et regardez-la. Si on ne reconnaît pas le
> sujet, elle est ratée — quelle que soit sa beauté en grand.

## Le script

```bash
python3 .claude/skills/kdp-thumbnail-validator/scripts/valider_vignette.py \
        couverture.png --vignettes epreuves/
```

**Visez le panneau de première, jamais la couverture complète.** Un fichier de
dépôt KDP contient le dos, la tranche et la première d'un seul tenant : le dos
est du texte sur du papier, il occupe la moitié de l'image et écrase la mesure.
La même couverture est passée de 194 à 321 pour mille rien qu'en la cadrant sur
le bon panneau — l'erreur est facile et le verdict devient absurde.

Il accepte les images et les PDF d'une page, et plusieurs fichiers d'un coup
pour comparer des candidates. Il écrit les vignettes si on lui donne
`--vignettes`, et **il faut les regarder** : aucune mesure ne remplace l'œil.

`--teintes` redéfinit les couleurs signatures pour un autre livre, en fractions
de roue chromatique : `{"violet": [0.740, 0.055], "cuivre": [0.065, 0.030]}`.

## Ce qu'il mesure, et pourquoi seulement ça

Le script sépare **ce qui est rattrapable de ce qui ne l'est pas**. C'est tout
son propos, et c'est ce qui le rend utile plutôt que bavard.

**La présence du sujet ne se rattrape pas.** Si les personnages occupent trop
peu de la vignette, aucune typographie ne sauvera la couverture : il faut
refaire l'illustration. C'est le seul verdict que le script rend — et il le rend
en **trois états**, pas deux : *à refaire*, *à regarder*, *passe*.

La zone intermédiaire n'est pas une timidité, c'est de l'honnêteté. Les seuils
sont calibrés sur trois couvertures, et trois cas ne justifient pas une décision
au point près. Entre le pire cas connu et le meilleur, le script dit qu'il ne
sait pas et renvoie à l'œil. Un chiffre qui tranche sans preuve porte une
autorité qu'il n'a pas méritée.

**Le calme du bandeau de titre se rattrape**, par un voile ou un bandeau. Le
script le mesure et prévient, sans condamner.

## Ce qu'il ne mesure pas, et pourquoi

Un piège rencontré : mesuré sur une **couverture finie**, le script a d'abord
condamné celle qu'il venait d'approuver à l'état d'illustration nue. Le bandeau
crème du bas et le recadrage retirent de la surface sans que le sujet ait
rétréci. Il exclut désormais le bandeau uni du calcul — mais le reste de l'écart
tombe dans la zone d'incertitude, et c'est exactement pour ce genre de cas
qu'elle existe.

Deux mesures ont été écartées après calibration :

Une **« concentration au centre »** — le sujet doit-il faire une silhouette
groupée — classait exactement à l'envers. Elle pénalisait la couverture
retenue, dont les ailes déployées touchent les bords, et récompensait celles où
les personnages étaient petits et bien rangés. Un sujet qui remplit le cadre est
une force.

Un **« contraste du titre »** pris sur l'illustration nue mesurait en réalité
l'agitation du ciel, puisque le titre n'y est pas encore. Elle récompensait donc
un ciel chargé — le pire endroit où poser un titre. Conservée, mais inversée.

## La leçon de méthode, qui dépasse ce script

**Un contrôle qu'on n'a pas confronté à un cas bon et à un cas mauvais connus ne
vaut rien.** Celui-ci a été calibré sur trois couvertures dont le verdict humain
était établi avant toute mesure — et sa première version le contredisait
platement. Sans cette confrontation, on aurait livré un outil qui recommande la
mauvaise couverture, avec l'autorité que donnent les chiffres.

Avant de faire confiance à un seuil, demandez-vous sur quoi il a été calibré. Si
la réponse est « sur rien », ne le livrez pas.

## Ce qu'aucun script ne verra

La reconnaissance du sujet, l'émotion, la promesse faite au lecteur, le fait que
deux personnages de dos ne « rencontrent » personne. Le script dit qu'il y a
assez de matière colorée ; il ne dit pas qu'on comprend ce qu'on regarde.

Après chaque passage, **ouvrez la vignette**. C'est là que se prend la décision.
