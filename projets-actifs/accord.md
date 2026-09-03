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
| ~~1 — La porte~~ | Écrite le 31/08/2026, rouverte le même jour — 47 photos réelles lui faisaient accepter 10 scènes à tort — et **refermée le 03/09/2026 par la zone de visée**, pas par une quatrième statistique : celles-ci ne peuvent pas séparer une photo de mur d'une photo de pièce contenant un mur. 12 tests. | ✅ |
| ~~2 — Les trois harmonies~~ | **Faite le 31/08/2026.** `BuildHarmonies.pour()`, 13 tests. Chaque harmonie rend un 30 % et un 10 % avec leurs objets. | ✅ |
| ~~3 — Les objets et les proportions~~ | **Faite le 31/08/2026**, avec l'étape 2. Chaque proposition porte sa part et ses objets ; la plante n'apparaît que là où la couleur calculée tombe dans les verts. | ✅ |
| ~~3 bis — La zone de visée~~ | **Faite le 03/09/2026.** `ZoneVisee`, carré centré à 0,60 du petit côté — part mesurée, pas choisie — et `EchantillonAccord` qui décode, découpe et réduit en 40 × 40. 14 tests. | ✅ |
| ~~4 — L'écran~~ | **Fait le 03/09/2026.** `CadreVisee` dessine le carré depuis `ZoneVisee.cadre()`, `PanneauAccord` rend le refus avec son geste ou la palette, `AccordPage` enchaîne caméra, déclencheur et résultat. 12 tests. | ✅ |
| 5 — De vrais retours sur des photos variées | Le seul point ouvert, et il ne se code pas. **On livre avec les seuils actuels et on ajuste sur les retours**, décision du propriétaire du 03/09/2026 — voir « Ce que ce corpus vaut ». **Premier retour reçu le 03/09 au soir : trente-deux photos, huit acceptées, et les huit sont fausses** — voir la section dédiée. | premier retour dépouillé, il en manque un : des photos cadrées sur une surface |

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

> **Ce vide n'existe pas.** Quarante-sept photos, mesurées le 31 août 2026, le
> comblent entièrement : voir « Ce que quarante-sept photos ont réfuté » plus
> bas. Le tableau ci-dessus décrit le lot de dix-sept, pas le monde — il est
> conservé parce qu'il explique d'où viennent les seuils, pas parce qu'il les
> justifie encore.

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

## Ce que quarante-sept photos ont réfuté — 31 août 2026

Quarante-sept photos réelles, prises sans intention pour Accord, passées dans
`JudgePhoto.juger()` tel qu'il est livré. **La porte en accepte dix. Les dix
sont fausses.**

| Ce qui a été accepté | Dominante rendue | Part | Concentration |
| --- | --- | --- | --- |
| Sculpture sur un escalier | `#846D5A` | 0,679 | 0,995 |
| Chat sur un canapé beige | `#967E6F` | 0,783 | 0,986 |
| Salle informatique, seaux au sol | `#8D8476` | 0,926 | 0,986 |
| La même, autre angle | `#938B7C` | 0,940 | 0,959 |
| Salon, une personne qui boit | `#5C3F2F` | 0,550 | 0,894 |
| Salon, une personne en casque VR | `#7B6C65` | 0,823 | 0,875 |
| Boutique de fleurs | `#9A958D` | 0,637 | 0,852 |
| Canapé en cuir, une personne assise | `#684C3A` | 0,577 | 0,771 |
| Chat sur un plaid, devant un mur | `#977664` | 0,602 | 0,755 |
| Fauteuil et arbre à chat | `#918A7C` | 0,581 | 0,743 |

Aucune n'est une surface. Deux sont des bureaux, deux contiennent une personne
au premier plan. Et les dix couleurs rendues sont **le même brun boueux** — la
famille de `#8D704B` que cette fiche déclarait corrigée. Elle ne l'était pas :
le lot de dix-sept ne contenait simplement pas les cas où la mesure échoue.

**Aucun seuil ne sépare plus les deux populations.** Les acceptations fausses
s'étalent de 0,743 à 0,995 en concentration ; les dix recadrages de vraies
surfaces, de 0,825 à 1,000. Les intervalles se recouvrent presque entièrement.
Monter le seuil coûterait des surfaces légitimes sans supprimer les pires faux
positifs, qui sont précisément les plus concentrés.

