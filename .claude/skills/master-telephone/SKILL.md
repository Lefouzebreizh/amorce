---
name: master-telephone
description: >-
  Sortir une vidéo au niveau d'un téléphone et non d'un cinéma — gagner cinq
  décibels réellement entendus sans écraser la dynamique, en remplissant
  la marge et en relevant la bande que la membrane restitue, jamais en
  compressant. À utiliser dès qu'une vidéo verticale part sur TikTok, Reels ou
  Shorts, et dès qu'une demande dit « on n'entend pas assez », « c'est trop
  faible », « il faut que ça envoie », « monte le son », « ça manque de
  puissance », « le son est plat », « pourquoi c'est si bas sur mon
  téléphone ». À utiliser aussi **avant toute publication**, même quand le
  mixage paraît bon : un mixage conforme aux normes de diffusion est
  systématiquement trop faible sur l'appareil où le format court est regardé,
  et rien dans les mesures habituelles ne le signale. Ici on **sort** un
  fichier ; pour fabriquer les sons, `/bande-son` ; pour juger un fichier
  suspect, `/voir-le-son`.
---

# Un mixage conforme est trop faible sur un téléphone

Les cibles de diffusion — −14 LUFS, dynamique de dix à vingt LU — viennent de
la télévision et du cinéma, où l'auditeur est assis, au calme, devant des
enceintes. Sur un haut-parleur de téléphone, dans un bus, **la moitié basse de
cette dynamique n'existe pas**, et le niveau moyen paraît lointain.

Le défaut ne se voit dans aucune mesure habituelle : le fichier est conforme.
C'est la conformité elle-même qui est le problème.

## Les trois chiffres à relever d'abord

```bash
ffmpeg -hide_banner -nostats -i film.mp4 \
       -af loudnorm=I=-14:TP=-1:print_format=json -f null -
```

| | cinéma | téléphone |
| --- | --- | --- |
| `input_i` (sonie) | −14 LUFS | **−9 à −10** |
| `input_lra` (dynamique) | 10 à 20 LU | 8 à 12 — *pas moins* |
| `input_tp` (vrai pic) | souvent −5 ou −6 | **−1** |

Le troisième est le plus révélateur. Un vrai pic à −5,7 dBTP signifie **près de
cinq décibels de marge jamais utilisés** : le limiteur était réglé à −1 et rien
ne l'a jamais atteint. C'est du niveau abandonné sans contrepartie.

## La chaîne, et pourquoi elle ne compresse pas

```bash
ffmpeg -i film.mp4 -af "
  highpass=f=55:poles=2,
  equalizer=f=2200:t=q:w=1.1:g=3.5,
  equalizer=f=4200:t=q:w=1.3:g=2.5,
  volume=5dB,
  alimiter=limit=0.891:level=disabled
" -c:v copy -c:a aac -b:a 320k -ar 48000 -movflags +faststart sortie.mp4
```

**Le passe-haut à 55 Hz** écarte ce qu'aucun téléphone ni casque grand public ne
restitue. Ce grave-là ne s'entendait pas mais occupait la marge du limiteur :
le retirer rend des décibels utilisables.

**Les deux cloches à 2,2 et 4,2 kHz** relèvent la bande où la membrane d'un
téléphone est la plus efficace. Deux à quatre décibels suffisent ; au-delà la
voix devient nasale.

**Le gain est linéaire.** C'est le point qui compte. Un compresseur remonterait
les creux et écraserait les sommets — mesuré sur un montage, un
`acompressor` à ratio 3 a fait passer la domination du plan final de **15,8 à
4,9 dB**, et un plan de transition est devenu plus fort que le rugissement. Le
compresseur travaille contre l'intention du montage, exactement comme
`loudnorm` en une passe.

## Ce que ça donne, mesuré

Sur un montage de dix-huit secondes :

| | avant | après |
| --- | --- | --- |
| sonie | −14,1 LUFS | **−9,8** |
| dynamique | 12,2 LU | 11,2 — l'arc survit |
| vrai pic | −5,7 dBTP | −0,8 |
| **niveau réellement entendu** (>400 Hz) | −23,2 dB | **−18,0** |
| domination du plan final | +7,2 dB | +6,7 |

**Cinq décibels gagnés là où l'auditeur écoute**, sans rien écraser.

Un mot sur ce chiffre, parce qu'il est facile à gonfler sans mentir. Mesuré sur
le **plan le plus fort**, le gain paraît de neuf décibels ; mesuré sur le film
entier, il est de cinq. C'est le second qui vaut : le premier ne décrit qu'un
instant, et c'est la moyenne qui décide de l'impression de puissance. Quand
deux mesures d'un même effet ne s'accordent pas, prendre la moins flatteuse.

## La mesure qui compte, et qu'on oublie

La sonie en LUFS pèse tout le spectre. Sur un téléphone, seul ce qui passe
au-dessus de 400 Hz existe :

```bash
ffmpeg -hide_banner -nostats -i film.mp4 \
       -af highpass=f=400,volumedetect -f null -
```

C'est **ce** chiffre qui dit si on entendra quelque chose. Deux fichiers à la
même sonie peuvent différer de dix décibels ici.

## Les trois erreurs à ne pas refaire

**Compresser pour gagner du niveau.** Ça marche, et ça tue le film. La force
vient de la marge et de la présence.

**Pousser au-delà de −9 LUFS.** Les plateformes normalisent : au-delà, elles
baissent le fichier et on perd la marge sans rien gagner. Entre −9 et −10, on
est au maximum de ce qui passe.

**Juger au casque.** Un casque restitue le grave et lisse tout. Le seul verdict
qui vaut se rend sur le haut-parleur de l'appareil visé — et à défaut, sur la
mesure au-dessus de 400 Hz.
