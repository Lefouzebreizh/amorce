# Page 12 — Le secret de l'hermine

Fiche de production de la seule histoire du Tome 1 qui n'a jamais été
illustrée. Elle est annoncée sur la 4e de couverture et inscrite au sommaire :
sans elle, le livre ment à son lecteur dès le dos.

Il n'y a donc rien à régénérer — il y a à créer. Ce document contient tout ce
qui précède l'image : le scénario en quatre temps, les bulles déjà
typographiées, la phrase de l'âme et le prompt prêt à coller.

---

## Pourquoi l'hermine porte cette histoire-là

L'hermine est l'emblème de la Bretagne, et sa devise est *Kentoc'h mervel eget
bezañ saotret* — plutôt mourir que se souiller. La légende veut qu'acculée par
les chasseurs devant une flaque de boue, elle refuse de la traverser et fait
face plutôt que de tacher son pelage blanc.

Prise au pied de la lettre — ce que fait ce livre —, cette devise décrit
exactement **la peur de mal faire** : l'enfant qui n'essaie pas pour ne pas
rater, qui se fige devant la tache possible. C'est le seul bonus breton du tome
qui porte une émotion aussi précise, et c'est celle qui manquait à la
collection.

**Attention au retournement, il est obligatoire.** La légende finit sur un refus
qui coûte la vie. Un album qui dédramatise ne peut pas s'arrêter là : le vrai
secret de l'hermine n'est pas de rester propre, c'est de savoir qu'une tache
s'en va. Le titre annonce un secret ; l'histoire doit en livrer un qui soulage,
pas un qui pétrifie.

---

## Continuité — l'hermine existe déjà

Elle apparaît **en page 17**, en bas à droite du jeu des sept différences : une
petite hermine blanche assise dans les fougères, à côté du personnage brun. Ce
n'est pas un figurant à redessiner librement — c'est le même personnage, et
c'est ce modèle qu'il faut reprendre. Une hermine différente en page 12 et en
page 17 ajouterait une incohérence à celles déjà relevées.

---

## Scénario en quatre temps

Décor : un chemin creux breton, talus de fougères et de mousse, murets de
granit, ornière boueuse en travers du passage. Lumière d'automne basse.

| | |
| --- | --- |
| **1** | Roussy, raide comme un piquet au bord de l'ornière, refuse d'avancer. Zéphy l'attend de l'autre côté. **Roussy :** « Je ne bouge pas. L'hermine, elle, ne se salit jamais. Alors si je fais une tache, tout est raté. » |
| **2** | Zéphy prend son élan et atterrit à plat dans la boue. SPLATCH. Il ressort entièrement marron, seules ses dents et ses yeux sont blancs. **Zéphy :** « Ah bon ? Alors je viens de tout rater onze fois en une seule seconde ! » |
| **3** | Une vraie hermine sort des fougères. Toute blanche — sauf ses quatre pattes, noires de boue. **L'hermine :** « Qui raconte que je ne me salis jamais ? Je suis blanche, je ne suis pas magique. » **Zéphy :** « Et le secret, alors ? » **L'hermine :** « Le ruisseau est juste derrière. » |
| **4** | Les trois dans le ruisseau clair, en contrebas. Roussy saute à pieds joints dans la boue puis court se rincer, hilare. **Roussy :** « J'ai une tache ! Et je sais où elle s'en va ! » **Zéphy :** « Attention, moi j'en ai partout. Il va me falloir toute la Bretagne ! » |

### Parchemin

> *Le secret de l'hermine, ce n'est pas de n'avoir jamais de tache.*
> *C'est de savoir qu'une tache, ça s'en va.*

### Titre du bandeau

**Le secret de l'hermine** — minuscules sauf l'initiale, conformément à la
charte et aux pages 01, 04, 05 et 11 qui sont déjà dans cette forme.

---

## Points de lettrage à ne pas rater

Ce sont les défauts relevés partout ailleurs dans le Tome 1. Autant ne pas les
reproduire sur une planche neuve.

- **Aucun guillemet à l'intérieur des bulles.** La bulle est le signe du
  dialogue. C'est la forme majoritaire du tome (quatorze planches sur dix-sept)
  et celle vers laquelle les pages 02, 03 et 13 doivent converger.
- **Espace insécable avant `!` et `?`**, dans chaque bulle sans exception.
- **Points de suspension en trois points**, jamais quatre.
- **Apostrophes courbes** (`’`), jamais droites.
- **Pas de ponctuation orpheline en début de ligne** : aucun `!` ne doit
  basculer seul sur la ligne suivante.
- La bulle la plus longue fait vingt-deux mots (panneau 1). Ne pas dépasser —
  la page 03 monte à trente-deux et devient illisible à hauteur d'album.

---

## Prompt

À préfixer du bloc de style commun figurant dans `TOME2-PISTES.md`, qui verrouille
l'anatomie de Zéphy, la résolution de 2600 px et la marge de sécurité.

```
Title across the top in elegant brown script: "Le secret de l'hermine"

SETTING: a Breton sunken lane in autumn — high banks of ferns and moss, dry
granite walls, a wide muddy rut cutting across the path. Low golden October
light, fallen oak leaves.

NEW CHARACTER — L'HERMINE: a small white stoat in winter coat, black tail tip,
bright dark eyes, calm and slightly amused. Small, realistic, never humanised.
She is the same ermine that already appears in the bottom right of the "Goûter
des Menhirs" page; keep her identical.

Panel 1: ROUSSY standing stiff as a post at the edge of the muddy rut, paws
tucked in tight, refusing to step forward, anxious. ZEPHY waits on the far side,
puzzled, head tilted.

Panel 2: ZEPHY belly-flopping flat into the mud, huge brown splash, wings
spread, comic SPLATCH. He is completely brown except for his white teeth and
wide white eyes, tongue out, delighted.

Panel 3: the small white ERMINE stepping out of the ferns, pristine white except
for four muddy black paws, looking up matter-of-factly. ROUSSY leaning in
astonished, muddy ZEPHY grinning behind.

Panel 4: a clear shallow stream just below the path. ROUSSY mid-leap landing in
the mud on purpose, laughing; then all three splashing clean in the bright
water, the ermine white again, Zephy still half brown. Warm low sunlight on the
water.

Parchment scroll across the bottom, two italic lines:
"Le secret de l'hermine, ce n'est pas de n'avoir jamais de tache.
C'est de savoir qu'une tache, ça s'en va."
```

---

## Après génération

```bash
python3 kdp/kdp.py renommer  --source rushes/ --vers nommes/ --appliquer
python3 kdp/kdp.py controler --source nommes/
python3 kdp/kdp.py interieur --source nommes/ --vers interieur_kdp.pdf
```

`renommer` reconnaît seul un fichier dont le nom contient le **titre entier** ou
le slug, accents et casse ignorés — `le secret de l hermine.png` passe,
`hermine_v3.png` non, et c'est voulu : un mot isolé attraperait n'importe quoi.
Pour un nom opaque, passer par `--correspondance` :

```json
{ "sortie_generateur_0042.webp": 12 }
```

Le carton d'attente magenta de la page 12 disparaîtra alors du PDF, et
`controler` cessera de signaler l'illustration absente.
