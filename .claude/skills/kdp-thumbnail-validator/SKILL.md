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

## Les seuils sont provisoires, et c'est écrit dans le script

Ils ont été posés sur des images d'essai, pas sur une bibliothèque de couvertures
réelles. Quand un contrôle échoue sur une couverture que l'œil trouve claire —
ou passe sur une couverture illisible — **c'est le seuil qu'il faut corriger**,
en tête de `kdp/vignette.py`, avec la raison. Un rapport toujours vert ne sert à
rien ; un rapport qui crie au loup finit ignoré, ce qui revient au même.

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
