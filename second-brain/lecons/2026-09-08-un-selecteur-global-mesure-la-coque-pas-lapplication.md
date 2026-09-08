# Un sélecteur global mesure la coque, pas l'application

*08/09/2026 — Amorce, `scripts/verify.mjs`*

## Ce qui a été mesuré

Un contrôle ajouté au parcours complet comptait les médias de la bibliothèque
avant et après un import, par `page.locator('li img').count()`. Même code, même
instant du parcours, deux profils :

| profil | compté avant l'import | réalité |
| --- | --- | --- |
| Ordinateur | **0** | 4 |
| Téléphone | 4 | 4 |

Le contrôle réclamait donc « 1 média » là où il y en avait déjà cinq, et
échouait sur l'ordinateur seul.

## Pourquoi

Les deux coques d'Amorce ne montent pas la même chose. L'ordinateur garde une
barre d'étapes et ne monte **qu'un panneau à la fois** : lu depuis l'étape
Export, le sélecteur ne trouvait aucune bibliothèque, parce qu'elle n'était pas
dans le document. Le téléphone est passé à une page unique qui défile, où les
**sept panneaux sont déjà là** : le sélecteur trouvait tout, quel que soit
l'endroit où l'on se croyait.

Le comptage était juste dans les deux cas. C'est la question qui ne voulait pas
dire la même chose : sur l'une des deux coques, « ce que le document contient »
et « ce que l'application contient » sont deux grandeurs différentes.

## La règle

**Sur une application à deux coques, un sélecteur qui ne nomme pas son panneau
mesure le montage du DOM, pas l'état.** Le corollaire pratique est court :
compter *après* être arrivé sur l'étape qui porte ce qu'on compte, jamais
avant — ou ancrer le sélecteur dans le panneau (`#etape-import li img`).

## Ce qui rend le défaut discret

Il ne se voit que sur **une** des deux coques, et c'est celle qui monte le
moins. La coque généreuse — celle qui a tout dans le document — rend le
contrôle vert et masque exactement le cas où il ne veut rien dire. Un parcours
qui n'aurait tourné que sur téléphone n'aurait jamais vu le problème, et le
contrôle serait parti au vert avec une mesure fausse dedans.
