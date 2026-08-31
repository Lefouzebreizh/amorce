# Première de couverture — fiche de production

C'est la seule image du produit que la plupart des gens verront. Pas la
meilleure planche, pas le texte de la page 21 : **la vignette de 150 pixels
dans une liste Amazon, à côté de vingt autres.** Tout ce qui suit découle de là.

Une couverture provisoire est en place (`kdp/pipeline/couverture_face.py`) : elle
emprunte son illustration à la page 21, ce qui la ferait paraître deux fois dans
le volume. Elle rend le fichier déposable et permet de juger la géométrie. Elle
n'est pas une couverture.

---

## Le chemin le moins cher, mesuré le 31 août 2026

Avant de chercher à faire fabriquer une image, trois faits chiffrés.

**Le livre est déposable sans elle.** Le provisoire n'est pas un carton
d'attente : la chaîne rend 30 pages, 9 contrôles sur 9 au vert, verdict
PUBLIABLE, et `vignette.py` passe ses cinq contrôles sur ce provisoire — le
titre se lit à 150 px. Le dépôt et l'épreuve papier n'attendent donc rien.

**Recadrer un panneau de planche est fermé par le calcul, pas par le goût.** Le
panneau de face fait 2588 × 2625 px à 300 DPI, et un panneau vaut environ 42 %
du côté d'une planche : 672 px depuis une planche à 1600, soit **×3,85**. La
page 01 a été jugée inutilisable et refaite en vectoriel à ×2,54. Inutile
d'essayer.

**Une illustration pleine page, en revanche, tient largement.** À 1600 px elle
tombe à ×1,62 — l'agrandissement de la plupart des planches du recueil ; à
2048 px à ×1,26, la classe de « Avoir un chat dans la gorge », la mieux résolue
du livre. **L'essai de falaise déjà généré est donc utilisable tel quel** dès
qu'il fait 1600 px ou plus, à mesurer d'une ligne :

> **`--pleine-page` avertira « 183 DPI, il en faut 300 » pour un essai de
> 1600 px, et produira quand même le PDF.** Ce n'est pas un refus : en pleine
> page l'illustration couvre 8,75 po, et les planches du recueil sont elles-mêmes
> à 186 DPI. `valider.py` ne contrôle pas le DPI de la couverture. Ne pas
> rebrousser chemin sur cette ligne-là.

```bash
python3 -c "from PIL import Image; print(Image.open('essai.png').size)"
python3 kdp/vignette.py --source essai.png --vers .travail/vignette.png
```

Son seul défaut est que les personnages sont de dos, ce que la direction
retenue ci-dessous corrige. **Une couverture avec les héros de dos vaut mieux
qu'un livre non publié** : on dépose avec, on commande l'épreuve, et on refait
l'image seulement si l'épreuve la condamne.

**Et une piste jamais mesurée jusqu'ici, pour la refaire depuis l'appareil du
propriétaire** : Canva génère des images à partir d'une invite (Magic Media /
Dream Lab), accepte une **image de référence** — donc le verrou d'anatomie de
Zéphy —, plafonne à **environ 2048 × 2048 px**, et le compte gratuit en offre
**dix au total**, à vie. 2048 px, c'est ×1,26 : la meilleure classe de
résolution du volume. Réponse du service d'aide officiel de Canva, le
31/08/2026 ; les quatre chemins fermés de `CLAUDE.md` ne la couvraient pas.

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

## Direction retenue

**La scène de falaise au couchant**, celle de la couverture que vous avez
générée : mer d'Ardoise, phare à droite, ciel mauve et or. Elle est nettement la
meilleure des trois essais au test des cent cinquante pixels — le titre passe,
la scène tient, les couleurs sortent.

**Une seule chose change : les personnages se retournent.** Sur l'essai, Roussy
et Zéphy sont de dos, face au couchant. C'est beau, c'est contemplatif, et à
cent cinquante pixels le renard n'est plus qu'une tache orange. En jeunesse,
l'acheteur doit rencontrer les héros dans la vignette ; c'est là que se joue le
clic.

Le contre-jour n'est pas un problème, c'est un cadeau : le soleil passe derrière
eux et leur pose un liseré doré sur tout le contour.

---

## Le titre, tranché

