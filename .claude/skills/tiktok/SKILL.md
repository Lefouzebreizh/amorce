---
name: tiktok
description: Travailler les concepts et les scripts TikTok d'Erwann (`tiktok/`) — la ligne éditoriale à deux sujets, les huit formats répétables, les deux seuls dispositifs de tournage, et la façon dont un script s'écrit ici (les trois premières secondes, l'écriture pour l'oreille, les crochets qu'on ne remplit jamais à sa place). À utiliser dès qu'une demande parle de TikTok, de format court, de Reels, de Shorts, d'une accroche, d'un hook, d'un concept de vidéo, d'un script à tourner, d'une légende, d'une idée de contenu, du défi de percer, de rétention ou de vues — y compris quand elle dit seulement « trouve-moi des idées », « écris-moi un script » ou « qu'est-ce que je poste demain ».
---

# Travailler les concepts et les scripts TikTok

Ce volet ne contient pas de code. Il contient ce qui se décide **avant**
d'ouvrir un logiciel. Le montage vient ensuite, et c'est le studio Amorce, à la
racine du dépôt, qui s'en charge.

`tiktok/README.md` porte la méthode complète, `tiktok/concepts.md` les huit
formats, `tiktok/scripts/` les scripts écrits. **Les lire avant d'écrire quoi
que ce soit** : ce qui suit ne dit que ce qui décide de chaque phrase.

## La voix, d'abord

Tout texte produit ici est destiné à son public. La compétence
`charte-editoriale` fait foi pour le ton, et elle n'est pas optionnelle : un
script écrit hors de cette voix est à jeter, pas à retoucher. Sa liste des
tournures qui trahissent une écriture automatique vaut mot pour mot pour une
accroche de trois secondes.

## Les six règles qui décident

1. **Un concept, pas une idée.** Une idée fait une vidéo ; un concept en fait
   vingt. Le test tient en une question : *« si celle-ci marche, je sais quoi
   tourner la semaine prochaine ? »* Non → ce n'est pas encore un concept, et
   il ne rentre pas dans `concepts.md`.
2. **Deux dispositifs, et rien d'autre** : voix off sur images, capture
   d'écran. Ni face caméra, ni décor, ni lumière. Ce n'est pas une limite à
   contourner en proposant mieux — c'est ce qui fait qu'une vidéo se tourne le
   mardi soir. Un concept qui demande autre chose ne se propose pas.
3. **Les trois premières secondes sont tout.** Le spectateur ne choisit pas de
   regarder, il choisit de ne pas passer. Même fenêtre que `HOOK_WINDOW = 3`
   dans `src/lib/analysis.ts`, où le hook pèse 30 points sur 100.
4. **Ça s'écrit pour l'oreille**, et ça se chronomètre : environ **2,5 mots
   par seconde**. Un script de 30 s tient en 75 mots. Un script qui déborde ne
   se lit pas plus vite, il se coupe.
5. **On ferme la boucle qu'on a ouverte.** Une accroche qui promet et une
   vidéo qui ne donne rien coûte l'abonné définitivement — plus sûrement qu'une
   vidéo tiède.
6. **Une seule idée par vidéo.** S'il y en a deux, la seconde devient le script
   suivant.

## Les crochets

`[90 jours]`, `[412 vues]`, `[trois semaines]` marquent ce que **personne ne
peut écrire à sa place** : ses chiffres, ses délais, ses décisions. Même
convention que `src/lib/hooks.ts`.

Ne jamais les remplir en inventant une valeur plausible. Un chiffre inventé
dans un concept fondé sur l'honnêteté — « les chiffres du jour N », « la faute
que j'ai laissée passer » — détruit exactement ce qui fait marcher le format.
Dans le doute, on laisse le crochet et on le signale.

## Écrire un script

Recopier `tiktok/modele-script.md`, le remplir, le déposer dans
`tiktok/scripts/NN-titre-en-minuscules.md`. Trois sections ne sont pas
décoratives :

- **« Ce que le spectateur emporte »**, en une phrase. Si elle ne s'écrit pas,
  la vidéo n'a pas de sujet et le reste ne servira à rien.
- **« Ce qui peut rater »** nomme ce qui, au tournage ou au montage, fera
  capoter *cette vidéo-là* — pas des conseils de portée générale. C'est la
  section qui fait gagner une prise.
- **« Après publication »** reste vide jusqu'à la publication. C'est elle qui
  transforme une intuition en leçon ; la remplir d'avance revient à inventer un
  résultat.

## Le dosage

**Deux vidéos « Créer avec l'IA » pour une vidéo « Le défi ».** Le premier
sujet va chercher des inconnus, le second les garde. Proposer une série qui
penche du côté du feuilleton, c'est proposer une chaîne qui plafonne à ceux qui
sont déjà là.

## Ce qu'on ne fait pas

- **Pas d'accroche qui ment**, même habile.
- **Pas de tendance qu'on ne comprend pas** : un son qui tourne et qui ne dit
  rien de lui ramène des vues qui ne reviennent pas.
- **Pas d'affirmation sur l'algorithme du moment.** Ce dossier tient ce qui ne
  bouge pas — l'attention se gagne en trois secondes, une histoire commencée
  réclame sa fin, un haut-parleur de téléphone ne descend pas sous 400 hertz.
  Ce que la plateforme récompense cette semaine ne s'écrit pas ici : ça se
  mesure en publiant, et ça se note en bas des scripts.
- **Rien sur sa vie privée.** Le défi se raconte, l'intime non — c'est la même
  règle que dans la charte éditoriale, et elle ne souffre pas d'exception.
