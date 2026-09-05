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
