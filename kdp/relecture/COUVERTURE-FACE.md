# Première de couverture — fiche de production

C'est la seule image du produit que la plupart des gens verront. Pas la
meilleure planche, pas le texte de la page 21 : **la vignette de 150 pixels
dans une liste Amazon, à côté de vingt autres.** Tout ce qui suit découle de là.

Une couverture provisoire est en place (`kdp/pipeline/couverture_face.py`) : elle
emprunte son illustration à la page 21, ce qui la ferait paraître deux fois dans
le volume. Elle rend le fichier déposable et permet de juger la géométrie. Elle
n'est pas une couverture.

---

## L'épreuve à passer, avant toute autre

Réduisez votre projet à **150 pixels de côté** et regardez-le. Si à cette taille
on ne distingue pas d'un coup d'œil **un renard roux et un zèbre ailé violet**,
la couverture est ratée, quelle que soit sa beauté en grand.

C'est le seul test qui compte, et il élimine la plupart des couvertures
d'autoédition : trop de détails, un titre trop fin, un sujet trop loin.

---

## Cotes

| | |
| --- | --- |
| Panneau de première | **8,625 × 8,75 po** (219,1 × 222,3 mm) |
| Format rogné | 8,5 × 8,5 po |
| Fond perdu | 0,125 po en haut, en bas et sur la tranche extérieure — **jamais côté reliure** |
| Zone de sécurité | rien de signifiant à moins de **0,375 po** du bord rogné |
| Résolution | **2600 px minimum** de côté, soit 300 DPI |

La couverture complète (dos + tranche + face) s'assemble ensuite par
`kdp/pipeline/assembler.py`, qui calcule la tranche sur le nombre de pages réel.

---

## Ce qui doit y figurer, par ordre d'importance

1. **Roussy et Zéphy**, grands, proches, lisibles en vignette. Le reste est
   décor.
2. **Le titre** « Roussy & Zéphy », gros. Un titre qu'on ne lit pas en vignette
   ne sert à rien.
3. **L'accroche** « Et si ta différence était ta plus grande force ? » — c'est
   elle qui fait cliquer un parent, pas le titre.
4. **Le nom de l'auteur**.
5. **« Tome 1 »**, discret mais présent : il annonce une série, ce qui rassure.

Ce qui ne doit **pas** y figurer : une scène complexe, un décor chargé, plus de
deux plans, un texte long.

---

## Direction

Le recueil ouvre en automne et se ferme sur une nuit étoilée. Deux directions
tiennent, et il faut en choisir une :

**L'automne, lumière basse.** Roussy et Zéphy de face, assis côte à côte, dans
les feuilles. Chaud, immédiatement lisible, cohérent avec les dix-sept planches.
C'est le choix sûr.

**La nuit bretonne.** Fond bleu profond, les deux personnages de profil devant
un phare, les ailes de Zéphy captant la dernière lumière. Beaucoup plus
distinctif dans une liste de miniatures, où toutes les couvertures jeunesse sont
claires — mais plus risqué, parce qu'une vignette sombre peut aussi disparaître.

Ma préférence : **l'automne pour le Tome 1**, la nuit gardée pour le Tome 2. La
série y gagne une progression, et le premier volume ne prend pas de risque.

---

## Contraintes de fabrication

- **Bordure végétale d'automne** comme les planches intérieures, mais **plus
  légère** : en vignette, une bordure chargée mange le sujet.
- **Fond papier crème** identique au reste.
- Le titre doit tenir **hors de la zone de sécurité**, ce qui veut dire au moins
  0,375 po du bord rogné — c'est le défaut relevé sur toutes les planches
  actuelles, ne le reproduisez pas ici.
- Prévoir **du calme derrière le titre** : pas de feuillage sous le texte.

---

## Prompt

À préfixer du bloc de style commun de `TOME2-PISTES.md`, qui verrouille
l'anatomie de Zéphy et les couleurs des deux personnages.

```
Front cover of a square children's picture book, 2600 x 2600 pixels.

COMPOSITION: ROUSSY the red fox cub and ZEPHY the small winged zebra sitting
side by side, facing the viewer, filling the central two thirds of the image.
Warm low autumn light, soft watercolour, cream vintage paper texture. Behind
them, a simple uncluttered Breton meadow with one distant standing stone — no
busy background, no second scene.

Zephy's violet and gold wings half-open, catching the light. Roussy leaning
slightly against him. Both calm and warm, looking straight out.

Light decorative border of autumn leaves and acorns around the four edges, much
sparser than the interior pages, and leaving the top third clear.

Leave the top of the image empty and quiet: a title will be set there.
Keep all illustration at least 0.4 inch from every edge.
No text, no lettering, no title in the image.
```

Le titre, l'accroche et le nom d'auteur sont **posés ensuite en typographie**,
par `couverture_face.py`. Ne les faites pas générer : un titre pixellisé se
corrige en régénérant toute la couverture, alors qu'un titre vectoriel se
change en une ligne — et sort net en vignette, ce qui est précisément là où
tout se joue.

---

## Après génération

```bash
python3 kdp/pipeline/couverture_face.py \
        --bordure planche_avec_bordure.webp \
        --illustration ma_couverture.png \
        --vers couverture_face.pdf
```

Puis réassembler et valider. Le contrôle refuse tant qu'un carton d'attente
subsiste :

```bash
python3 kdp/pipeline/assembler.py --planches … --complements … --vers sortie/
python3 kdp/pipeline/valider.py --dossier sortie/
```
