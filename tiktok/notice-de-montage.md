# Notice de montage du feuilleton

Comment se coupe un épisode ici. Pas ce qu'il raconte — ça, c'est `concepts.md`
et les fiches `feuilleton-*.md` ; pas la liste des défauts à relire avant de
rendre — c'est `/montage-sans-refaire` ; pas la façon de relever la grammaire
d'une vidéo qu'on admire — c'est `/video-de-reference`. Ici, uniquement **la
grammaire de coupe de cette série**, celle qu'on applique à un rush de
génération.

**Écrite le 05/09/2026, et elle n'existait pas avant.** Elle a été demandée
comme si elle existait — « la notice, comme on a dit » — et une recherche du
dépôt n'a rien rendu : la règle vivait dans la discussion, donc nulle part
(`CLAUDE.md §3`). Ce fichier porte ce que la demande a énoncé, plus ce qui a été
mesuré en l'appliquant. Ce qui n'est pas mesuré reste entre crochets.

## Les quatre règles énoncées

1. **Ça part direct.** Le premier plan est le sujet, sur la première image.
2. **Pas de plan d'ouverture décoratif.** L'œil cosmique de l'EP01 ouvrait sur
   1,33 s qui n'appartiennent à personne : il saute.
3. **Pas de plan statique.** Un cadrage qui tient plus de deux secondes sans que
   rien n'y change est une coupe qui manque.
4. **Coupes franches.** Aucun fondu enchaîné entre deux blocs.

## La cinquième, mesurée en montant CRIMSON

**Sur un rush d'un seul plan, la coupe se fait dans l'échelle, pas dans le
temps.** Un plan continu de dix-sept secondes n'a aucune coupe à donner ; il en
a autant qu'on veut si on change de cadre sans changer d'instant. Treize plans
ont été obtenus ainsi sur CRIMSON en ne retirant **aucune seconde** à
l'intérieur.

Ce n'est pas un contournement, c'est ce qui rend les quatre règles applicables
ici : couper dans le temps d'un rush où quelqu'un parle désynchronise ses
lèvres, et couper dans le temps d'un rush qui porte sa propre bande son oblige à
toucher au son.

Trois échelles suffisent à ce que la coupe se lise : **plein cadre**, **buste**
(≈ 1,2), **visage** (≈ 1,35 à 1,45). Au-delà de 1,7 le grossissement se voit sur
un détail net ; sur un fond flou il passe. Le recadrage est **fixe** pendant le
plan — une origine de recadrage animée est tronquée à l'entier par ffmpeg et
produit un tremblement (`second-brain/lecons/2026-09-03-zoompan-multiplie-les-images-dune-boucle.md`
et la leçon du même jour sur la capture 9:16).

## La sixième, et c'est la correction de la cinquième

**Sur un contenu qui ne change pas, une coupe d'échelle ne se lit pas comme une
coupe : elle se lit comme un zoom.** Et une suite de coupes d'échelle qui monte,
descend, remonte se lit comme un zoom avant-arrière à répétition — ce que le
propriétaire a renvoyé en une phrase : « ça fait mal au crâne ».

La cinquième règle reste vraie, elle était seulement incomplète. Le premier
montage de CRIMSON alternait 1,35 / 1,00 / 1,45 / 1,70 / 1,35 sur cinq plans du
**même visage immobile** : rien ne bougeait dans le cadre sauf le cadre. Les
huit coupes de la seconde moitié alternent tout autant — 1,00 / 1,18 / 1,30 /
1,00 / 1,22 — et ne gênent personne, parce que l'image y change à chaque fois :
explosion, éclairs, vortex, créature. Le contenu absorbe le changement
d'échelle ; sur un plan fixe, il n'y a rien pour l'absorber.

D'où la règle, qui ne s'applique qu'à l'intérieur d'un bloc où l'image ne change
pas :

- **l'échelle ne fait que croître**, jamais l'aller-retour ;
- elle croît **en continu** plutôt que par marches — une poussée lente de 1,08 à
  1,48 sur cinq secondes ne se remarque pas, cinq marches se remarquent toutes ;
- **le centre ne va pas et ne vient pas non plus.** Cette ligne disait le
  contraire — « descendre sur un objet puis remonter sur le visage est un
  regard, pas un zoom » — et elle a été renvoyée le jour même : « il faut que tu
  zoomes moins de haut en bas sur le druide, ça casse la tête ». Un
  déplacement vertical de 0,34 à 0,60 puis retour se lit exactement comme
  l'accordéon qu'on venait de corriger. Le centre reste fixe à quelques
  dizaines de pixels près, et le plan sur l'objet se sacrifie plutôt que de le
  payer ;
