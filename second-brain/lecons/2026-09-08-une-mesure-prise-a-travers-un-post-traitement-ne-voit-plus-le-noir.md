# Une mesure prise à travers un post-traitement ne voit plus le noir

*08/09/2026 — Amorce, `scripts/verify.mjs`*

## Ce qui a été mesuré

Un contrôle ajouté au parcours complet devait attraper une bande vide : un rush
16:9 posé dans un cadre 9:16 doit être **recouvert** — rogné sur les côtés — et
non **ajusté**, ce qui laisserait 68,4 % du cadre en noir. La sonde comptait la
part de pixels dont la moyenne des trois canaux dépasse 8.

Le défaut a été injecté pour de bon : `Math.min` à la place de `Math.max` dans
`drawCover`, soit exactement le « contain » que le contrôle annonce interdire.

| étalonnage au moment de la mesure | code intact | défaut injecté |
| --- | --- | --- |
| Cinéma, intensité 0,7 | 100,0 % peint — **OK** | **100,0 % peint — OK** |
| Naturel | 100,0 % peint — OK | **31,3 % peint — ÉCHEC** |

Le parcours laissait le rendu sur « Cinéma » : c'est l'étalonnage posé quinze
sections plus haut, et personne ne l'avait rapproché de la mesure d'après.

## Pourquoi

`Cinéma` pose une teinte d'ombres — `rgba(18,74,120,0.30)` — sur **tout** le
cadre, et remonte les noirs de 5 %. Les deux s'appliquent après le tracé de
l'image, donc aussi là où il n'y a pas d'image. Une bande jamais peinte y
ressort à une vingtaine de niveaux, largement au-dessus du seuil de 8.

Le seuil n'était pas trop bas : il pouvait descendre à 1 sans rien changer, le
vignettage ne ramène jamais la teinte à zéro. Ce n'est pas le réglage de la
sonde qui était faux, c'est **l'endroit de la chaîne où elle regardait**.

## La règle

**Une sonde qui mesure une absence doit être placée avant ce qui repeint tout.**
Un post-traitement qui couvre le cadre entier — teinte, voile, halo, grain,
fondu — remplit les trous en même temps que l'image, et une mesure prise après
lui ne distingue plus les deux. Le noir n'est plus noir : il est devenu une
couleur comme une autre.

Le correctif ne consiste pas à durcir le seuil, qui suivrait la teinte au lieu
de la traverser — c'est le même piège que la sonde calculée depuis la constante
qu'elle gardait (`2026-09-08-...` sur la zone morte du trépied). Il consiste à
**neutraliser la couche** : ici, repasser en « Naturel » avant de mesurer, une
ligne, et le contrôle sépare 100 % de 31,3 %.

## Ce que ça généralise

Le cas n'a rien de propre au canvas. Un même contrôle mesuré après un
normaliseur de niveau ne verra pas un silence ; après un `try/catch` qui rend
une valeur par défaut, pas une panne ; après un cache, pas une requête absente.
À chaque fois, **quelque chose de bienveillant a rempli le trou avant l'arrivée
de la sonde**, et le vert obtenu est le vert de ce remplissage.

Le geste qui l'attrape est toujours le même et il est déjà écrit ailleurs dans
ce dépôt : **injecter le défaut et exiger le rouge**. Ce qu'il faut y ajouter,
c'est que le rouge doit être obtenu *dans les conditions du contrôle réel* —
même étalonnage, même position dans la séquence. Un rouge obtenu sur un banc
isolé ne dit rien de ce que fera la sonde à sa place.
