# Tome 2 — les pages d'atelier

Trois pages spécifiées assez précisément pour partir en production sans
discussion. Chacune répare un défaut constaté au Tome 1.

---

## Page 17 — Le bal des lucioles

### La méthode, qui n'est pas négociable

**Une seule vignette est générée.** La seconde est fabriquée par
`kdp/pipeline/page17.py`, qui applique des écarts déclarés et les contrôle par
trois mesures indépendantes.

Le Tome 1 avait fait générer les deux : après recalage optimal, l'écart moyen
entre elles restait à **53 sur 255**. Nuages, fougères et poses différaient
partout. Un enfant y aurait trouvé des dizaines d'écarts, dont aucun n'était le
bon. Ce n'est pas un jeu imparfait, c'est un jeu impossible.

### La scène

Une clairière de Brocéliande à la tombée de la nuit. Roussy et Zéphy assis sur
une large souche moussue, un bocal à lucioles posé entre eux. Le korrigan à
chapeau rouge sort d'une pierre levée à gauche ; l'hermine blanche observe
depuis les fougères à droite. Des dizaines de lucioles dans l'air, un triskell
gravé sur le flanc de la souche.

Un décor **chargé mais lisible** : c'est ce qui fait la difficulté d'un bon jeu.

### Les sept écarts, du plus visible au plus retors

| # | Écart | Pourquoi à ce rang |
| --- | --- | --- |
| 1 | Le foulard de Roussy est rouge au lieu de vert | grande surface, héros, plein centre |
| 2 | La lumière du bocal à lucioles est verte au lieu de dorée | central, et c'est la source de lumière |
| 3 | Le chapeau du korrigan est bleu au lieu de rouge | central mais plus petit |
| 4 | Le triskell gravé sur la souche est doré au lieu de violet | périphérique, couleur franche |
| 5 | Le bout de la queue de l'hermine est violet au lieu de noir | petit détail, bord droit |
| 6 | Trois lucioles ont disparu du bosquet de droite | **suppression**, dans le fouillis |
| 7 | Une luciole s'est posée sur l'aile de Zéphy | **ajout**, sur une texture chargée |

L'ordre n'est pas décoratif : deux virages de couleur sur les héros en pleine
lumière, puis un détail plus petit, puis la périphérie, puis une suppression
noyée dans le fouillis, et pour finir un ajout — **ce qui manque se voit
toujours moins bien que ce qui change**.

### La page de solutions

Elle manquait au Tome 1, et un jeu sans corrigé frustre plus qu'il n'amuse.
Elle se compose par `pages_texte.py`, qui lit les écarts déclarés : la liste
imprimée et le jeu posent donc forcément les mêmes questions.

```
Les solutions du bal des lucioles
Sept différences, de la plus facile à la plus difficile.
Tu les avais toutes trouvées ?
```

---

## Page 18 — Dessine ta propre tempête

Grand cadre vide, bordure végétale, fond papier crème.

**Avec une consigne écrite** — la page équivalente du Tome 1 n'en avait aucune,
et un cadre vide sans phrase d'amorce reste vide :

```
Dessine ce qui gronde en toi aujourd'hui.
Puis, à côté, dessine ce qui vient après.
```

Deux cases plutôt qu'une, séparées par un trait léger. C'est la structure qui
fait le travail : l'enfant qui dessine sa tempête doit avoir un endroit où
dessiner l'éclaircie.

En bas, petits, Roussy et Zéphy assis, qui regardent le cadre sans l'occuper.

---

## Page 20 — Mon carnet de courage

Trois amorces à compléter :

```
Aujourd'hui, j'ai eu peur de…

Je l'ai fait quand même ?

La prochaine fois, je…
```

**Lignes d'écriture en gris moyen continu.** Celles du Tome 1 étaient en or pâle
pointillé : sur du papier couleur standard elles risquent de disparaître, alors
que ce sont précisément elles qui disent à l'enfant où écrire.

Trois lignes par amorce, espacées d'au moins 8 mm — une main de cinq ans écrit
gros.

---

## Page 19 — Coloriage

Roussy et Zéphy au trait, sur fond blanc pur pour épargner la cartouche.

**Trait nettement plus épais que celui du Tome 1**, dont les feuillages étaient
trop fins pour un feutre d'enfant. Et **Roussy doit être un renard** : celui du
Tome 1 avait un museau court et des oreilles de chat.