- **le seul retour au plein cadre est un événement** — ici l'explosion, qui le
  motive et le rend nécessaire.

## Où tombent les coupes

**Sur les instants du rush, jamais sur une grille.** Un rush de génération porte
presque toujours une construction sonore complète, et c'est elle qui commande :

```bash
python3 .claude/skills/voir-le-son/scripts/voir.py rush.mp4 /tmp/vu
```

Trois familles d'instants, dans cet ordre de priorité :

| ce qu'on entend | ce qu'on fait |
| --- | --- |
| une attaque — plus de 4 dB au-dessus de 400 Hz | une coupe dessus |
| un trou — 20 dB sous ses voisins | **un plan à lui seul** : le silence est une décision du rush |
| la crête | le dernier plan, et il reste plein cadre |

Le trou est celui qu'on oublie. Sur CRIMSON il dure 0,97 s entre deux phrases et
mesure −37,4 dB quand ses voisins sont à −20 : lui donner son propre cadrage —
l'objet qui va exploser, sans le visage — est le seul endroit du montage où
l'image porte seule.

## Ce qui ne se recadre jamais

**La révélation garde son image entière.** Le plan où la créature devient
lisible reste en plein cadre, du premier au dernier photogramme. C'est la règle
héritée de l'EP01, où le sous-titre lui-même avait été retardé de 0,20 s pour ne
pas la devancer.

## Le rugissement d'une créature

Un rush de génération montre souvent une gueule qui s'ouvre sans qu'on entende
rien. Deux chemins existent, et **l'ordre entre les deux est tranché** :

**On génère, on ne synthétise pas.** `montage-auto/cri_dragon.py` fabrique un
appareil vocal crédible sur le papier — source glottique, sous-harmonique,
formants — et son résultat a été renvoyé net : « horrible, ça ne va pas du tout
avec la créature ». Le connecteur ElevenLabs (`eleven_text_to_sound_v2`) rend un
vrai enregistrement pour **trois dixièmes de centime**, et ses fichiers
reviennent : ils sont servis depuis `storage.googleapis.com`, hôte joignable —
contrairement au CDN de higgsfield. Le synthétiseur reste utile quand le réseau
manque, jamais par préférence.

**Quatre variations, et on choisit sur la part au-dessus de 400 Hz.** Le même
prompt en a rendu une à **83 % sous** ce seuil — un silence sur un téléphone —
et une autre à 61 % dans la bande 400-3000 Hz. Soixante-six points d'écart pour
la même demande : la variation n'est pas un luxe, c'est la mesure qui décide.

**Un son généré ne se triture pas.** Ni bascule de présence, ni compression :
appliqués au cri de synthèse, ces deux gestes servaient à rattraper un manque de
corps, et sur un vrai enregistrement ils l'abîment. Le cri part au gain, point.

**Et le creux du rush descend AVANT la coupe, jamais dessus.** Une rampe posée
sur la coupe laisse passer la crête du rush en tête de plan à peine atténuée —
0,812 au lieu de 0,082, mesuré — et c'est elle, pas le cri, qui mange toute la
réserve de niveau. Trois cents millisecondes d'avance suffisent. C'est le seul
réglage de ce bloc qui a coûté cinq essais.

## La voix

**Un rush qui parle n'a pas besoin d'une voix off.** CRIMSON porte déjà la
grammaire de la série dans sa propre piste — trois passages, comme l'EP01 et
l'EP02 :

> **Warning.** — **Sector 99 is collapsing.** — **The Crimson Reaper emerges.**

Poser une voix off par-dessus, c'est deux voix qui se masquent. La décision
« voix off sur images » de `concepts.md` vaut pour un rush muet ; devant un rush
qui parle, elle tombe.

## Ce qui reste à mesurer

- [ ] **La cadence réelle du montage de référence.** Cette notice s'inspire d'un
      montage de quatorze secondes fait à la main, dont le fichier n'est pas
      ici. Tant qu'il n'a pas été mesuré par `/video-de-reference`, la durée
      moyenne de plan visée reste une intention, pas un nombre.
- [ ] **La durée d'épisode visée.** L'EP01 tient 15,5 s, CRIMSON 16,47 s. Aucune
      des deux n'a été comparée à l'autre sur la rétention.
- [ ] **Les sous-titres.** L'EP01 en porte, calés sur la voix et non sur les
      coupes. CRIMSON est livré sans : la question n'a pas été posée, et un
      élément ajouté sans demande est un élément à retirer.
