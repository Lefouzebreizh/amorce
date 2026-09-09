# Un dégradé de texte suit la boîte, pas les lignes

*09/09/2026 — mesuré sur `annuaire-ia`, vaut partout où un titre porte un dégradé.*

## Ce qui a été mesuré

`background-clip: text` étale la course du dégradé sur la **boîte** de
l'élément, jamais sur chacune de ses lignes. Un `linear-gradient(90deg, …)`
posé sur un titre **centré qui passe à la ligne** donne donc à chaque ligne la
tranche de dégradé correspondant à sa position horizontale — et les lignes
courtes, centrées, tombent toutes au milieu.

Relevé sur le terrain de référence, 393 × 873, sur
« La Boîte à Outils IA des pros pressés » (trois lignes à cette largeur) :

| angle | ce qu'on voit |
| --- | --- |
| `90deg` | turquoise sur les deux premiers mots, **tout le reste violet** |
| `165deg` | chaque ligne reçoit sa part, du turquoise en haut au violet en bas |

Sur 1280 px de large, le même titre tient sur deux lignes et le `90deg` était
parfaitement correct. **Le défaut n'apparaît qu'au-dessous de la largeur où le
titre se replie**, ce qui est exactement le terrain réel.

## Pourquoi ça se rate

Le dégradé était juste tant qu'il portait sur **une seule ligne** : ici, un
`<span>` de première ligne. L'étendre au titre entier — geste anodin, une
classe déplacée d'un enfant vers son parent — change la boîte de référence, et
donc la répartition. Rien dans le CSS ne le signale, et `getComputedStyle`
rend fidèlement `linear-gradient(90deg, …)` dans les deux cas : **la mesure
confirme la déclaration, pas le rendu**.

## Le geste

Un dégradé sur un texte susceptible de passer à la ligne se pose en
**vertical** (ou franchement diagonal), jamais en horizontal. Vertical, la
part de chaque ligne ne dépend plus de sa largeur.

Et il se **regarde à la largeur du téléphone**, pas seulement à celle du poste
de travail : c'est la seule des deux où le titre se replie.
