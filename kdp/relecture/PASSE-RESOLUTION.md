# La passe de résolution — ce que la mesure dit du plan

Projet retenu : *régénérer les vingt planches en 2588 px, en commençant par les
cinq au texte mou — Hermine, Ys, Faim de Loup, Chat dans la gorge, 7 différences.
Même invite, même graine, résolution maximale.*

Avant d'y passer une soirée, quatre faits mesurés. Trois changent la liste, le
quatrième change la méthode.

---

## 1. L'Hermine n'a pas de planche à régénérer

Son texte est **déjà vectoriel**. La page a été recomposée par `page12.py` :
le titre et le récit sont tracés, pas dessinés, donc nets à n'importe quelle
taille et corrigibles en une ligne. Régénérer cette page la ferait *reculer*
— on troquerait du texte vectoriel contre du texte pixellisé.

## 2. Trois des quatre autres sont parmi les planches les plus piquées

Mesure du piqué des contours, à taille égale, sur les 27 planches à leur
résolution native. Médiane du recueil : 862.

| Planche visée | Piqué | Rang sur 27 |
| --- | --- | --- |
| Le goûter des menhirs *(7 différences)* | 683 | **2ᵉ plus molle** |
| Le secret des vagues d'Ys | 888 | 19ᵉ — au-dessus de la médiane |
| Avoir une faim de loup | 891 | 21ᵉ — au-dessus de la médiane |
| Avoir un chat dans la gorge | 896 | 22ᵉ — et la **meilleure résolution native du livre**, 2048 px |

Une seule des quatre est justifiée par la mesure. « Chat dans la gorge » est
le contre-exemple parfait : c'est la planche la moins agrandie de tout
l'ouvrage (×1,27) et l'une des plus piquées. Si son texte paraît mou, la cause
n'est pas la résolution, et la régénérer ne la corrigera pas.

## 3. Les planches réellement molles sont ailleurs

Par ordre de gain attendu :

| | Planche | Piqué | Agrandissement |
| --- | --- | --- | --- |
| 1 | **Ce livre appartient à** | 674 | **×2,54** |
| 2 | **Le goûter des menhirs** | 683 | ×1,62 |
| 3 | Mon journal de lumière | 721 | ×1,62 |
| 4 | Le diplôme du Petit Phénix | 729 | ×1,62 |
| 5 | Dessine ton propre animal | 734 | ×1,62 |
| 6 | La météo de mon cœur | 736 | ×1,62 |
| 7 | Carte de l'île bretonne | 761 | ×1,62 |
| 8 | **Faire le singe** | 819 | **×2,41** |

Les deux en gras cumulent les deux défauts : peu piquées **et** agrandies
au-delà de ×2, la limite où la calligraphie décroche. Ce sont les deux seules
planches du livre dans ce cas, et les deux seules où la régénération apporte un
gain certain.

> **Ce que cette mesure ne voit pas.** Elle porte sur la planche entière, pas
> sur le texte. Un œil qui trouve une bulle molle a raison contre elle : c'est
> l'auteur qui avait vu le regard vide de Zéphy, qu'aucun script n'a détecté.
> Elle sert à ordonner l'effort, pas à contredire ce qu'on voit.

## 4. « Même invite, même graine » n'est pas réalisable

Deux obstacles, indépendants l'un de l'autre.

**Les invites du tome 1 ne sont conservées nulle part.** Elles ont été écrites
hors du dépôt et perdues avec la conversation. Celles du tome 2 existent
(`kdp/tome2/prompts.py`), celles du tome 1 non. Il faudrait les réécrire.

**Une même graine ne redonne pas la même image à une autre résolution.** La
graine fixe le bruit de départ, pas la composition : changer la taille de sortie
change le cadrage, la pose, le nombre de personnages. On obtiendrait des
planches *différentes*, pas les mêmes en plus net.

### Ce que cela implique

Régénérer une planche, c'est **refaire tout ce qui a été posé dessus** :
chirurgie de glyphe des coquilles, les sept écarts du jeu, les pupilles
redessinées, le recadrage à 7 %. Chaque planche régénérée annule le travail de
correction qu'elle portait.

---

## La recommandation

Ne pas faire les vingt. Faire **deux**, celles qui cumulent mollesse et
agrandissement au-delà de ×2 :

1. **Ce livre appartient à**
2. **Faire le singe**

Puis **Le goûter des menhirs** si le jeu des sept différences déçoit sur
l'épreuve papier — et seulement dans ce cas, car sa régénération oblige à
reposer les sept écarts un par un.

Le reste du recueil est à ×1,62 ou mieux, sous la limite où l'agrandissement
abîme. L'effort y serait dépensé sans gain visible sur papier.

**Et d'abord : regarder l'épreuve.** C'est l'encre sur le papier qui dit si un
texte est mou, pas un écran rétroéclairé qui grossit tout à 300 %.
