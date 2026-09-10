# Un contrôle vert peut cacher un nombre qui a quintuplé

*10/09/2026 — Amorce, refonte visuelle*

## Ce qui a été mesuré

Un fond animé a été ajouté à toute l'application : deux disques de couleur
adoucis par `filter: blur(90px)`, animés en `translate3d` **et** `scale`, dans
une couche `fixed` sans interaction. Le parcours complet — 118 contrôles, deux
profils, un vrai Chromium — est resté **118/118 au vert**.

Un seul nombre avait bougé, dans le détail d'une ligne verte :

| relevé de cadence, profil téléphone bridé | valeur |
| --- | --- |
| la veille, sans le fond animé | **17 ms par image** |
| avec `blur(90px)` + `scale()` | **85 ms par image** |
| après correction | **17 ms par image** |

Cinq fois plus lent, et le contrôle ne s'en émeut pas : son seuil ne cherche
qu'un effondrement franc — « un palier tenable n'est pas abandonné à tort ».
85 ms reste tenable. Le seuil faisait exactement son travail ; il ne mesurait
simplement pas la question qu'on venait de poser.

## La cause

Deux effets qui s'additionnent, et le second est le plus coûteux :

- un `blur` de 90 px s'applique à toute la surface de l'élément — ici 90 vmax
  de côté, soit bien plus que l'écran ;
- un `scale` sur une couche floutée oblige le navigateur à la **re-tramer** à
  chaque image, au lieu de la déplacer. Une translation seule reste sur le
  compositeur ; une mise à l'échelle rappelle le fil principal.

La correction ne retire pas l'effet : le dégradé radial est **déjà doux à la
peinture**, donc aucun filtre, et l'animation ne garde que la translation. Même
rendu à l'œil, cadence d'origine retrouvée.

## La règle

**« Sur le compositeur » n'est pas une propriété de `transform`, c'est une
propriété du couple `transform` + ce qu'il y a dans la couche.** La liste
qu'on récite — n'anime que `opacity` et `transform` — est juste et
insuffisante : elle dit ce qu'on anime, jamais ce qu'on anime *sur quoi*. Un
`transform` sur une couche filtrée, masquée ou floutée coûte le prix fort.

Et la règle qui vaut au-delà du CSS : **un seuil vert ne dit rien de l'écart.**
Quand un changement touche une grandeur qu'un contrôle rapporte en clair —
millisecondes, octets, nombre d'images — on relit **le nombre**, pas la couleur
de la ligne. C'est le pendant exact de la leçon d'avant-hier sur la sonde posée
après un post-traitement : là, le vert venait d'un remplissage ; ici, il vient
d'un seuil large. Dans les deux cas, la ligne verte était sincère et la
conclusion qu'on en tirait, fausse.

## Le geste qui l'attrape

Noter la valeur **avant**, et la comparer après. Elle est déjà imprimée : ce
parcours affiche « 17 ms par image » depuis toujours, et personne ne l'avait
jamais lue comme une mesure de référence. Un nombre qu'un contrôle imprime sans
le comparer est un instrument qu'on transporte sans jamais le regarder.
