# Assistant d'allocation d'actifs

> **En sommeil — 26/08/2026.** Le code vit dans `archives-backlog/patrimoine/`,
> il n'a pas été touché. **27 tests, tous verts** au moment de la mise de côté.

## Pitch

Assistant d'allocation d'actifs en Python : un module `assistant.py`, une
configuration par fichier JSON, des cours récupérés via `yfinance`.

## Pourquoi il est ici

Deux fichiers source, mais vingt-sept tests qui passent — c'est un outil qui
fonctionne, pas une esquisse. Il est mis de côté parce que personne ne le fait
avancer, et non parce qu'il serait inabouti. La distinction compte : un projet
en sommeil se réveille en une soirée, une esquisse se recommence.

## Ce qui le ferait remonter

- Un besoin personnel réel de rééquilibrage de portefeuille — c'est le seul
  déclencheur crédible, l'outil n'ayant pas d'autre utilisateur.
- L'occasion de le brancher sur des données réelles suivies dans la durée :
  sans historique, il conseille sur du vide.

## État à la reprise

```bash
python3 -m unittest discover -s archives-backlog/patrimoine/tests   # 27 tests
cp archives-backlog/patrimoine/config.example.json <sa config>
```
