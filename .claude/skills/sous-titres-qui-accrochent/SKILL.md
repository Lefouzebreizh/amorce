---
name: sous-titres-qui-accrochent
description: >-
  Animer les textes d'une vidéo verticale pour qu'ils retiennent — apparition en
  ressort, secousse sur l'impact, couleur prise dans l'image, halo qui les
  détache d'un fond chargé. Couvre aussi où les poser pour qu'ils survivent à
  l'interface de la plateforme et au pouce qui fait défiler. À utiliser dès
  qu'une demande parle de sous-titres, de titre à l'écran, de texte incrusté,
  de rétention, de « rendre viral », de « ça manque de punch », de « les textes
  sont plats », de « on ne les voit pas », de « il faut que ça accroche » — et
  aussi, sans qu'on le dise, dès qu'on incruste du texte sur une vidéo destinée
  à TikTok, Reels ou Shorts. Ne pas attendre le mot « animation » : un texte
  statique sur un format court est un défaut, pas un choix.
---

# Un texte immobile ne retient pas

Sur un format court, l'œil suit ce qui bouge. Un sous-titre posé net et laissé
là est traité comme un élément d'interface — on le lit une fois, et le regard
repart chercher du mouvement ailleurs. Un texte qui **arrive** garde l'œil
deux dixièmes de seconde de plus, et deux dixièmes répétés cinq fois font la
différence entre une vidéo regardée jusqu'au bout et une vidéo abandonnée.

Tout ce qui suit se fait dans `drawtext`, sans calque ni post-production.

## Ce que `drawtext` accepte, et ce qu'il refuse

Vérifié, parce que la documentation ne le dit pas clairement et qu'un refus
tombe à l'exécution :

| paramètre | expression ? |
| --- | --- |
| `fontsize` | **oui** — c'est ce qui permet le ressort |
| `x` et `y` | **oui** — secousse, glissement |
| `alpha` | oui |
| `borderw` | **non** — « Option not found » |
| `fontcolor` | non |

Le contour reste donc fixe pendant que la taille varie. Sans importance : la
variation dure moins d'un cinquième de seconde.

## L'apparition en ressort

```
u        = max(0,t-DEBUT)
ressort  = min(1.14, 1-exp(-15*u)*cos(19*u))
fontsize = 'TAILLE*ressort'
```

La courbe part de zéro, **dépasse sa cible de 14 %**, revient. C'est le
dépassement qui accroche : une entrée qui grandit sans dépasser se lit comme un
fondu, et un fondu ne retient personne. Le plafond à 1,14 est nécessaire — sans
lui la première oscillation monte à 1,4 et le mot devient comique.

Les constantes se règlent ensemble : `exp(-15*u)` amortit, `cos(19*u)` oscille.
Amortir plus vite qu'osciller donne un seul rebond, ce qu'on veut. L'inverse
donne un texte qui vibre trois fois et paraît cassé.

## La secousse

```
x = '(w-text_w)/2 + FORCE*exp(-9*u)*(sin(2*PI*27*u)+0.6*sin(2*PI*11*u))'
```

**Deux fréquences sans rapport entier**, comme pour une caméra : une sinusoïde
seule se lit comme une vibration mécanique, leur somme ne se répète jamais et
l'oreille interne la lit comme un choc réel. Force utile entre 6 et 10 pixels ;
au-delà le texte devient illisible pendant qu'il tremble.

La secousse se réserve aux mots qui tombent **sur un impact** — pas sur chaque
réplique, sinon elle cesse d'être un accent.

## Deux passes : le halo, puis le texte

Un fond chargé avale un texte blanc, et la boîte noire qui règle le problème
fait « ajouté après coup ». La parade tient en deux `drawtext` superposés :

1. **le halo** — même texte, couleur vive du plan, contour épais
   (`borderw ≈ 0,22 × la taille`), opacité 0,55 ;
2. **le texte** — couleur claire, contour fin noir à 0,9.

Le halo détache, le texte reste net. Les deux partagent la même expression de
taille, sinon ils se décalent pendant le ressort.

## La couleur se prend dans l'image

Un sous-titre blanc sur une série colorée est un corps étranger. Mesurer la
teinte dominante des plans et en dériver deux valeurs — une claire pour le
texte, une vive pour le halo :

```bash
python3 scripts/teinte.py plan.mp4        # rend la teinte et deux couleurs
```

Sur une série mesurée à 178–198° de teinte, le blanc a cédé la place à
`#3fd4ff` avec un halo `#0090ff`.

**La couleur choisie n'est pas la couleur qui arrive.** Un premier essai à
`#b4f2ff` mesurait **12 % de saturation à l'écran** — le contour noir et la
compression délavent — et sous 20 % l'oeil lit simplement « blanc ». Il faut
donc choisir nettement plus saturé que ce qu'on veut voir, et **le vérifier sur
le rendu** :

```bash
ffmpeg -v error -ss <instant> -i film.mp4 -frames:v 1 image.png
# puis mesurer la saturation des pixels du texte, pas celle de la constante
```

