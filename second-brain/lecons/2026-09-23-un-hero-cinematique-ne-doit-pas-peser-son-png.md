# Un hero cinématique ne doit pas peser son PNG

Mesuré le 23/09/2026 sur la nouvelle page d’accueil de Lefouzèbreizh Studio.
Le visuel du Phare numérique généré en PNG pesait 1 915 770 octets. Sa version
WebP servie par le site pèse 77 508 octets, sans dégradation visible lors du
contrôle du déploiement à 1 363 × 936 pixels.

## Ce qui est mesuré

| version | poids | écart |
| --- | ---: | ---: |
| PNG source | 1 915 770 octets | — |
| WebP publié | 77 508 octets | −96 % |

Le build de production passe, l’image déployée est complète et rendue à
1 186 × 668 pixels dans le navigateur. Le spectaculaire n’a donc pas besoin
d’être payé par près de deux mégaoctets transférés pour le seul hero.

## La règle pour l’écosystème

**Toute image maîtresse générée doit conserver son original hors du chemin
public et être publiée dans un format web mesuré.** La validation porte sur les
deux côtés : poids du fichier final et contrôle visuel du vrai déploiement.

La compression n’est pas une étape cosmétique après la création. Elle fait
partie de la direction artistique : une scène premium qui arrive tard donne
une impression moins premium.
