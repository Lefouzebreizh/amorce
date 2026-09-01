# Accord — l'éveil des couleurs

> **Cadré le 31 août 2026.** Module distinct de Look & Find, dans la même base
> de code : `look_and_find/lib/features/accord/`. Look & Find identifie des
> objets ; Accord répond à une seule question — **qu'est-ce qui va avec cette
> couleur**.

## Pitch

Photographier un mur, un canapé ou un sol. Accord en tire la couleur dominante,
son code hexadécimal et son nom parlé, puis trois harmonies — complémentaire,
analogue, triadique — traduites en objets concrets : coussin, tapis, plante,
pot. Chacune arrive avec ses proportions 60 / 30 / 10.

**Périmètre de la version un : décoration d'intérieur uniquement.** Pas de
vêtements, pas de carrosserie. Ce sont d'autres métiers, d'autres contraintes
de lumière, et les mélanger diluerait les trois.

## Objectif mesurable

**Sur dix photos d'intérieur réelles, rendre une palette pour les cinq qui le
permettent, et refuser les cinq autres en nommant la cause.** Aucun faux
positif : une palette calculée sur une photo inexploitable est fausse, pas
approximative — et quelqu'un qui achète un coussin sur cette foi paie l'erreur.

## Score de faisabilité — 8/10

| Critère | Note | Justification |
| --- | --- | --- |
| Temps / Effort | 7/10 | La porte est faite. Les harmonies sont de l'arithmétique sur la teinte. La version un complète, avec ses écrans, tient en deux à quatre semaines. |
| Complexité technique | 8/10 | `NameColor` est réutilisé tel quel. Rien à apprendre, sauf le réglage des seuils, qui demande de vraies photos. |
| Coût / Rentabilité | 10/10 | Tout est local. Ni clé, ni réseau, ni quota — comme `NameColor`, et pour les mêmes raisons. |
| Alignement | 8/10 | Même application, même caméra, même architecture, et il repose sur une brique déjà livrée. |

## La contrainte qui gouverne tout

**Sur dix photos d'intérieur prises pour de vrai, cinq étaient inexploitables** :
contre-jour, surface trop sombre, dominante parasite venue d'une bâche verte au
fond du jardin.

Un module qui calcule d'abord et se protège ensuite aurait donc sorti une
palette fausse **une fois sur deux**, avec le même aplomb que sur les cinq
bonnes. D'où l'ordre : **la porte se code avant les harmonies**, et elle est
faite.

Elle refuse pour cinq causes, et chaque refus porte un geste à poser — un refus
sans geste est une impasse, la personne réessaie la même photo et obtient le
même refus.

| Refus | Le geste proposé |
| --- | --- |
| Contre-jour | Se tourner pour avoir la fenêtre dans le dos. |
| Surexposée | S'éloigner de la source, ou viser une zone à l'ombre. |
| Trop sombre | Se rapprocher d'une fenêtre, ou allumer. |
| Couleurs en conflit | Cadrer une seule surface à la fois. |
| Surface délavée | Choisir une surface qui a une couleur — un gris s'accorde avec tout. |

## Plan d'action (MVP)

| Étape | Livrable | Délai |
| --- | --- | --- |
| ~~1 — La porte~~ | **Faite le 31/08/2026.** `JudgePhoto.juger()` et `PhotoVerdict`, 11 tests. Cinq refus, chacun avec son conseil. | ✅ |
| ~~2 — Les trois harmonies~~ | **Faite le 31/08/2026.** `BuildHarmonies.pour()`, 13 tests. Chaque harmonie rend un 30 % et un 10 % avec leurs objets. | ✅ |
| ~~3 — Les objets et les proportions~~ | **Faite le 31/08/2026**, avec l'étape 2. Chaque proposition porte sa part et ses objets ; la plante n'apparaît que là où la couleur calculée tombe dans les verts. | ✅ |
| **4 — L'écran** | Viseur, verdict, palette, objets. En dernier, comme pour `NameColor`. | après |

## Deux décisions prises au cadrage

**Le mur est le 60.** La dominante n'est donc jamais une harmonie : elle est la
base, et **chaque** harmonie porte son propre 30 % et son propre 10 %. C'est ce
qui rend les objets concrets — on propose un coussin complémentaire, jamais un
mur complémentaire.

_Cette fiche a d'abord écrit « l'analogue prend les 30 %, la complémentaire les
10 % », ce qui répartissait les proportions **entre** les harmonies au lieu de
les donner **à chacune**. Le cadrage disait « chacune accompagnée des
proportions 60 / 30 / 10 » ; le code l'a suivi, le résumé s'en était écarté._

