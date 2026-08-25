# Chaîne pré-presse — Roussy & Zéphy

Outillage de préparation KDP pour l'album illustré. Trois besoins, un seul
script : trier les rushes, contrôler ce qui bloque, assembler les PDF.

## Installation

```bash
pip install Pillow PyMuPDF
```

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

# 6. Vérifier ce que verra l'acheteur : la couverture réduite en vignette
python3 kdp/vignette.py --source couverture_kdp.pdf --vers .travail/vignette.png
```

`planches.py` mesure ce qu'aucun œil ne juge sur un écran : la résolution
effective une fois posée sur le gabarit, la hauteur d'œil du texte des bulles en
millimètres imprimés, l'épaisseur du trait et sa netteté. Il passe **avant**
l'assemblage, quand il est encore temps de refaire une planche. Ses tests :
`python3 -m unittest discover -s kdp/tests`.

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
