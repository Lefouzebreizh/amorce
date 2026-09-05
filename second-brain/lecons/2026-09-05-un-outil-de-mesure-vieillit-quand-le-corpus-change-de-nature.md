# Un outil de mesure vieillit quand le corpus change de nature — 05/09/2026

## Ce qui a été mesuré

`chat-traducteur/scripts/mesurer_corpus.py` passe un dossier de sons dans la
chaîne et rend un tableau, colonne « intention » comprise. Il appelait le juge
**sans la tête acoustique** — un seul des deux étages du produit.

Conséquence chiffrée, sur les 40 vrais chats d'ESC-50 :

| | sans la tête | avec la tête |
| --- | --- | --- |
| une intention nommée | **3 / 40** | **31 / 40** |
| `indecis` | 37 / 40 | 9 / 40 |

Le premier chiffre a été rapporté au propriétaire comme l'état du produit, avec
la phrase « si tu mets ça en ligne demain, la plupart des gens verront *je n'ai
pas compris* ». C'était faux d'un facteur dix, et ça a failli peser sur une
décision de mise en ligne.

## Pourquoi personne ne pouvait le voir

**L'outil n'était pas faux quand il a été écrit.** Il avait été fait pour
ESC-50, un corpus où **aucun fichier ne porte d'étiquette de contexte** : on y
cherchait la porte et les scores de classes, jamais l'intention. Sur ce
corpus-là, `indecis` partout ne surprend personne — c'est même ce qu'on attend.

Le défaut naît le jour où le **corpus change de nature** : 28 enregistrements
dont le téléverseur écrit la situation dans le titre. La même colonne, le même
code, la même sortie — et d'un coup elle ment, parce qu'on lui pose enfin une
question à laquelle elle n'a jamais répondu.

## La règle

**Un outil de mesure se juge sur le corpus pour lequel il a été écrit.**
Quand le corpus change de nature — étiquettes qui apparaissent, provenance qui
change, question qui se déplace — l'outil est à relire avant d'être relancé,
même s'il n'a pas bougé d'une ligne et que ses résultats ont l'air normaux.

Le symptôme est traître parce qu'il est **plausible** : « le traducteur ne
comprend presque rien » est une conclusion crédible pour un produit jeune. Une
sortie fausse qui confirme ce qu'on redoutait ne se fait pas repérer.

Le contrôle qui l'aurait attrapé tient en une ligne, et il est général :
**faire passer le même fichier par l'outil de mesure et par le produit, et
exiger le même verdict.** Ici, `cli.py` disait `demande` là où le tableau
disait `indecis`, sur le même fichier, à la même seconde. Deux chemins vers la
même réponse doivent se contredire bruyamment ou pas du tout.
