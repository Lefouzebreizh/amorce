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
Ces trois nombres sont **identiques sur le fichier livré** : c'est la preuve que
le son n'a pas été touché.

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

## Le découpage livré

Tête coupée à **0,6333 s** (19 images) : `Warning` tombe alors à **0,08 s** au
lieu de 0,70. C'est la seule seconde retirée du fichier, et elle ne contenait
que de l'ambiance à 30 dB sous la voix.

**Aucune seconde n'est retirée à l'intérieur.** Les treize coupes sont des
changements d'échelle sur un temps continu — voir `notice-de-montage.md`.

| # | montage | durée | échelle | ce que la coupe suit |
| --- | --- | --- | --- | --- |
| 1 | 0,00 | 1,27 s | visage ×1,35 | on entre dans son regard sur `Warning` |
| 2 | 1,27 | 0,93 s | plein cadre | `Sector 99` — on découvre l'orbe |
| 3 | 2,20 | 1,20 s | très serré ×1,45 | `is collapsing` |
| 4 | 3,40 | 0,97 s | l'orbe ×1,70 | **le trou de son** |
| 5 | 4,37 | 1,10 s | visage ×1,35 | `the Crimson Reaper emerges` |
| 6 | 5,47 | 1,00 s | plein cadre | l'attaque à −11,3 |
| 7 | 6,47 | 1,20 s | ×1,18 | les éclairs |
| 8 | 7,67 | 1,30 s | ×1,30 | le vortex, resserré |
| 9 | 8,97 | 1,70 s | **plein cadre** | **la révélation — intacte** |
| 10 | 10,67 | 1,50 s | ×1,22 | l'attaque à 11,30 |
| 11 | 12,17 | 1,40 s | plein cadre | l'attaque à 12,80 |
| 12 | 13,57 | 1,30 s | ×1,25 | la charge |
| 13 | 14,87 | 1,59 s | plein cadre | la crête à 16,60 |

**16,47 s, 494 images, 1,27 s de plan moyen.** Onze plans sur treize tombent
dans la bande 1,1–2,8 s que `src/lib/analysis.ts` récompense ; le rush n'y
plaçait rien, puisqu'il n'avait qu'un plan.

## Ce qui a été vérifié sur le fichier livré, pas sur un intermédiaire

Les trois relevés de `CLAUDE.md §8` :

1. **Planche de quarante images** sur toute la durée, dernière seconde comprise.
   Les changements d'échelle se lisent ; aucune image noire, aucun texte
   fantôme.
2. **Niveau entendu plan par plan**, au-dessus de 400 Hz. Le plus fort est **le
   climax** (−16,3 dB) ; le plan du trou mesure −37,4 dB, soit 20 dB sous ses
   voisins — la coupe est bien tombée dessus.
3. **Le raccord** : image 16,467 s, son 16,455 s. Le son traverse chaque coupe,
   puisqu'il n'a jamais été coupé.

Le calage a été mesuré, pas supposé : la première attaque passe de 0,720 s dans
le rush à 0,080 s dans le fichier livré, soit un déplacement de 0,640 s pour une
image déplacée de 0,633 s — **6,7 ms de dérive**, un cinquième d'image.

## Ce qui n'est pas fait

- **Pas de sous-titres.** L'EP01 en porte ; ils n'ont pas été demandés ici. Les
  trois passages sont mesurés ci-dessus, le calage se ferait en une passe.
- **Pas de carton de fin**, pas de titre, pas de numéro d'épisode. La série
  compte à rebours depuis Zéro-Cinq (`feuilleton-ep02.md`) et `Sector 99`
  n'entre pas dans ce compte : le rattachement au feuilleton n'est pas tranché.
- **Le son n'a pas été masterisé.** À −11,5 LUFS il est déjà au-dessus de la
  cible de `/master-telephone` ; y toucher aurait été toucher au son.