**La cause.** Les teintes dominantes de presque tout le corpus tombent entre
16° et 42° — la bande orange-brun. Sous lumière artificielle chaude, le mur, le
sol, le tissu, le bois et l'animal tombent **tous dans la même famille de
teinte**. La dispersion ne voit alors qu'une seule surface, quelle que soit la
pagaille dans le cadre. Les dix-sept photos qui ont réglé le seuil étaient
éclairées au jour ; c'est pour cela que la mesure semblait fonctionner.

**Ce que ça implique.** Les trois mesures de la porte sont des histogrammes :
elles ignorent *où* sont les pixels. Un mur uni et un salon beige ont le même
histogramme et n'ont pas la même carte. Tant qu'on ne mesure que la teinte, il
n'y a pas de seuil à trouver — l'hypothèse « la dispersion sépare une surface
d'une pièce » est réfutée par ces quarante-sept photos.

**La contiguïté a été essayée, et elle échoue aussi.** La plus grande zone d'un
seul tenant portant la teinte dominante a été mesurée sur tout le corpus. Les
surfaces cadrées vont de 0,50 à 1,00 ; les acceptations fausses, de 0,29 à
0,85. Les intervalles se recouvrent encore, et croiser les deux mesures ne les
sépare pas davantage : trois faux positifs survivent à toute paire de seuils
qui laisse passer les vraies surfaces.

**Et la raison est plus profonde qu'une mesure manquante.** Sur les photos
acceptées à tort, il y a *vraiment* une grande surface unie dans le cadre — un
mur de bureau, un canapé beige. Le calcul ne se trompe pas sur les pixels : il
rend bien la couleur de la plus grande surface présente. Ce qui lui manque
n'est pas dans l'image. **Une photo de mur et une photo de pièce contenant un
mur sont statistiquement la même chose ; ce qui les distingue est l'intention
de celui qui cadre.**

Donc : ne pas deviner l'intention, la demander. Le viseur doit porter une
**zone de visée** — un cadre au centre — et la porte ne juger que cette zone.
C'est exactement ce que font les recadrages serrés de cette fiche, à la main,
et ils se comportent bien : concentration de 0,825 à 1,000, et des couleurs
justes (`#4A5647` pour un mur vert sauge, `#A37E26` pour un fauteuil moutarde).
Cela déplace le travail de l'étape 1 vers l'étape 4, et supprime le besoin
d'une quatrième statistique.

**Ce que ce corpus vaut.** Il vient d'un seul foyer et d'un seul appareil : il
prouve l'échec, il ne mesure pas le taux de refus qu'aurait un autre logement.

**Et le propriétaire a tranché le 03/09/2026 : on livre avec les seuils
actuels.** L'objectif reste cinq palettes sur dix photos d'intérieur ; on
ajustera sur de vrais retours, pris sur des photos variées. Attendre un lot
représentatif avant de livrer coûterait plus que de livrer et corriger.

**Ce qui découle de cette décision, et qui vaut d'être écrit avant qu'une
session ne s'en aperçoive à ses dépens : ces seuils ne se retouchent pas sur
ce corpus-ci.** Il a servi à les régler ; les rejouer dessus dira toujours
qu'ils vont bien, et « améliorer » un chiffre pour qu'il passe mieux sur les
quarante-sept photos ne fait que resserrer le réglage autour d'un seul foyer.
Une mesure ne vaut que pour ce qu'elle mesure — celle-ci a calibré, elle ne
peut pas valider. Le corpus reste utile pour une chose et une seule :
**vérifier qu'un changement ne casse pas ce qui marchait**, jamais pour
justifier un seuil déplacé.

## Ce que la version un a livré — 3 septembre 2026

La chaîne tourne de bout en bout : on vise une surface, on déclenche, on obtient
sa palette — ou un refus qui dit quoi faire.

| Brique | Ce qu'elle porte |
| --- | --- |
| `ZoneVisee` | Le carré visé, à 0,60 du petit côté. Source unique de la géométrie. |
| `EchantillonAccord` | Décode, découpe le cadre, réduit en 40 × 40 par moyenne d'aire. |
| `JudgePhoto` | Les cinq refus, chacun avec son geste. Ne juge que la zone. |
| `BuildHarmonies` | Les trois harmonies, chacune avec son 30 % et son 10 %. |
| `AnalyserPhoto` | La chaîne complète, **dans un isolat**. |
| `CadreVisee`, `PanneauAccord`, `AccordPage` | Le viseur, le verdict, la palette. |