**La dominante n'est pas le pixel le plus fréquent.** Un mur photographié porte
ses ombres d'angle et ses reflets de fenêtre ; un histogramme naïf en fait trois
couleurs et retient souvent l'ombre. Le regroupement se fait par famille de
teinte, en écartant ce qui est trop sombre ou trop clair pour porter une
couleur.

## Ce que dix-sept photos réelles ont corrigé — 31 août 2026

La première porte cherchait **deux teintes qui s'affrontent**. Passée sur
dix-sept photos d'intérieur réelles, elle en a accepté **quinze**, et rendu pour
presque toutes le même brun boueux autour de `#8D704B`.

La cause : ce sont des photos de **pièces entières**. Le parquet, les murs et la
lumière chaude tombent dans la même famille de teinte — aucun conflit, donc
aucun refus, et une moyenne de pièce qui n'est la couleur de rien.

**Ce qui sépare une surface d'une pièce n'est pas le désaccord, c'est la
dispersion**, et la mesure les sépare franchement :

| | Part de la teinte dominante | Concentration des teintes |
| --- | --- | --- |
| Cadre tenu par une surface | 0,58 – 0,95 | **0,82 – 1,00** |
| Pièce entière | 0,21 – 0,39 | **0,12 – 0,59** |

Un vide net entre 0,59 et 0,82. Les seuils — 0,50 de part dominante, 0,70 de
concentration — sont posés dedans. La porte accepte désormais **quatre** de ces
dix-sept photos.

**Ce que ce lot ne prouve pas**, et qu'il faut dire : aucune de ces photos
n'avait été cadrée *pour* Accord. Ce sont des chats, des gens, des écrans, des
pièces. En refuser treize est le comportement attendu, pas de la sévérité — mais
le lot ne contient aucun mur volontairement cadré, donc il ne démontre pas que
la porte laisse passer le geste normal. **Trois photos de mur cadrées exprès
manquent encore**, et elles seules diront si le seuil est trop haut.

Le test des deux blocs francs — la bâche verte — reste en place : deux surfaces
nettes ne dispersent pas les teintes, elles en concentrent deux, et la mesure de
dispersion seule ne les verrait pas.

## Ce que l'étape 2 a appris, en regardant plutôt qu'en mesurant

Les treize tests passaient. C'est en **affichant les palettes** que deux défauts
sont apparus, et aucun n'était visible autrement.

**Une réponse vraie peut être inutile.** Sur un mur vert, l'analogue rendait
« vert » : l'angle était juste, le conseil ne disait rien — « posez un tapis
vert sur votre mur vert ». La première parade, écarter la teinte jusqu'à changer
de nom, échoue pour une raison de fond : la bande du vert fait quatre-vingts
degrés, on n'en sort pas sans cesser d'être analogue. **Ce n'est pas le nom qui
doit différer, c'est la valeur.** Le tapis analogue est désormais posé
franchement plus clair ou plus sombre que le mur — sur le vert, 0,63 contre
0,47. « Un tapis vert plus clair » se voit, s'achète, et reste analogue.

**Un mélange d'unités ne lève aucune erreur.** La conversion vers le
rouge-vert-bleu recevait une saturation TSV et la traitait comme une saturation
TSL. Résultat : un tapis à 0,62 de saturation là où la borne demandait 0,45 —
une couleur qui crie, alors qu'une constante existait pour l'en empêcher. Rien
ne l'aurait signalé sans le test de borne, parce que la couleur restait
plausible.

## Ce qui manque, et qui ne se code pas

**Trois photos de mur cadrées exprès.** Le lot de dix-sept a réglé la dispersion,
mais il ne contenait aucun cadrage volontaire — donc rien n'y démontre qu'un mur
photographié de face passe la porte. C'est le seul essai qui manque, et il tient
en trois clichés.

Les déposer dans le dépôt reste exclu — aucun binaire versionné. Les mesures,
elles, se consignent : c'est ce que fait le tableau ci-dessus.

## Ce qui la ferait tomber

1. **Une porte trop sévère.** Refuser huit photos sur dix rendrait le module
   inutilisable, et le refus est plus discret qu'une erreur : personne ne
   signale une application qui dit toujours non, on la désinstalle.
2. **Des objets génériques.** « Un coussin complémentaire » n'aide personne si
   la couleur proposée n'existe pas dans le commerce. La traduction en objets
   n'a de valeur que si elle vise des teintes qu'on trouve vraiment.
3. **Le glissement de périmètre.** Vêtements et carrosserie sont d'autres
   lumières et d'autres règles. La version un les exclut, et cette exclusion
   est ce qui la rend livrable.
