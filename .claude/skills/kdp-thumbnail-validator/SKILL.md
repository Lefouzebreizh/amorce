---
name: kdp-thumbnail-validator
description: Contrôler qu'une couverture de livre reste lisible réduite à la taille d'une vignette de boutique (150 px de large) — fabrique la vignette et mesure le contraste global, le détachement du personnage sur son décor et le nombre de masses distinctes, plus les deux règles de dépôt KDP (résolution, mode colorimétrique). Outillé par `kdp/vignette.py`, qui accepte une image ou un PDF. À utiliser dès qu'il est question d'une couverture, d'une vignette, d'une miniature, d'Amazon KDP, de « est-ce qu'on voit le personnage », « ça rend quoi en petit », ou avant tout dépôt de couverture.
---

# La couverture n'est jamais vue en grand

Sur la boutique, une couverture d'album fait la largeur d'un pouce, au milieu de
vingt autres. Les traits fins fusionnent, le personnage se fond dans son décor,
et il ne reste qu'une tache colorée. C'est invisible sur l'écran où la couverture
a été dessinée, et irrattrapable une fois le livre en vente.

## L'outil

```bash
python3 kdp/vignette.py --source couverture_face.png --vers .travail/vignette.png
python3 kdp/vignette.py --source couverture_kdp.pdf --page 0      # depuis le PDF assemblé
python3 kdp/vignette.py --source couverture.png --sujet 0.35,0.10,0.45,0.65
```

Il sort en erreur dès qu'un contrôle échoue. `--vers` écrit la vignette : **la
regarder fait partie du contrôle**, les chiffres disent seulement où regarder.

`--sujet` donne la zone du personnage en fractions `x,y,largeur,hauteur`. Le
défaut suppose un personnage central (`0.20,0.15,0.60,0.70`) ; un personnage
décentré mal déclaré fait échouer le contrôle pour rien — c'est le premier
réflexe quand « détachement du sujet » tombe bas sur une couverture qui paraît
franche.

## Lire le rapport

**Deux règles de dépôt**, qui ne se discutent pas :

- *Résolution de la source* — au moins 1000 px sur le côté long. Réexporter
  depuis la source ; rééchantillonner vers le haut ajoute des pixels, pas du
  détail.
- *Mode colorimétrique* — du RVB. Une couverture en CMJN passe le dépôt et
  ressort terne, sans le moindre message.

**Trois seuils de lisibilité**, qui sont les nôtres :

| Contrôle | Ce qu'il mesure | Ce qu'il veut dire s'il échoue |
| --- | --- | --- |
| Contraste global | écart-type de la luminance de la vignette | tout s'écrase dans la même valeur : la vignette est une bouillie |
| Détachement du sujet | écart entre les extrêmes du personnage et la médiane de ce qui l'entoure | le personnage a la valeur de son décor, il disparaît à cette taille |
| Masses distinctes | aplats pesant chacun au moins 3 % de la vignette | trop peu de zones : la couverture sera confondue avec ses voisines |

## Deux pièges mesurés

**Ne visez jamais la couverture complète.** Un fichier de dépôt KDP contient le
dos, la tranche et la première d'un seul tenant. Le dos est du texte sur du
papier : il occupe la moitié de l'image et écrase toutes les mesures. Une même
couverture est passée de 194 à 321 pour mille de présence du sujet rien qu'en
la cadrant sur le bon panneau — le verdict devient absurde sans rien signaler.

**Un seuil vaut ce que vaut sa calibration.** Une première version de ce
contrôle, calibrée sur trois couvertures dont le verdict humain était connu,
acceptait celle qui avait été rejetée et rejetait celle qui avait été retenue :
deux de ses mesures étaient mal posées. Avant de faire confiance à un seuil,
demandez sur quoi il a été calibré — et si la base est mince, préférez un
verdict qui dit « je ne sais pas, regardez » à une frontière inventée. Un
chiffre qui tranche sans preuve porte une autorité qu'il n'a pas méritée.

## Ce qu'on fait d'un échec

Ce sont des problèmes de dessin, pas de fichier. Dans l'ordre d'efficacité :

1. **Agrandir le personnage.** À 150 px, ce qui occupe un quart de la couverture
   occupe 37 pixels. C'est le remède qui marche le plus souvent.
2. **Creuser l'écart de valeur**, pas de couleur : un personnage sombre sur ciel
   clair, ou l'inverse. Deux couleurs vives de même luminosité se confondent en
   niveaux de gris — et c'est en niveaux de gris que se joue la lisibilité.
3. **Simplifier le décor derrière le sujet.** Un feuillage détaillé et un
   personnage détaillé se mangent l'un l'autre.
4. **Épaissir les contours**, en dernier : un cerne sauve une silhouette, il ne
   sauve pas une composition.

## Ce que le contrôle ne voit pas : le texte

Aucune des mesures ne juge la lisibilité d'un titre — il faudrait reconnaître le
texte pour cela. C'est la raison d'être de `--vers` : **regarder la vignette**.

Repère mesuré sur la couverture de *Roussy & Zéphy* (1600 × 1600, réduite à
150 px) : le titre, qui occupe environ 7 % de la hauteur, reste net ; le
sous-titre, à 2,5 %, devient une trace grise illisible. En dessous d'environ
**5 % de la hauteur de la couverture**, un texte ne survit pas à la vignette.
Ce qui doit être lu dans une liste — le titre, et lui seul — doit donc être gros
au point de paraître exagéré sur l'écran où on le dessine.

La quatrième de couverture n'est pas concernée : personne ne la lit en vignette.

## Les seuils sont provisoires, et c'est écrit dans le script

Ils ont été posés sur des images d'essai, pas sur une bibliothèque de couvertures
réelles. Quand un contrôle échoue sur une couverture que l'œil trouve claire —
ou passe sur une couverture illisible — **c'est le seuil qu'il faut corriger**,
en tête de `kdp/vignette.py`, avec la raison. Un rapport toujours vert ne sert à
rien ; un rapport qui crie au loup finit ignoré, ce qui revient au même.

Premier recalage sur du vrai : la couverture de *Roussy & Zéphy* passe les cinq
contrôles avec de la marge (contraste 63, détachement 99 à 124 selon la zone
déclarée, 16 masses). Les seuils ne sont donc pas trop sévères pour une
illustration à l'aquarelle. À noter toutefois : « masses distinctes » sature à 16
sur ce style, ce qui la rend muette entre une bonne et une moyenne couverture —
elle n'attrape que les cas extrêmes.

Une mesure a déjà été essayée puis retirée pour cette raison : la variance du
laplacien, censée dire ce qui reste de trait après réduction. Elle récompense le
grain — une couverture tramée sans le moindre contraste la passait mieux qu'une
couverture franche. En ajouter une nouvelle demande donc de vérifier qu'elle
**sépare** deux cas connus, pas seulement qu'elle produit un nombre.

## Où cela s'insère

Le contrôle vient **après** l'assemblage et **avant** le dépôt :

```bash
python3 kdp/kdp.py couverture --source nommes/ --vers couverture_kdp.pdf --pages 24
python3 kdp/vignette.py --source couverture_kdp.pdf --vers .travail/vignette.png
```

`kdp/pipeline/valider.py` reste le juge du fichier (cotes, fonds perdus, poids) ;
`vignette.py` juge ce que verra l'acheteur. Les deux sont nécessaires, aucun ne
remplace l'autre.