**Le cadre dessiné et la zone mesurée viennent du même calcul**, et c'est la
propriété qui tient tout l'édifice. S'ils se décollent, la personne aligne son
mur sur l'un pendant que l'application lit l'autre — et rien ne le signalerait :
ni la porte, ni l'échantillonnage, ni l'œil. Un test les compare sur trois
formats.

**La part de 0,60 est mesurée.** Rétrécir le cadre rend la porte permissive :
sur le corpus, 8 photos acceptées à 0,60, mais 15 à 0,40 et 17 à 0,25. En
dessous de 0,40 elle accepterait deux photos sur cinq prises au hasard, et ce
n'est plus une porte.

**Le passage de la photo à la porte a été mesuré contre un second chemin.** Le
code Dart complet a été confronté aux 47 photos réduites par PIL : **47 verdicts
sur 47 identiques**, sept couleurs différant d'au plus 5/255 — l'écart du filtre
de réduction. Un passage qui décode et redimensionne ne lève aucune erreur quand
il se trompe ; il rend une couleur fausse et plausible.

**Un défaut n'a été vu qu'en rendant l'écran en image** : le déclencheur
recouvrait le texte d'aide de soixante pixels. Sept tests verts ne le disaient
pas, parce qu'aucun ne regardait deux widgets ensemble.

## Ce qui manque, et qui ne se code pas

**Le cadrage volontaire ne manque plus.** Faute de pouvoir photographier sur
commande, dix recadrages serrés ont été découpés dans des photos réelles — même
appareil, même lumière, même bruit — et passés dans le vrai code. Ils répondent
à la question posée : une surface cadrée franchement obtient une concentration
de **0,825 à 1,000**, très au-dessus du seuil. La porte ne bloque pas le geste
normal.

Ce que le recadrage ne reproduit pas : la mesure d'exposition qu'un appareil
ferait en visant la surface. Un mur foncé recadré est refusé pour obscurité à
0,151 contre 0,18 ; visé pour de vrai, il serait sans doute passé. C'est le
seul point qui demande encore un vrai cliché.

Les déposer dans le dépôt reste exclu — aucun binaire versionné. Les mesures,
elles, se consignent : c'est ce que font les tableaux de cette fiche.

## Ce que trente-deux photos du propriétaire ont établi — 3 septembre 2026

Premier vrai retour, celui que l'étape 5 attendait : trente-deux photos prises
par le propriétaire sur son propre appareil, passées dans la **vraie** chaîne —
`EchantillonAccord` puis `JudgePhoto.juger()`, par `dart run`, rien de
réimplémenté.

**Huit acceptées, vingt-quatre refusées. Et les huit acceptées sont fausses.**

| ce qui a été rendu | sujet |
| --- | --- |
| `#5D4737` | un salon de nuit |
| `#7C5E4C` | un salon avec un télescope |
| `#816753` | une grange, sol béton |
| `#694734` | une rue vue depuis un porche |
| `#7A685D` | une cour d'immeuble |
| `#978871` | une nef d'église, l'orgue |
| `#735D50` | une nef, les mariés |
| `#9E8A70` | une nef, l'assemblée |

Huit sujets sans rapport, **huit fois le même brun** : les teintes tiennent dans
**14,8 degrés**, de 21,5° à 36,3°, saturation moyenne 0,34. Aucune n'est la
couleur d'un objet qu'on pourrait accorder à quoi que ce soit.

### Ce que ça réfute

C'est **exactement** le défaut que les seuils de dispersion étaient censés
éteindre — le « brun boueux autour de `#8D704B` » décrit dans le bloc de tête de
`judge_photo.dart`. Il n'a pas disparu, il est devenu **plus rare** : quinze
photos sur dix-sept avant, huit sur trente-deux ici. On avait pris une baisse de
fréquence pour une correction.

La cause, elle, est neuve et n'était pas dans le raisonnement d'origine. La
concentration mesure **l'accord des teintes**, et une lumière chaude en fabrique
à partir de n'importe quoi : une nef en pierre blonde, un salon sous une ampoule
au tungstène, une grange en terre — tous les pixels tombent dans la même bande
chaude, la concentration monte, une famille dépasse la moitié. **La mesure ne
distingue pas « une surface » de « une scène éclairée d'une seule lumière ».**

