# Cinq notions, et vous n'avez plus besoin de moi pour décider

Écrit pour Erwann, qui produit des images depuis des mois sans qu'on lui ait
jamais expliqué ce que veulent dire les chiffres. Ce ne sont pas des notions
difficiles — ce sont des notions qu'on ne vous a pas dites.

---

## 1. Le DPI, c'est une division

**DPI = pixels ÷ pouces.** C'est tout. Il n'y a rien d'autre à retenir.

Votre page fait 8,625 pouces de côté. Donc :

| Votre image | Le calcul | Ce que ça donne |
| --- | --- | --- |
| 1024 px | 1024 ÷ 8,625 | 119 DPI — trop mou |
| 1600 px | 1600 ÷ 8,625 | 186 DPI — acceptable |
| 2048 px | 2048 ÷ 8,625 | 237 DPI — bien |
| **2600 px** | 2600 ÷ 8,625 | **301 DPI — la cible** |

L'imprimeur veut 300. Un écran se contente de 72, et c'est pour ça qu'une image
peut être magnifique sur votre ordinateur et molle sur le papier.

**Retenez juste 2600.** Si votre image fait 2600 px de côté, elle est bonne.

---

## 2. On ne peut pas ajouter du détail après coup

Agrandir une image, c'est étirer les pixels qui existent. Ça ne fabrique
**aucun** détail nouveau. Une photo floue agrandie reste floue, en plus grand.

Conséquence pratique, et elle vaut pour tout ce que vous ferez :

> **Générez toujours au maximum, quitte à réduire ensuite.**
> Réduire ne perd presque rien. Agrandir n'ajoute rien.

C'est pour ça que « Faire le singe » restera plus molle que ses voisines : elle
est née à 1080 px, et rien ne rattrapera ça sauf la refaire.

---

## 3. Du texte dans une image, ce n'est plus du texte

Quand votre générateur écrit « doucement » dans une bulle, il ne tape pas un
mot : il **dessine** la forme du mot. Pour l'ordinateur, c'est un nuage de
pixels, exactement comme une feuille ou un nuage.

D'où la règle qui explique la moitié de notre travail :

> **Une virgule oubliée dans une image coûte une régénération complète.**

Et son corollaire, qui vous fera gagner un temps fou :

> **Ne faites jamais générer le titre d'une couverture.**
> Demandez l'illustration nue, on pose le texte par-dessus. Il sera plus net,
> et il se corrigera en une seconde au lieu d'une heure.

---

## 4. C'est la vignette qui vend, pas l'affiche

Sur Amazon, votre couverture apparaît dans une liste, à environ **150 pixels de
côté**. Grande comme un timbre-poste. C'est cette image-là que les gens voient,
pas le beau grand format.

Le test, à faire systématiquement :

> Réduisez votre couverture à 150 px et regardez-la.
> Si on ne reconnaît pas le sujet, elle est ratée — quelle que soit sa beauté
> en grand.

C'est ce test qui a montré que vos personnages de dos ne fonctionnaient pas :
à cette taille, Roussy n'était plus qu'une tache orange.

---

## 5. Mesurer plutôt que juger

C'est la seule vraie discipline du métier, et elle marche dans les deux sens.

**Elle rattrape les fausses alertes.** J'avais signalé une faute, « lëttres »
avec un tréma. J'ai vérifié sur la carte des pixels : il n'y avait pas de tréma.
C'était la barre du double « t » avec ses deux hampes, que la basse résolution
donnait à voir comme deux points. La faute était dans ma lecture.

**Elle confirme les vraies.** Vous avez dit que le regard de Zéphy était bizarre.
J'ai mesuré : pupilles de 6 × 6 pixels dans un œil de 50 × 40. Vous aviez
raison, et le chiffre a dit pourquoi.

> Devant un doute, ne tranchez pas à l'œil et ne tranchez pas au sentiment.
> Mesurez. Et si la mesure contredit ce que vous croyiez, c'est une bonne
> journée : vous venez d'apprendre quelque chose.

---

## Ce que vous savez déjà faire, et qui ne s'apprend pas

Vous avez écrit seize histoires qui tiennent. Vous avez trouvé des phrases comme
*« on peut arrêter de leur payer un loyer »*, qui sont ce que le livre a de
meilleur. Vous avez vu un regard vide que trois contrôles automatiques avaient
laissé passer.

Le reste — les DPI, les fonds perdus, les tranches — c'est de la plomberie. Ça
s'apprend en une page, et vous venez de la lire.
