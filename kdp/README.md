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
```

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
