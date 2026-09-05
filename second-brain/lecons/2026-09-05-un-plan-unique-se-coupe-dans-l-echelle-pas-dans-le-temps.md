# Un plan unique se coupe dans l'échelle, pas dans le temps

05/09/2026 — mesuré en remontant un rush de génération de 17,10 s.

## Ce qu'on croyait

Un rush qui ne contient qu'un plan continu n'offre rien à monter : la détection
de coupe (`select='gt(scene,0.25)'`) rend zéro rupture de bout en bout. La suite
logique est de raccourcir — retirer des secondes pour serrer le rythme.

## Ce que ça coûte

Deux choses, et aucune ne lève d'erreur :

- **Une coupe dans le temps désynchronise les lèvres** dès que quelqu'un parle
  à l'image. Ici le personnage parle pendant les sept premières secondes.
- **Une coupe dans le temps oblige à couper le son avec.** Or un rush de
  génération porte presque toujours une construction sonore complète — attaques,
  trou, crête —, et la consigne était de n'y pas toucher.

## Ce qui marche

**Changer de cadre sans changer d'instant.** Treize plans ont été obtenus sur ce
rush en ne retirant **aucune seconde** à l'intérieur : chaque « coupe » est un
recadrage fixe différent posé sur un temps qui continue de couler.

La preuve que le son est intact tient en trois nombres identiques avant et
après : **−11,5 LUFS** intégré, **−1,6 dBFS** de vrai pic, **−15,2 LUFS**
au-dessus de 400 Hz. Les octets AAC ont été recopiés, pas ré-encodés — `-ss`
puis `-c:a copy` recale la piste sur la trame la plus proche.

Trois échelles suffisent à ce que la coupe se lise : plein cadre, buste (×1,2),
visage (×1,35 à 1,45). Le recadrage reste **fixe** pendant le plan : une origine
animée est tronquée à l'entier par ffmpeg et tremble.

## Le chiffre qui décide où couper

**Le trou de son vaut un plan à lui seul.** Entre deux phrases, 0,97 s mesurent
−37,4 dB quand leurs voisins sont à −20 : vingt décibels d'écart. Un montage qui
traverse ce trou sans changer de cadre laisse une seconde morte au milieu ; un
plan qui lui appartient en fait le seul endroit où l'image porte seule.

La règle générale : les coupes suivent les instants du rush — attaque, trou,
crête —, jamais une grille régulière.

## Le décalage résiduel se mesure, il ne se suppose pas

La tête a été coupée à 0,6333 s (19 images à 30 i/s), le son recalé de 0,640 s
(30 trames AAC de 21,33 ms). L'écart n'a pas été estimé : la première attaque a
été relevée à 0,720 s dans le rush et à 0,080 s dans le fichier livré, soit
**6,7 ms** de dérive — un cinquième d'image. Une trame AAC ne tombe pas sur une
image vidéo, et le seul moyen de savoir de combien est de mesurer le fichier qui
part.

## Où c'est écrit

`tiktok/notice-de-montage.md` porte la grammaire, `tiktok/feuilleton-crimson.md`
le découpage mesuré de ce montage-ci.
