# Un seuil absolu ment sur les petites valeurs, et ses tests ne le voient pas

*Mesuré le 05/09/2026 sur `conseiller-patrimoine/analyse/ecarts.py`.*

La bande de tolérance du conseiller de patrimoine se compare en **points de
pourcentage** : sous cinq points d'écart avec la cible, on ne bouge pas. Le
raisonnement est juste — arbitrer coûte des frais et de l'impôt — et il est
écrit noir sur blanc dans l'en-tête du module comme dans son README.

Il est faux dès que la cible est petite. Sur une répartition très concentrée —
immobilier 95 %, crypto 3,5 %, bourse 1 %, liquidités 0,5 % — cinq points
absolus laissent passer :

| cible | part encore tolérée | soit |
| --- | --- | --- |
| 0,5 % | 5,5 % | **onze fois la cible** |
| 1 % | 6 % | six fois |
| 3,5 % | 8,5 % | 2,4 fois |
| 95 % | 100 % | 1,05 fois |

Vérifié sur le moteur réel avec un patrimoine fabriqué de 220 000 € : une poche
de liquidités à 10 780 € au lieu des 1 100 € visés sort « dans la bande, rien à
faire ». Seule la poche large est correctement gardée — c'est-à-dire la seule
sur laquelle l'auteur du seuil se représentait le problème.

**Ce qu'aucun test ne pouvait attraper**, et c'est le cœur : les tests du module
sont verts, et ils le resteraient. Ils éprouvent le calcul, `part - cible`, qui
est exact ; le défaut est dans l'**unité du seuil**, pas dans l'arithmétique.
Une suite écrite en même temps que la règle éprouve les valeurs auxquelles son
auteur a pensé, et il pensait à des poches de plusieurs dizaines de pour cent.

**Portée générale :** un seuil exprimé en écart absolu sur une grandeur qui
varie de plusieurs ordres de grandeur — pourcentages d'allocation, tailles de
fichier, durées, scores — ne garde que le haut de l'échelle. La parade tient en
une question à poser au moment d'écrire le seuil : *quelle est la plus petite
valeur légitime, et que tolère mon seuil à cet endroit-là ?* Si la réponse est
un multiple à deux chiffres, le seuil doit être relatif, avec un plancher
absolu pour ne pas devenir infiniment sévère près de zéro.

Le corollaire de méthode est déjà écrit ailleurs dans ce fichier, sous une autre
forme : ce n'est pas en mesurant plus qu'on trouve ce défaut, c'est en
**regardant un cas réel** — ici, la répartition réellement visée plutôt que
celle du jeu de tests.
