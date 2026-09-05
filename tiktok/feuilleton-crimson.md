# Feuilleton — CRIMSON · The Crimson Reaper

Ce que le rush contient, mesuré, et le découpage qui en a été tiré le
05/09/2026. Même nature que `feuilleton-ep01.md` : il documente un montage qui
existe, et tous ses instants sont relevés sur le fichier, aucun estimé.

Le fichier source (`CRIMSON_1080.mp4`) vit chez l'auteur — l'invariant du dépôt
interdit tout binaire versionné.

## Le rush

**17,10 s · 1080 × 1920 · 30 i/s · 9,6 Mb/s · AAC 48 kHz stéréo.**

**C'est un seul plan continu.** `select='gt(scene,0.25)'` ne trouve aucune
rupture de bout en bout : il n'y a pas une coupe à récupérer, il n'y a qu'un
cadre à découper.

Sonie : **−11,5 LUFS** intégré, vrai pic **−1,6 dBFS**, et **−15,2 LUFS**
au-dessus de 400 Hz — c'est-à-dire ce qu'un haut-parleur de téléphone restitue.
**La version 1 rendait ces trois nombres à l'identique** : le son n'y avait pas
été touché, les octets AAC étaient recopiés. La version 2 ajoute un rugissement,
donc elle réencode — et l'écart se lit : −11,7 LUFS au lieu de −11,5, porté en
entier par les 1,6 dernières secondes. Partout ailleurs, échantillon pour
échantillon, c'est le rush.

## La voix, qui est déjà dedans

Transcrite hors ligne (sherpa-onnx, whisper-small, aucun octet ne sort de la
machine), puis localisée en transcrivant quatre tranches séparément :

> **Warning.** — **Sector 99 is collapsing.** — **The Crimson Reaper emerges.**

**Trois passages, exactement la grammaire de l'EP01 et de l'EP02.** Relevés à
l'enveloppe au-dessus de 400 Hz, par tranches de 0,10 s :

| Passage | Début | Fin | Ce qui l'encadre |
| --- | --- | --- | --- |
| `Warning.` | 0,70 s | ≈ 1,05 s | 0,65 s d'ambiance muette avant lui |
| `Sector 99 is collapsing.` | 1,90 s | 4,05 s | un trou de 0,95 s après |
| `The Crimson Reaper emerges.` | 5,00 s | ≈ 7,20 s | l'explosion enchaîne |

Après 7,80 s, plus un mot : de la musique et des impacts.

**Conséquence de produit :** ce rush n'appelle pas de voix off. Le débat était
ouvert — il est tranché par la mesure, pas par un avis.

## La construction sonore du rush

Attaques relevées (saut de plus de 4 dB au-dessus de 400 Hz) :

| Instant | Niveau | Ce que c'est |
| --- | --- | --- |
| 0,70 | −12,7 | `Warning` |
| 1,90 → 4,05 | −14 à −25 | la deuxième phrase, modulée |
| **4,10 → 4,95** | **−40** | **le trou** — 20 dB sous ses voisins |
| 5,00 | −20,6 | la troisième phrase |
| **6,10** | **−11,3** | l'orbe éclate |
| **6,60** | **−11,0** | la seconde déflagration |
| 7,10 | −17,3 | les éclairs |
| 9,30 → 9,50 | −33 | la respiration avant la révélation |
| 11,30 | −17,4 | la bête pose son pied |
| 12,80 | −17,1 | la marche s'accélère |
| **16,60** | **−13,2** | la crête du film |

## Ce que l'image fait

| Instant | Ce qu'on voit |
| --- | --- |
| 0,00 → 5,90 | le druide, l'orbe entre ses mains — **presque immobile** |
| 5,90 → 6,60 | l'orbe éclate |
| 6,60 → 7,60 | les éclairs traversent |
| 7,60 → 8,30 | le druide se dissout |
| 8,30 → 9,60 | le vortex |
| **9,60 → 10,20** | **la révélation** — le Reaper devient lisible |
| 10,20 → 13,50 | il marche, lune rouge |
| 13,50 → 15,50 | il charge vers l'objectif |
| 15,50 → 17,10 | sa gueule en très gros plan |

**Le défaut du rush est là :** un tiers de la durée est un cadrage fixe sur un
visage. C'est exactement le « plan statique » que la notice interdit.

## Le découpage livré — version 3

Les versions 1 et 2 sont décrites plus bas, parce que ce qu'elles ont raté vaut
d'être gardé. Ce qui part aujourd'hui :

Tête coupée à **0,6333 s** (19 images) : `Warning` tombe alors à **0,08 s** au
lieu de 0,70. C'est la seule seconde retirée du fichier, et elle ne contenait
que de l'ambiance à 30 dB sous la voix.

**Aucune seconde n'est retirée à l'intérieur**, et les runes n'en ajoutent
aucune : elles sont en surimpression.