Le halo suit la même logique : à 0,55 d'opacité et 22 % d'épaisseur il ne se
voyait pas, et un halo invisible ne détache rien — il coûte une passe de rendu
pour rien. À 0,90 et 30 %, il fait son travail.

## Où les poser

**Jamais sous 70 % de la hauteur.** La bande basse est mangée par la légende et
les boutons de la plateforme, et c'est aussi là que passe le pouce qui fait
défiler. Sur 1920 de haut, un texte vit entre **250 et 1300**.

Le haut de cadre est le meilleur emplacement pour un titre : il reste visible
quel que soit l'habillage, et il n'entre pas en concurrence avec le sujet, qui
occupe presque toujours le centre.

### Les trois habillages, relevés sur le terrain de référence

Mesuré sur des captures d'écran réelles — Redmi Note 12 Plus, TikTok, Instagram
Reels et Facebook Reels — et non déduit des chartes des plateformes, qui ne
disent rien de la barre système ni des bulles de profil.

| | haut occupé | bas occupé | colonne droite |
| --- | --- | --- | --- |
| TikTok | 9 % | à partir de 72 % | 49 → 81 % |
| Instagram | 9,5 % | à partir de 63 % | 65 → 89 % |
| Facebook | 12 % | à partir de 84 % | — (boutons à gauche, 14 → 22 %) |

**L'intersection décide, pas la plateforme la plus permissive.** Une même vidéo
part sur les trois, et c'est Instagram qui ferme le bas : sa légende occupe déjà
62 % de la hauteur. La limite basse commune est donc **1210 sur 1920**, et non
1300 — la valeur écrite plus haut passait sur TikTok et se faisait manger sur
Reels.

**La bande vraiment sûre pour un titre est 230 → 865**, soit 12 à 45 % de la
hauteur. Au-delà de 45 % on entre dans la colonne de droite de TikTok ; en deçà
de 12 % on passe sous la barre système de Facebook.

Un exemple qui vaut mieux qu'une règle : un titre gravé à **62 %** — « The
Root-Gorilla Titan Awakens » — était mangé à gauche par les bulles de profil de
TikTok **et** sortait du cadre à droite. Il était pourtant au-dessus des 70 %
que cette page interdisait.

### Et la bande sûre a une largeur, pas seulement une hauteur

Cette page n'a longtemps borné que la **hauteur**, et le même défaut est reparti
en publication. Relevé sur l'épisode 1 d'Aznaroth, publié le 31/08/2026 :

| titre | horizontal | verdict |
| --- | --- | --- |
| « RIFT ZERO FIVE » | 26,9 % → 70,3 % | dégagé |
| « THE SHADOW TITAN AWAKENS » | **9,8 % → 94,7 %** | mangé à gauche, au ras du bord à droite |

Les deux titres sont dans la bande verticale sûre, au même endroit, à la même
taille de police. Le second est simplement **plus long**, et l'éditeur l'a
étiré d'un bord à l'autre pour le faire tenir sur une ligne. C'est ce qui le
fait entrer dans la colonne de boutons de Facebook — 14 → 22 % — que le tableau
ci-dessus connaissait déjà sans que personne en tire de borne.

**Un titre vit entre 22 % et 88 % de la largeur.** En deçà de 22 %, les boutons
de Facebook ; au-delà de 88 %, on est au ras du bord, et un écran à coins
arrondis y mange la dernière lettre.

**Un titre trop long se casse en deux lignes, il ne s'étire pas.** Deux lignes
posées entre 15 et 25 % de la hauteur tiennent largement dans la bande sûre —
la hauteur disponible va jusqu'à 45 %, elle n'est jamais le facteur limitant.
La largeur, elle, l'est toujours.

## Les instants se relèvent, ils ne s'écrivent pas

Un sous-titre calé sur une grille tombe à côté de ce qui est dit. Relever les
groupes de parole d'abord, poser le texte ensuite :

```bash
python3 montage-auto/monter_episode.py --phrases plan.mp4
```

Leurs durées suffisent à reconnaître quelle réplique va où — « breach open » et
« the shadow titan awakens » ne durent pas la même chose. Le texte paraît un
dixième **avant** l'attaque et tient un quart de seconde après : avant, on lit
en même temps qu'on entend ; après, on a le temps de finir.

## Le piège qui annule tout

Un texte magnifique sur un plan qu'on ne voit pas ne sert à rien. Deux
vérifications avant de livrer, chacune en une commande :

```bash
# le texte est-il lisible sur le vrai rendu ?
ffmpeg -v error -ss <instant> -i film.mp4 -frames:v 1 -vf scale=150:267 vignette.png
# — puis la REGARDER. Une capture à la taille d'une vignette dit en une
#   seconde ce qu'aucune mesure ne dira.

# la vidéo n'est-elle pas trop sombre pour qu'on lise quoi que ce soit dehors ?
ffmpeg -hide_banner -nostats -i film.mp4 \
       -vf signalstats,metadata=print:key=lavfi.signalstats.YAVG -f null -
```

Sous 50 de luminance moyenne, un texte à contour noir disparaît sur un
téléphone regardé en extérieur. C'est mesuré, et ça s'est produit.
