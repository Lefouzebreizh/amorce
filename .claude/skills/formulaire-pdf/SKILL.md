---
name: formulaire-pdf
description: "Remplir un formulaire PDF — Cerfa, mandat de prélèvement, bulletin d'adhésion, dossier à compléter — avec l'outillage de `paper-manager` : repérer les champs, écrire un plan de remplissage rejouable d'une année sur l'autre, produire un PDF aplati prêt à imprimer. Couvre aussi les PDF plats, sans champs, remplis par coordonnées relevées une fois. À utiliser dès qu'il est question d'un Cerfa, d'un formulaire à remplir, de « remplir un PDF », d'un mandat SEPA, d'un dossier administratif à compléter, de champs de formulaire introuvables ou renommés, ou quand un PDF rempli ressort vierge à l'impression."
---

# Remplir un formulaire PDF

Outillé par `paper-manager/core/formulaires.py` et `paper-manager/paper.py`.
L'idée tient en une phrase : **le repérage se fait une fois et devient un
fichier**, parce que refaire le repérage chaque année est la corvée qui fait
abandonner l'outil.

## Le parcours

```bash
cd paper-manager

# 1. Ce que le PDF déclare
python3 paper.py champs coffre/formulaires/mon-cerfa.pdf

# 2. Le squelette de plan, pour ne pas recopier quarante noms de champs
python3 paper.py champs coffre/formulaires/mon-cerfa.pdf --gabarit \
        > modeles/formulaires/mon-cerfa.json

# 3. Compléter la section « champs » (voir table ci-dessous), puis remplir
python3 paper.py remplir modeles/formulaires/mon-cerfa.json \
        --abonnement maif-habitation
```

Le PDF vierge vit dans `coffre/formulaires/` — un binaire, donc hors du dépôt.
Le plan, lui, est du JSON versionné : c'est lui le travail.

## Ce qu'on écrit à droite dans un plan

| Écriture | Donne |
| --- | --- |
| `"{identite.nom}"` | une valeur de la configuration |
| `"{identite.prenom} {identite.nom}"` | plusieurs, composées avec du texte libre |
| `"{abonnement.engagement.fin}"` | une date, écrite JJ/MM/AAAA |
| `"{abonnement.montant}"` | un montant, à la virgule : 214,80 |
| `"{@aujourdhui}"` | la date du jour |
| `"{@aujourdhui:%Y}"` | la date du jour à un format choisi |
| `true` / `false` | coche ou laisse une case |

`abonnement` n'existe dans le contexte que si `--abonnement <id>` est passé ;
sinon le remplissage s'arrête en disant ce qui est disponible.

## Un PDF sans champs

`paper.py champs` répond « ce PDF est plat » : il faut alors une section
`positions`, en points, origine **en haut à gauche**.

```json
"positions": {
  "nom":        { "page": 1, "rect": [200, 88, 500, 106], "taille": 10 },
  "recommande": { "page": 1, "rect": [200, 150, 214, 164], "coche": "X" }
}
```

Deux façons de trouver ces nombres, sans jamais mesurer à la règle :

**Par le texte de l'étiquette** — la plus rapide quand le PDF a du texte :

```python
import pymupdf
page = pymupdf.open("coffre/formulaires/mon-cerfa.pdf")[0]
print(page.search_for("Référence client"))   # → [Rect(60.0, 88.2, 139.5, 103.3)]
```

La zone de saisie commence quelques points à droite du `x1` de l'étiquette et
partage sa hauteur : ici `[145, 88, 400, 104]`.

**Par l'image** — pour un scan, ou quand l'étiquette est une image :

```python
pymupdf.open("mon-cerfa.pdf")[0].get_pixmap().save("/tmp/page1.png")
```

Au zoom par défaut, **un pixel vaut exactement un point**, même origine
(vérifié : une page de 595 × 842 points sort en 595 × 842 pixels, et un
rectangle tracé en 200, 88, 500, 106 s'y retrouve au pixel près). Les
coordonnées lues dans n'importe quelle visionneuse d'images se recopient telles
quelles dans `rect`.

## Les cinq pièges

- **Un PDF rempli qui ressort vierge à l'impression.** Ses champs sont restés
  vivants et le lecteur n'a pas régénéré leur apparence. C'est pourquoi la
  sortie est **aplatie** par défaut (`bake`) : les valeurs sont gravées dans la
  page. Ne passer `--modifiable` que si quelqu'un doit encore éditer le fichier
  — et savoir que c'est ce risque qu'on reprend.
- **La valeur « cochée » n'est pas la même d'un formulaire à l'autre** : `/Yes`
  ici, `/1` ou `/Oui` ailleurs. Écrire `true` dans le plan et laisser le module
  lire l'état que la case déclare. Un plan recopié d'un autre Cerfa avec sa
  constante en dur coche dans le vide.
- **Un champ du plan absent du PDF arrête tout**, volontairement : un Cerfa qui
  change de millésime renomme ses champs, et neuf champs remplis sur douze
  donnent un dossier qui a l'air complet et revient trois semaines plus tard.
  Relancer `paper.py champs` et corriger le plan.
- **Sur le chemin par coordonnées, les polices de base sont en latin-1.** `œ`,
  `€` et le tiret cadratin y deviennent `?` sans le moindre avertissement —
  mesuré : « Cœur 78,42 € » ressort « C?ur 78,42 ? ». Le module les transpose
  (`œ` → `oe`, `€` → `EUR`) ; ne pas contourner cette transposition en écrivant
  directement dans la page.
- **Une croix se centre dans sa case, elle ne s'y « fait pas couler ».** Une
  case de formulaire fait quatorze points de côté, moins que la hauteur de
  ligne d'un texte de dix points : un texte posé dans un cadre trop court n'est
  **pas dessiné du tout**. C'est pourquoi une valeur `true` prend un chemin à
  part.

## Diagnostiquer

| Ce qu'on voit | Ce que c'est |
| --- | --- |
| « champs introuvables dans le formulaire : … » | le PDF a changé de millésime, ou le plan vient d'un autre formulaire |
| « rien nommé « abonnement » (disponible : identite) » | il manque `--abonnement <id>` à la commande |
| « ne tient pas dans le cadre à la taille 10 » | agrandir `rect`, ou baisser `taille` — rien n'a été dessiné |
| « le formulaire vierge ne doit pas être écrasé » | donner un `--vers`, l'original resservira l'an prochain |
| Le PDF produit est vide à l'écran | il a été rempli avec `--modifiable` et le lecteur ne régénère pas les apparences ; le refaire sans |
| Un accent devient `?` | chemin par coordonnées, police de base : passer par le module, pas par `insert_text` |

## Vérifier

```bash
python3 -m unittest discover -s paper-manager/tests -q
```

Ce que les tests ne diront jamais : qu'un **vrai** Cerfa porte les noms de
champs que son plan lui prête. Après avoir écrit un plan, ouvrir le PDF produit
et le lire — c'est la seule vérification qui compte, et elle prend trente
secondes.