| Où | Ce qui s'écrit |
| --- | --- |
| Surtitre, petit | Les Merveilleuses Aventures de |
| Titre, grand | **Roussy & Zéphy** |
| Accroche | Et si ta différence était ta plus grande force ? |
| Bas de couverture | Erwann Lefouzèbreizh · Tome 1 |

Le titre déposé chez Amazon reste **« Roussy & Zéphy »**, court, identique au
nom de la série. « Les Merveilleuses Aventures de » vit sur la couverture, en
surtitre, où il évoque sans allonger la fiche produit.

**Aucun de ces textes ne doit être généré dans l'image.** Ils sont posés en
vectoriel par `couverture_face.py --pleine-page` : nets en vignette, et
corrigeables en une ligne plutôt qu'en une régénération complète. L'essai
fourni portait un titre incrusté qui ne correspondait ni à la charte ni à la
fiche KDP — c'est exactement le piège.

---

## Prompt

**Le prompt ci-dessous est complet : il se colle tel quel.** N'y préfixez pas le
bloc de style de `kdp/tome2/DOSSIER.md` — la moitié de ce bloc décrit une
planche intérieure (grille de bande dessinée 2×2, médaillons numérotés, bulles
de dialogue, titre en script, parchemin) et produirait ici une couverture en
planche de BD, exactement ce que la direction retenue écarte.

Ce qu'il fallait en garder — le style d'aquarelle, et surtout **les deux
descriptions de personnages qui verrouillent l'anatomie de Zéphy** — est déjà
repris ci-dessous. C'est ce verrou qui évite la dérive constatée au Tome 1 :
crinière moutarde en pages 6 et 9, Roussy en chaton page 19.

```
Children's book illustration, soft watercolour and coloured-pencil style, warm
vintage cream paper texture, gentle autumn palette.

ROUSSY: a small slender red fox cub, copper-orange fur, white chest and white
tail tip, amber eyes, expressive eyebrows. Quadruped fox anatomy, never
humanised.

ZEPHY: a small winged zebra foal. Realistic equine anatomy — four hooves, no
human torso, no hands. Black and white stripes, mane and tail tuft in violet and
gold, large feathered wings in violet fading to gold. Comic, rubbery, highly
expressive face.

Front cover illustration for a square children's picture book, 2600 x 2600
pixels. NO TEXT ANYWHERE IN THE IMAGE — no title, no lettering, no signature.

SCENE: the edge of a Breton clifftop at sunset. Below and behind, the Atlantic
breaking against grey cliffs; a white lighthouse on the headland to the right,
its lamp just lit. The sky is mauve and gold, high clouds catching the last
light, a few gulls.

ROUSSY and ZEPHY sit together on the grassy clifftop in the LOWER MIDDLE of the
image, FACING THE VIEWER, three-quarter front, close enough to touch. The sun is
behind them: a warm golden rim light runs along Roussy's fur and the edge of
Zephy's half-open wings, while their faces stay warm and readable. Both calm and
happy, looking straight out at the reader. They fill roughly the lower third of
the image and read clearly even at thumbnail size.

Small autumn details on the grass: oak leaves, acorns, two violet feathers, a
few late wildflowers.

KEEP THE TOP THIRD QUIET: open sky only, no clouds of high contrast, nothing
busy — a title will be set there in type.
KEEP THE BOTTOM EIGHTH QUIET: plain grass, no detail — the author name goes there.
Keep all important illustration at least 0.4 inch from every edge.
```

Les deux consignes de calme, en haut et en bas, ne sont pas décoratives : ce
sont les deux bandeaux où le texte se posera, et un ciel chargé y rendrait le
titre illisible en vignette.

---

## Une fois l'illustration reçue

```bash
python3 kdp/pipeline/couverture_face.py \
        --illustration ma_couverture.png --pleine-page \
        --bordure planche_avec_bordure.webp \
        --vers couverture_face.pdf
```

`--voile` éclaircit doucement le ciel derrière le titre, et vaut 0,34 par
défaut. Un titre sombre sur un ciel mauve tient à l'écran et se perd en
vignette, où l'écart de clarté s'écrase ; le voile ne se voit pas à taille
réelle. Le mettre à 0 si le ciel est déjà très clair.

Puis refaire l'épreuve des cent cinquante pixels avant de valider.

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
