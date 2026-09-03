---
name: etalonner
description: "Faire tenir ensemble les plans d'un montage, puis poser un rendu filmique — détection des coupes, mesure de la luminance et de la dominante de chaque plan, correction des sauts, contraste en S, ombres froides et hautes lumières chaudes, grain, vignettage, et une planche avant/après à regarder. À utiliser dès qu'un montage assemble des rushes d'origines différentes — plans générés par IA, prises de plusieurs séances, images fixes mêlées à de la vidéo — et dès qu'une demande dit « ça fait amateur », « on dirait des clips collés », « ça manque de cinéma », « fais-le ressembler à un film », « qualité blockbuster », « étalonne », « les plans ne vont pas ensemble », « il y a un saut de luminosité », « c'est trop clair au début ». À utiliser aussi avant toute livraison d'un montage multi-sources : le saut d'exposition d'un plan à l'autre est le premier défaut que l'œil relève, et le dernier auquel on pense."
---

# Ce qui trahit un assemblage, c'est le saut

Deux images superbes qui ne partagent ni la même exposition ni la même
dominante se lisent comme deux extraits collés, jamais comme un film. Le défaut
n'est presque jamais dans un plan pris isolément — il est **entre** les plans.

C'est particulièrement vrai des rushes générés : chaque plan sort avec sa
propre température de couleur et sa propre exposition, parce que rien ne les
relie. Un film tourné a une seule caméra et un seul chef opérateur ; un lot
généré n'a ni l'un ni l'autre, et c'est exactement ce que le spectateur perçoit
sans savoir le nommer.

## Le geste

```bash
python3 scripts/etalonner.py <montage.mp4> [-o sortie.mp4] [--grain 5]
                             [--sans-rendu] [--force 0.75] [--mesurer-seulement]
```

Le script détecte les coupes, mesure chaque plan, calcule la correction, rend
le fichier étalonné — le son est **copié tel quel**, jamais réencodé — et
produit une planche avant/après.

Commencer par `--mesurer-seulement` : le tableau des écarts dit en trois
secondes s'il y a un problème et lequel, sans payer un rendu.

## Accorder, puis poser un rendu — dans cet ordre

**1. Accorder.** Rapprocher les plans qui divergent sans raison. *Rapprocher, pas
aplatir* : une bande-annonce a le droit de s'assombrir, et lui imposer une
exposition unique lui retirerait sa courbe.

La cible d'un plan est **la moyenne pondérée de ses voisins**, pas une moyenne
générale. Une première version ajustait sur une droite de tendance globale, et
elle réclamait d'assombrir le rugissement final d'un film — le plan qui doit
éclater. Une intention devenait un défaut à corriger. Ce qui saute à l'œil est
l'écart entre deux plans **voisins**, pas l'écart à une constante.

**2. Poser un rendu**, et seulement après. Contraste en S, ombres froides,
hautes lumières chaudes, grain, vignettage. Appliqué avant l'accord, un rendu
amplifie les écarts au lieu de les masquer ; et le grain se pose en tout
dernier, sinon les filtres suivants le lissent et il ne reste qu'un flou.

## Regarder la planche, toujours

Le script rend une bande avant/après, un plan par colonne. **Elle n'est pas
décorative : c'est la seule chose qui distingue un défaut d'une décision.**

Sur son premier usage réel, la mesure annonçait un plan d'ouverture à 187 de
luminance contre 60 pour le reste — un facteur trois, correctement relevé. La
planche a montré autre chose : ce plan n'était pas *clair*, il était **blanc**,
recouvert d'un voile. Un éclair blanc, déclenché par une animation dont l'état
de départ s'appliquait dès la première image, veilait six secondes de film.

L'outil avait donc entrepris d'assombrir un bug, ce qui l'aurait rendu
indétectable au lieu de le corriger. **Aucune mesure ne pouvait faire cette
distinction ; un coup d'œil l'a faite.**

## Les réglages qui comptent

**`--force`** (0,75 par défaut) borne la correction à trois quarts de l'écart.
À 1, l'ensemble devient plat et le grain des plans remontés ressort. Descendre
à 0,5 sur un montage dont les écarts sont voulus.

**`--grain`** (5 par défaut, 0 pour aucun). Le grain est ce qui sépare le plus
nettement une image de synthèse d'une image tournée : un capteur a du bruit, un
rendu n'en a pas. Au-delà de 10 il se voit ; en dessous de 3 il ne sert à rien.

**Le seuil de détection des coupes** est à 0,18 dans le script. Trop haut, deux
plans distincts reçoivent la même correction ; trop bas, un mouvement de caméra
rapide est pris pour une coupe et un même plan reçoit deux corrections — ce qui
se voit bien plus qu'un plan mal accordé.

## Ce que ça ne fait pas

L'étalonnage retire les marques de l'assemblage. Il ne crée pas de cinéma là où
il n'y en a pas : le cadre, le mouvement, le rythme et le son décident bien
avant la couleur. Un montage mal coupé reste mal coupé, mieux étalonné.

Et il ne touche pas au son — pour ça, `/voir-le-son` avant de livrer, et
`/bande-son` pour le mixage et la sonie.

## Ce que l'étalonnage ne peut pas faire : changer la couleur de la lumière

Une dominante se corrige, une exposition se rattrape, un saut entre deux plans
se recale. **La couleur de la source de lumière, non.**

Un visage éclairé en cyan — lumière de bord bleue sur la joue, halo bleu dans
la barbe — repeint en ambre se *voit* repeint, quel que soit le filtre. Cinq
méthodes ont été essayées sur le même plan : rotation de teinte avec masque de
luminance, masque de dominante bleue par `geq`, et trois réglages de
`selectivecolor`. La plus propre reste fausse à l'œil.

Deux pièges pour la route, chacun payé :

- **Une rotation de teinte globale casse ce qui était déjà conforme.** Les
  fissures dorées d'un globe, passées à −192°, sont devenues vertes.
- **Un agrégat de conformité ne voit pas un défaut local.** La passe qui
  produisait ces fissures vertes mesurait 0 % de cyan et 94,6 % d'ambre. Une
  mesure de teinte doit avoir un seau pour ce qu'elle ne cherche pas, sinon le
  défaut tombe entre deux catégories et disparaît.

Donc : avant de lancer le premier filtre, demander si la couleur à changer est
**dans la lumière** ou **sur la matière**. Si elle est dans la lumière, le
choix est de garder la source telle quelle ou de la regénérer — pas d'étalonner.
Détail et mesures dans `second-brain/lecons.md`.
