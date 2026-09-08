# Une coupe n'est pas un mouvement, et une moyenne en pixels par seconde les confond

*08/09/2026 — mesuré en éprouvant le recadrage suivi d'Amorce sur une vraie
vidéo 16:9. Vaut pour toute grandeur qui additionne des gestes de natures
différentes.*

## Ce qui a été mesuré

Une caméra virtuelle suit un sujet dans un rush large. Deux réglages à comparer :
sans déclarer les changements de plan, et avec les 33 coupes détectées.

| | images où la caméra bouge | déplacement moyen |
| --- | --- | --- |
| sans coupes déclarées | **49 %** | 108,7 px/s |
| avec les coupes | **20 %** | **204,7 px/s** |

Le second réglage est meilleur — la caméra reste immobile quatre fois sur cinq
au lieu d'une fois sur deux — et la moyenne le donne **deux fois pire**.

## Pourquoi

Parce que la moyenne additionne deux gestes que l'œil ne compare pas :

- un **panoramique** de 3 px par image, que le regard suit et qui, étalé, coûte
  peu à chaque instant ;
- une **coupe**, saut instantané de plusieurs centaines de pixels — qui n'est
  pas un mouvement du tout : l'image entière change au même moment, et personne
  ne voit le cadre se déplacer.

Déclarer les coupes remplace des dizaines d'images de panoramique par un seul
saut. Le total en pixels grimpe, et le résultat s'améliore.

## Ce qui ne suffit pas non plus

Retirer les images de coupe de la moyenne semble régler l'affaire. Mesuré :
104,9 px/s sans coupes déclarées contre **158,5** avec, sur 48 % des images
contre 19 %. **Les deux chiffres continuent de se contredire** — l'un dit
« moins souvent », l'autre « plus vite » — et aucun ne dit lequel se regarde
mieux.

## La règle

**Quand deux mesures d'une même grandeur se contredisent, aucune des deux n'est
la bonne : il faut regarder.** C'est le §8 de `CLAUDE.md` dans un cas neuf — la
parade n'est jamais de mesurer plus, c'est de mesurer ailleurs, et parfois il
n'y a rien à mesurer du tout.

La planche avant/après a tranché en une seconde ce que deux métriques n'avaient
pas tranché en trois essais : sur six instants, le suivi gagne franchement à
trois, ne change rien à deux, et **se trompe à un** — en cadrant un visage
d'arrière-plan plus grand que celui du sujet qui parle.

Ce dernier point est le vrai enseignement, et il n'apparaissait dans aucune
métrique : **le plus grand visage n'est pas le sujet.** Celui qui parle l'est.
C'est la raison d'être de la détection de locuteur actif, et une note de
cadrage qui ne regarde que les tailles de boîtes se trompera toujours au même
endroit.