Ce n'est donc pas un seuil trop permissif qu'on remonterait : le remonter
refuserait aussi les vraies surfaces. C'est la grandeur mesurée qui est en
cause.

### Une piste essayée et écartée le jour même

L'idée : une scène étale sa luminance — une nef a des vitraux et des bancs
sombres — là où une surface la resserre. Mesuré, étalement interquartile dans le
cadre :

- les huit fausses acceptations : **0,100 à 0,473** ;
- la seule vraie surface du lot, un plaid kaki : **0,166**.

Elle tombe **au milieu** des fausses, et la grange fait mieux qu'elle à 0,100.
Aucune séparation. La piste n'est pas livrée — c'est la troisième candidate
écartée après la contiguïté et le retrait des tests de dispersion, et les trois
l'ont été pour la même raison : mesurées avant d'être crues.

### Ce que ce corpus ne permet pas

**Il ne permet pas de reposer les seuils**, et la garde écrite plus haut vaut
mot pour mot ici : une seule de ces trente-deux photos cadre une surface unique.
Les autres sont des scènes — un mariage, un chantier, une rue, un balcon. Elles
disent que **les acceptations sont fausses**, elles ne disent pas où placer une
borne.

Et le seul vrai cadrage du lot, le plaid, est **refusé pour « presque grise » —
à juste titre** : sa moyenne est `#9CA29C`, saturation 0,04. Le geste rendu est
le bon. Un refus correct sur la seule photo bien cadrée, et huit acceptations
fausses sur des photos qui ne le sont pas : la porte se trompe dans le sens que
le §1 de « Ce qui la ferait tomber » ne prévoyait pas.

### Trois photos de plus, le même soir, et la réponse qui manquait

La phrase qui terminait cette section disait qu'on ne savait toujours pas si la
porte laisse passer les surfaces qu'elle doit accepter. **On le sait
maintenant : elle les laisse passer.**

Trois photos de plus, dont deux enfin cadrées sur une surface. Les trois sont
refusées, et **les trois refus sont justes** :

| photo | verdict | ce que le carré contenait vraiment |
| --- | --- | --- |
| un salon | plusieurs surfaces | fauteuil, sol, cartons, bouteilles |
| **un mur vert d'eau** | plusieurs surfaces | **la moitié haute du téléviseur** |
| un fauteuil clair | surface délavée | le fauteuil, saturation 0,04 |

Le deuxième est le cas qui apprend quelque chose. La photo vise un mur peint et
le mur remplit l'image — mais le **centre** de l'image, lui, est le téléviseur.
Le carré de visée est tombé à cheval sur les deux, et le refus est exact : il y
avait bien deux surfaces dedans.

**Découpée sur le mur seul et repassée dans la même porte, la photo est
acceptée et rend `#7D8E83`** — un vert-de-gris sauge, regardé à côté du cadre :
c'est la couleur du mur. C'est le **premier vrai positif** de tout ce qui a été
soumis à Accord : une surface de décoration réelle, une couleur juste, et rien
du brun boueux.

### Ce que ça déplace

Le défaut mesuré plus haut reste entier : la porte accepte des scènes entières
et en rend un brun qui n'est la couleur de rien. Mais son symétrique est
maintenant établi — **elle accepte aussi les vraies surfaces, et rend leur vraie
couleur**. Le module n'est donc pas cassé, il est **imprécis dans un seul sens**,
celui des faux positifs sur les scènes.

Et le geste qui manquait n'est pas dans le code : c'est **le viseur**. Ces trois
photos ont été prises sans voir le carré, et deux des trois refus viennent de
là, pas de la surface. Dans l'application, `CadreVisee` dessine ce carré à
l'écran — la personne cadre ce qui sera jugé. **Le corpus de cette fiche mesure
donc un usage que le produit n'impose pas**, et c'est une limite à garder en
tête avant d'en tirer un seuil.

### Le prochain pas

Ce qui reste à obtenir n'a pas changé de nature, seulement de précision : des
photos prises **dans l'application, viseur à l'écran**, plutôt que des photos
recadrées après coup. C'est le seul dispositif qui mesure ce que le produit fait
réellement.

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