| # | montage | durée | cadre | ce que la coupe suit |
| --- | --- | --- | --- | --- |
| 1 | 0,00 | 3,40 s | visage, poussée 1,05 → 1,20, centre fixe | `Warning`, puis `Sector 99 is collapsing` |
| 2 | 3,40 | 2,07 s | visage, 1,28 → 1,44, centre fixe | le trou de son, puis `emerges` |
| 3 | 5,47 | 1,00 s | **plein cadre** | l'attaque à −11,3 : l'explosion |
| 4 | 6,47 | 1,20 s | ×1,18 | les éclairs — **les runes s'allument** |
| 5 | 7,67 | 1,30 s | ×1,30 | le vortex — **les runes s'ouvrent** |
| 6 | 8,97 | 1,70 s | **plein cadre** | la révélation — intacte |
| 7 | 10,67 | 1,50 s | ×1,22 | l'attaque à 11,30 |
| 8 | 12,17 | 1,40 s | plein cadre | l'attaque à 12,80 |
| 9 | 13,57 | 1,30 s | ×1,25 | la charge |
| 10 | 14,87 | 1,59 s | plein cadre | la crête — **le rugissement** |

**16,47 s, 494 images.** Le bloc du druide fait **deux plans**, son échelle ne
redescend jamais et son centre ne bouge pas — 0,345 puis 0,335, soit dix-neuf
pixels sur 1920.

### Les runes

Fenêtre : **7,867 → 8,800 s** en temps source, à cheval sur la coupe du vortex —
c'est ce qui les fait tenir les deux plans ensemble. Neuf glyphes angulaires,
tirés de l'écriture qui brûle déjà sur le front du druide, allumés un par un
autour d'un anneau de 335 px centré à 44 % de hauteur ; l'anneau se referme,
tient, puis s'ouvre de moitié en s'éteignant.

Dessinés en **mode Écran** par-dessus l'image, jamais à la place : la doctrine
de `motion/`, et la seule façon d'ajouter quelque chose sans toucher au son.
Chaque trait est peint trois fois — halo large et sombre, chair, cœur clair —
plutôt que flouté : sur 1080 × 1920 le flou coûte, les trois passes non.

**Non validées.** « Je n'imaginais pas ça comme ça, mais il faut voir. » Elles
restent en l'état tant que rien d'autre n'est demandé.

### Le rugissement

**14,60 → 16,47 s**, la crête du cri tombant sur la gueule ouverte.
`eleven_text_to_sound_v2`, prompt *« Colossal metallic beast roar, deep guttural
bellow with grinding steel resonance, close-mic »*, quatre variations à
0,3 centime pièce, la troisième retenue — 61 % de son énergie dans la bande
400-3000 Hz contre 17 % pour la première, qui aurait été inaudible.

Posé **sans aucun traitement** : ni égalisation, ni compression. Le rush s'efface
de 20 dB dessous, avec une rampe qui **descend avant la coupe**.

## Ce qui a été vérifié sur le fichier livré, pas sur un intermédiaire

Les trois relevés de `CLAUDE.md §8` :

1. **Planche de quarante images** sur toute la durée, plus une planche de neuf
   sur le seul bloc du druide : la tête ne bouge pas d'un pixel en hauteur, la
   poussée se lit sans marche. Les runes se voient sur trois vignettes ; aucune
   image noire, aucun texte fantôme.
2. **Niveau entendu plan par plan**, au-dessus de 400 Hz :

   | plan | entendu |
   | --- | --- |
   | l'explosion | −17,4 dB |
   | la charge | −17,3 dB |
   | **le climax — le rugissement** | **−13,4 dB** |

   Le climax est le plus fort, de 4,0 dB. Il ne l'était pas avant le
   rugissement : la charge et l'explosion se tenaient à 0,1 dB.
3. **Le raccord** : image 16,467 s, son 16,466 s. **Vrai pic −0,5 dBFS**, aucun
   écrêtage. Sonie −11,2 LUFS.

Et le contrôle qui dit qu'aucune dureté n'a été fabriquée : pendant le
rugissement, la bande 8-16 kHz mesure **−39,9 dB** sous la bande 300-3000 Hz,
soit **4 dB de moins** que pendant l'explosion. Le cri ajoute du corps, pas du
sifflement.

## Ce que les versions 1 et 2 ont raté

**La v1** découpait le bloc du druide en cinq plans d'échelles alternées —
1,35 / 1,00 / 1,45 / 1,70 / 1,35 — sur une image qui ne change pas. Renvoyée en
une phrase : « ça fait mal au crâne ». Cause écrite en sixième règle de
`notice-de-montage.md` : sur un contenu qui ne change pas, une coupe d'échelle
se lit comme un zoom.

**La v2** corrigeait l'échelle et déplaçait le centre à la place — 0,34 vers
0,60 puis retour, pour cadrer l'orbe pendant le trou de son. Renvoyée pareil :
« zoome moins de haut en bas, ça casse la tête ». Le va-et-vient vertical se lit
comme le va-et-vient d'échelle ; ce n'est pas l'axe qui gêne, c'est l'aller et
le retour.

**Et son cri était synthétisé** — deux caractères de `cri_dragon.py` mélangés,
basculés, comprimés. « Horrible, ça ne va pas du tout avec la créature. » Toutes
les mesures étaient pourtant au vert.

## Ce qui n'est pas fait

- **Pas de sous-titres.** L'EP01 en porte ; ils n'ont pas été demandés ici. Les
  trois passages sont mesurés plus haut, le calage se ferait en une passe.
- **Pas de carton de fin**, pas de titre, pas de numéro d'épisode. La série
  compte à rebours depuis Zéro-Cinq (`feuilleton-ep02.md`) et `Sector 99`
  n'entre pas dans ce compte : le rattachement au feuilleton n'est pas tranché.
- **Le son du film n'est toujours pas masterisé.** À −11,2 LUFS il est déjà
  au-dessus de la cible de `/master-telephone`.
