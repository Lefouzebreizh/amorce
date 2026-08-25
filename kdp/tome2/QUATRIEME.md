# Tome 2 — quatrième de couverture

Écrite maintenant, avant les planches, pour une raison précise : le Tome 1 a
annoncé sur son dos deux histoires sous des titres qui n'existaient nulle part
dans le livre. On ne recommence pas. **Les titres cités ici sont ceux de
`charte.py`**, et c'est cette liste qui fait foi.

Comme pour la première, **rien de ce texte ne doit être généré dans l'image** :
il se pose en vectoriel sur l'illustration de fond. Une quatrième dont le
sommaire est pixellisé se corrige en régénérant tout ; en vectoriel, elle se
corrige en une ligne — ce qui est exactement ce qui est arrivé au Tome 1.

---

## Le texte

**Accroche, en haut, grande**

```
Et si ce que tu ressens trop fort
était ce que tu as de plus précieux ?
```

**Corps**

```
Roussy a la boule au ventre, la tête comme une passoire, et il rit jaune quand
on lui demande si ça va.

Zéphy, lui, prend tout au pied de la lettre. Il apporte une pelote de laine
pour la boule, un arrosoir pour la passoire, et un nuancier de peintre pour
vérifier la couleur du rire.

Seize nouvelles histoires en quatre images, où l'on n'apprend pas à moins
ressentir — on apprend à vivre avec ce qu'on ressent.
```

**Sommaire, quatre escales bretonnes**

```
Contient douze aventures pour apprivoiser ses émotions
et quatre escales en Bretagne :

✳ Avoir le pied marin — Bréhat
✳ Chercher midi à quatorze heures — Locronan
✳ Avoir le vent en poupe — la pointe du Raz
✳ Le sommeil du korrigan — Brocéliande
```

**Citation, en italique**

```
« Avoir la tête comme une passoire, c'est avoir une tête qui fait de la place. »
```

**Pied**

```
Erwann Lefouzèbreizh
Tome 2 · Dès 4 ans
```

---

## Le décompte, vérifié

« Douze aventures + quatre escales » est exact et se recompte sur `charte.py` :
pages 1 à 12 pour les émotions, pages 13 à 16 pour la Bretagne. Le Tome 1
comptait autrement — onze émotions plus *Le murmure des étoiles* — et il fallait
le vérifier plutôt que de recopier la formule.

## Contraintes de fabrication

- **Zone code-barres** : laisser un rectangle blanc d'environ 5 × 3 cm en bas à
  droite, à au moins 0,25 po du bord rogné. KDP y imprime le sien ; le laisser
  vide est la bonne pratique.
- **Rien de signifiant à moins de 0,375 po** du bord rogné, sommaire compris.
- L'illustration de fond doit garder **une zone calme** derrière l'accroche et
  derrière le sommaire. C'est le même piège que sur la première : un fond chargé
  rend le texte illisible en vignette.
- Le panneau de dos mesure **8,625 × 8,75 po** — le fond perdu s'ajoute en haut,
  en bas et sur la tranche extérieure, jamais côté reliure.

## Prompt de l'illustration de fond

```
Back cover illustration for a square children's picture book, 2600 x 2600
pixels. NO TEXT ANYWHERE IN THE IMAGE.

SCENE: a quiet Breton night. A wide sky of deep indigo and violet, full of
stars, a low moon over a calm sea. On a grassy headland in the LOWER LEFT,
ROUSSY and ZEPHY seen small and from behind, sitting close together, looking up
at the stars. A lighthouse far right on the horizon, its beam soft.

Keep the entire upper half and the right side quiet and dark: text will be set
over them. Keep the bottom right corner plain — a barcode goes there.
Light border of autumn leaves, acorns and violet feathers around the four edges,
much sparser than the interior pages.
```

Le dos peut se permettre la nuit là où la première prend le couchant : c'est le
même monde à deux moments, et cela donne à la série une profondeur que deux
scènes identiques n'auraient pas.
