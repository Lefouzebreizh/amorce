# Chaîne pré-presse — Roussy & Zéphy

Outillage de préparation KDP pour l'album illustré. Trois besoins, un seul
script : trier les rushes, contrôler ce qui bloque, assembler les PDF.

## Installation

```bash
pip install Pillow PyMuPDF
```

Le validateur de niches ci-dessous ne dépend que de la bibliothèque standard.

## En amont de tout : faut-il écrire ce livre ?

`kdp_niche_validator.py` répond à la question qui précède la chaîne. Il lit
ensemble les trois chiffres d'un mot-clé — le BSR moyen des trois premiers
livres, leur nombre d'avis, leur prix — et rend un verdict, une note sur 100 et
un rapport Markdown.

```bash
python3 kdp/kdp_niche_validator.py --mot-cle "carnet de gratitude" \
        --bsr 38000 --avis 120 --prix 12.99 --vers .travail/gratitude.md
```

Il sort en erreur sur une niche disqualifiée, ce qui permet d'en enchaîner
plusieurs et de ne garder que celles qui passent. Le piège du relevé est le
**BSR de sous-catégorie** : les seuils du script sont ceux du rang de boutique,
et confondre les deux fait passer un désert pour une mine d'or.

Ses seuils de décision et son barème sont commentés en tête de fichier, et se
recalibrent — c'est prévu. `python3 -m unittest discover -s kdp/tests` vérifie
que le recalibrage n'a rien cassé.

## Parcours complet

```bash
# 1. Trier et renommer (simulation par défaut)
python3 kdp/kdp.py renommer --source rushes/ --vers nommes/ \
        --correspondance correspondance.json
python3 kdp/kdp.py renommer --source rushes/ --vers nommes/ \
        --correspondance correspondance.json --appliquer

# 2. Contrôler avant d'assembler quoi que ce soit
python3 kdp/kdp.py controler --source nommes/

# 3. Assembler
python3 kdp/kdp.py interieur  --source nommes/ --vers interieur_kdp.pdf
python3 kdp/kdp.py couverture --source nommes/ --vers couverture_kdp.pdf --pages 24

# 4. Vérifier ce que le massicot va emporter
python3 kdp/kdp.py epreuve --source interieur_kdp.pdf --vers epreuve.pdf

# 5. Contrôler les planches sources — avant d'assembler quoi que ce soit
python3 kdp/planches.py nommes/

# 5 bis. Une planche refaite raconte-t-elle encore la même chose ?
python3 kdp/reprise.py --avant nommes/ --apres reprises/

# 6. Vérifier ce que verra l'acheteur : la couverture réduite en vignette
python3 kdp/vignette.py --source couverture_kdp.pdf --vers .travail/vignette.png
```

`planches.py` mesure ce qu'aucun œil ne juge sur un écran : la résolution
effective une fois posée sur le gabarit, la hauteur d'œil du texte des bulles en
millimètres imprimés, l'épaisseur du trait et sa netteté. Il passe **avant**
l'assemblage, quand il est encore temps de refaire une planche. Ses tests :
`python3 -m unittest discover -s kdp/tests`.

`reprise.py` sert au moment où l'on régénère des planches en plus haute
définition : le générateur redessine et il dérive. Il compare les masses, pas
les pixels — deux dessins de la même scène n'ont aucun pixel en commun — et il
nomme la zone qui a bougé, parce qu'un quart redessiné laisse la note d'ensemble
rassurante.

`vignette.py` juge la lisibilité, pas le fichier : le personnage se détache-t-il
encore à 150 px de large, ou la couverture est-elle devenue une tache ? Ses
seuils sont les nôtres et se recalibrent — voir l'en-tête du script.

`renommer` reconnaît seul un fichier dont le nom contient le titre ou le slug de
l'histoire, accents et casse ignorés. Pour des noms opaques — ce que produisent
les générateurs d'images — passer une correspondance explicite :

```json
{ "a1b2c3.webp": 7, "d4e5f6.jpg": 1, "g7h8i9.webp": 0, "j0k1l2.webp": -1 }
```

Le numéro est celui de la page ; `0` désigne la couverture de face et `-1` le
dos. Deux fichiers qui visent la même page font échouer le renommage : c'est
toujours une erreur d'identification.

## Ce que garantit l'assemblage

- **Aucune recompression destructive.** Un JPEG au bon rapport est recopié tel
  quel dans le PDF (flux d'origine). Tout le reste passe par un PNG sans perte.
  Le PDF pèse lourd — une centaine de mégaoctets pour vingt et une pages — et
  c'est voulu : KDP accepte jusqu'à 650 Mo.
- **Aucun rééchantillonnage.** Le seul traitement pixel possible est un
  recadrage centré quand le rapport de la source diffère de celui de la page.
  La mise à l'échelle est faite par le PDF, en vectoriel.
- **Une page manquante reste une page.** Un carton d'attente magenta occupe sa
  place et le script sort en erreur. Un PDF au bon compte se contrôle ; un PDF
  décalé se découvre à l'impression.

## Cotes

| | Charte (défaut) | `--kdp-strict` |
| --- | --- | --- |
| Page intérieure | 8,625 × 8,625 po | 8,625 × 8,75 po |
| Fond perdu réel | 0,0625 po par côté | 0,125 po sauf côté reliure |

La charte annonce « 0,125 po tout autour » puis « 8,625 × 8,625 » : les deux
sont incompatibles (0,125 tout autour donnerait 8,75). Le chiffre, énoncé deux
fois, l'emporte sur la dérivation ; `--kdp-strict` produit la géométrie que KDP
spécifie réellement, plus haute que large parce que le côté reliure ne reçoit
jamais de fond perdu.

La couverture, elle, suit exactement la formule de la charte, qui est aussi
celle de KDP :

    largeur = 2 × 8,5 + tranche + 2 × 0,125
    hauteur = 8,5 + 2 × 0,125
    tranche = nombre de pages × 0,002252   (papier couleur standard)

`--pages` doit recevoir le nombre de pages du PDF intérieur **final**, pas le
nombre d'illustrations : la tranche en dépend directement.

## Épreuve à repères

`epreuve` ne fabrique rien de publiable : il recopie un PDF assemblé en y
surimprimant le trait de coupe (rouge) et la zone de sécurité (bleu). C'est le
seul moyen de voir si un titre ou une bordure passe sous le massicot. À
regarder à l'écran, jamais à envoyer.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `charte.py` | Ordre du tome, cotes KDP, règle de nommage. Le seul à ouvrir pour préparer un Tome 2. |
| `kdp.py` | Les cinq sous-commandes. |
| `relecture/RELECTURE-TOME1.md` | Relecture en trois passes, page par page. |
| `relecture/TOME2-PISTES.md` | Expressions et prompts pour la suite. |

## Deux tomes, une seule chaîne

Le sommaire de chaque volume est dans `charte.py` (`TOME_1`, `TOME_2`) ; la
mécanique ne change pas. Les outils prennent `--tome` :

```bash
python3 kdp/kdp.py --tome 2 controler --source nommes/
python3 kdp/pipeline/assembler.py --tome 2 --planches … --complements … --vers …
```

**Un piège à connaître** : la règle de nommage ne contient pas le numéro de
tome. `RoussyEtZephy_Page19_Coloriage.webp` existe donc dans les deux volumes.
Gardez un dossier par tome — un mélange écraserait silencieusement des planches.

Le détail du Tome 2 — texte de bulle définitif, parchemins, prompts — est dans
`kdp/tome2/DOSSIER.md`.

## Les pages composées

Certaines pages ne sont pas des illustrations mais des compositions, et elles
l'emportent sur la planche quand les deux existent. Elles vivent dans le
dossier des compléments, nommées par le numéro de page qu'elles occupent.

| Page | Module | Pourquoi composée |
| --- | --- | --- |
| Faux-titre, mentions légales, solutions | `pages_texte.py` | Elles n'existent qu'en texte, et portent le volume au minimum de pages de KDP. |
| 01 · Ce livre appartient à | `page_garde.py` | La planche fournie faisait 1024 px, soit 119 DPI : il aurait fallu l'agrandir deux fois et demie. Une page presque vide se trace mieux qu'elle ne s'agrandit. |
| 15 · Le secret de l'hermine | `page12.py` | La planche n'existe pas ; le sommaire annonce l'histoire, le livre doit la raconter. En prose, en attendant. |
| 26 · L'hymne | `hymne.py` | Le QR incrusté est remplacé par un tracé vectoriel. |

### La règle du QR code

**Un QR imprimé ne doit jamais pointer ailleurs que vers un domaine qu'on
possède.** Une adresse de plateforme change ou disparaît, et le livre est déjà
chez le lecteur. Un domaine que l'on contrôle sert d'aiguillage : le contenu
peut déménager, la redirection se met à jour, et tous les exemplaires imprimés
continuent de fonctionner.

Deuxième règle, moins connue : **c'est la taille du plus petit carré qui décide
si un téléphone lit**, pas la taille du code. En deçà de 0,6 mm, la lecture
devient incertaine dès que l'éclairage baisse. `hymne.py` la mesure et prévient.

La correction d'erreur est réglée sur Q et non sur H. Le maximum est fait pour
les surfaces abîmées ou les codes portant un logo au centre ; sur une page de
livre propre, il ne sert qu'à multiplier les modules, donc à les rétrécir —
c'est lui qui faisait passer ce code-ci sous le seuil.

## Ce qui manque vraiment au tome 1 — compté le 31 août 2026

Le dépôt répétait depuis des semaines qu'il « manque une planche et une
couverture », et que rien ne sortirait tant qu'une image ne serait pas
fabriquée. **C'est faux, et la chaîne le prouve toute seule.** Les nombres
ci-dessous sont mesurés, pas estimés.

### Le compte des planches

| | |
| --- | --- |
| Pages au sommaire du tome 1 (`charte.TOME_1`) | **27** |
| Planches dessinées qui existent | **26** — toutes sauf la page 15 |
| Planches dessinées réellement imprimées | **25** — la page 01 est remplacée par du vectoriel |
| Plus le dos de couverture | 1 fichier, d'où les « 27 planches » de la mesure de piqué |
| Pages du PDF final | **30**, dont 3 composées : 01, 15, 26 |

**Une seule planche n'a jamais été dessinée** : la page 15, *Le secret de
l'hermine*. Elle est annoncée au sommaire et sur la quatrième, et `page12.py`
la raconte en prose vectorielle en attendant — le livre ne ment donc plus à son
lecteur, il change de registre sur une page.

**Une seule autre planche mérite d'être refaite**, et elle n'est pas manquante :
*Faire le singe* (page 04), agrandie ×2,41, piqué 819. C'est la recommandation
de `relecture/PASSE-RESOLUTION.md`, et c'est un gain de netteté, pas un blocage.

### Le livre est déposable aujourd'hui, sans une seule image neuve

Vérifié en faisant tourner la chaîne — compléments, assemblage, contrôle — **sur
des planches fabriquées pour l'occasion**, puisque le dépôt n'en porte aucune :
27 carrés de 2588 px, celui de l'hermine retiré pour reproduire la réalité.

Ce que cette mesure établit, et ce qu'elle n'établit pas. Elle établit tout ce
qui est **structurel** : le compte et la parité des pages, le format, la
géométrie de la couverture et de sa tranche, l'absence de carton d'attente, le
poids. Ce sont exactement les points sur lesquels KDP refuse un dépôt, et ils ne
dépendent pas du dessin. Elle n'établit rien sur le **contenu** : le contrôle
« toutes les images ≥ 300 DPI » passe ici parce que les carrés fabriqués sont à
2588 px — avec les vraies planches, c'est l'étape `normaliser` qui les y amène,
et `kdp.py controler` qui le juge en amont.

Autrement dit : la chaîne ne bute sur rien, et les deux trous ne sont pas des
trous. Le seul contrôle qui reste à faire sur les vrais fichiers est celui de
l'œil, et il se fait sur l'épreuve papier.

```
30 pages ≥ 24 · 30 pages, nombre pair · toutes les pages en 8.625 × 8.625 po
toutes les images ≥ 300 DPI · aucun carton d'attente · 3 Mo ≤ 650 Mo
une seule page · 17.3176 × 8.7500 po, tranche 1.72 mm pour 30 pages
9/9 contrôles passés. PUBLIABLE
```

La couverture provisoire de `couverture_face.py` n'est pas un carton d'attente :
elle emprunte son illustration à la page 21 et pose tout le texte en vectoriel.
Elle passe les cinq contrôles de `vignette.py`, et **le titre se lit à 150 px**
— surtitre, accroche, nom d'auteur et « Tome 1 » s'y perdent, ce qui est normal
et sans importance pour une vignette de boutique.

Ce qu'elle a contre elle tient en une phrase : **sa fenêtre d'illustration est
un bandeau au milieu de la page**, si bien qu'à 150 px les deux personnages y
seraient minuscules — or c'est le seul test qui décide d'une couverture
d'album. C'est pour cela que `--pleine-page` existe.

### Pourquoi on ne recadre pas un panneau de planche pour en faire la couverture

L'arithmétique tranche avant le goût. Le panneau de face fait **2588 × 2625 px**
à 300 DPI, et un panneau vaut environ 42 % du côté d'une planche :

| Source | Ce qu'on en tire | Agrandissement |
| --- | --- | --- |
| Un panneau d'une planche à 1600 px | 672 × 624 px | **×3,85** |
| Un panneau d'une planche à 2048 px | 860 × 799 px | **×3,01** |
| Une illustration pleine page à 1600 px | 1600 × 1600 px | ×1,62 |
| Une illustration pleine page à 2048 px | 2048 × 2048 px | **×1,26** |

La page 01 a été jugée inutilisable et remplacée par du vectoriel à **×2,54**.
Un panneau recadré est donc plus mou que le pire cas déjà écarté : cette piste
est fermée par le calcul, il est inutile de l'essayer.

Une illustration **pleine page**, en revanche, tient : à 1600 px elle tombe à
×1,62, l'agrandissement de la plupart des planches du recueil, et à 2048 px à
×1,26 — soit exactement la classe de *Avoir un chat dans la gorge*, la planche
la mieux résolue du livre.

### Le piège de `--pleine-page` : un avertissement DPI qui n'est pas un refus

`couverture_face.py --pleine-page` écrit **« ATTENTION : 183 DPI, il en faut
300 »** pour une illustration de 1600 px, et produit quand même le PDF. C'est
correct et ce n'est pas un échec : en pleine page, l'illustration couvre les
8,75 po du panneau, donc 1600 px font 183 DPI, 2048 px en font 234, et il en
faut 2588 pour atteindre 300.

Ce chiffre est à lire à côté de celui des planches, pas seul : **les seize
planches du recueil sont à 186 DPI et les trois meilleures à 237**. Une
couverture à 183 DPI n'est donc pas plus molle que le livre qu'elle annonce, et
`valider.py` ne contrôle pas le DPI de la couverture — il contrôle le format, la
page unique et l'absence de carton. L'avertissement dit où on en est ; il ne
refuse rien.

Mesuré : sur un essai pleine page de 1600 px, les cinq contrôles de
`vignette.py` passent — contraste 44, détachement 77, 15 masses — et à 150 px le
titre et l'accroche se lisent, les deux personnages tiennent chacun leur masse.
C'est ce que la mise en page en vignette ne fait pas, et c'est toute la raison
de préférer `--pleine-page`.

### Le chemin le moins cher jusqu'au dépôt

1. **Aujourd'hui, sans rien fabriquer.** Assembler avec la couverture provisoire
   et la page d'hermine en prose, déposer chez KDP, **commander l'épreuve
   papier** — elle ne publie rien (`depot/EPREUVE.md`). Deux semaines de délai
   d'impression qui courent pendant qu'on travaille la couverture.
2. **La couverture définitive part d'un essai qui existe déjà.** Trois essais
   ont été générés ; `relecture/COUVERTURE-FACE.md` en retient un — la falaise
   au couchant — comme le meilleur au test des 150 px. Son seul défaut est que
   les personnages sont de dos. Une couverture avec les héros de dos vaut mieux
   qu'un livre non publié, et `--pleine-page` la pose telle quelle.
3. **Refaire l'image seulement si l'épreuve papier la condamne**, et depuis
   l'appareil du propriétaire, qui a du vrai réseau.
