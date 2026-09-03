# Reconnaissance de couleurs

> **Hypothèses posées** : fonctionnalité de Look & Find, pas d'application
> séparée. Public premier supposé **daltonien**, à confirmer — la question est
> ouverte en bas, et elle change l'interface sans changer le score.

## Pitch

Viser un objet avec l'appareil photo, obtenir le nom de sa couleur. Aucun
modèle, aucun réseau, aucune clé : un pixel, une table de correspondance, un
nom. La seule fonction de Look & Find qui marche en mode avion.

## Objectif mesurable

**Nommer correctement la couleur de 20 objets courants sur 20**, tenus à bout de
bras sous un éclairage d'intérieur, et annoncer « incertain » plutôt que de se
tromper quand la lumière ne permet pas de trancher.

## Score de faisabilité — 9/10

| Critère | Note | Justification |
| --- | --- | --- |
| Temps / Effort | 9/10 | Le flux caméra existe déjà. Lire un pixel, le convertir en teinte-saturation-luminosité, le comparer à une table de noms : une journée. |
| Complexité technique | 9/10 | Aucune intelligence artificielle. Pure logique Dart, testable hors appareil — donc réellement couverte par les tests, ce que le scan Gemini n'est pas. |
| Coût / Rentabilité | 10/10 | Zéro. Pas d'appel réseau, pas de quota, pas de latence. |
| Alignement | 8/10 | Même application, même caméra, même architecture. C'est la partie « Find » sans la partie « Look ». |

**Verdict :** la note la plus haute de l'atelier, et le motif est contre-intuitif
— **c'est la seule fonction de l'application qui ne dépend d'aucune IA**. Tout
le reste de Look & Find s'arrête si la clé Gemini expire, si le réseau tombe ou
si le quota est atteint. Celle-ci, non.

## Ce que cette fiche est devenue

`NameColor` a été livré, puis **repris tel quel par Accord** — le module qui
répond « qu'est-ce qui va avec cette couleur ». Nommer une couleur n'est donc
plus un produit à part : c'est une **brique partagée**, et c'est très bien ainsi.

Les étapes 2 et 3 ci-dessous — viseur, réticule, annonce vocale — appartiennent
désormais à l'écran d'Accord, où elles seront écrites une fois pour les deux.
Voir `projets-actifs/accord.md`.

Ce qui reste propre à cette fiche est le **noyau** : la table de noms, sa règle,
et les quatre corrections que trente-quatre vraies couleurs ont imposées. C'est
ce qui se relit quand un nom paraît faux.

## Plan d'action (MVP)

| Étape | Livrable | Délai |
| --- | --- | --- |
| ~~1 — Le noyau testable~~ | **Fait le 31/08/2026.** `NameColor.of()` et `ColorReading`, sous `features/color_reader/domain/`. 21 tests, `flutter analyze` propre. | ✅ |
| **2 — Le viseur** | Réticule au centre du flux caméra, moyenne des pixels sur un petit carré (un pixel unique attrape un reflet), nom affiché en gros. | 3 à 5 jours |
| **3 — L'usage réel** | Annonce vocale, historique des dernières couleurs, et le mode « comparer deux objets » — la vraie question d'un daltonien n'est pas « quelle couleur » mais « est-ce que ces deux-là vont ensemble ». | après retour d'usage |

L'étape 1 est volontairement sans interface : la table de noms est le cœur du
sujet, elle se travaille au test unitaire, et une interface posée trop tôt
masque le fait qu'on nomme mal.

## Ce que l'étape 1 a appris

Deux causes ont fait échouer huit tests sur vingt et un au premier essai, et
aucune ne se serait vue sans les écrire.

**La saturation TSL ment près du blanc.** Sur un blanc cassé elle rend 0,60,
parce qu'elle divise par une marge qui s'écrase aux extrêmes — alors que la
couleur est manifestement délavée. La saturation TSV (`delta / max`) rend 0,12,
qui décrit ce que l'œil voit. La luminosité, elle, reste celle de TSL : c'est
la moyenne du plus clair et du plus sombre, et c'est bien ainsi qu'on juge
« clair » ou « foncé ». Le mélange des deux modèles est délibéré.

**L'ordre des règles d'hésitation compte.** Un blanc cassé déclenche à la fois
« peu saturé, peut-être un gris » et « teinte chaude, peut-être un blanc sous
lampe ». La seconde passe en premier, parce qu'elle **dit quoi faire** — se
rapprocher d'une fenêtre — là où la première ne fait que douter.

### Ce que trente-quatre vraies couleurs ont montré

Les vingt et un tests d'origine portaient sur des couleurs **franches** — rouge
pur, bleu pur, gris moyen. Tous verts, et pourtant quatre défauts vivaient
dedans. Ils ne sont apparus qu'en passant un corpus de couleurs usuelles :
tomate, saumon, kaki, anthracite, lavande, prune.

| Couleur | Rendu avant | Cause |
| --- | --- | --- |
| bordeaux | « rose, ou bordeaux » | La bande rose (330–348°) porte aussi les rouges profonds, sans règle de clarté. |
| anthracite | « bleu marine » | Dix points d'écart entre canaux portent la saturation à 0,20 dans les tons sombres. |
| bleu ciel | « cyan » | La bande cyan mordait jusqu'à 205° et « bleu clair » n'existait pas. |
| beige | « beige, ou blanc » | La bande chaude s'arrêtait à 60° **exclu**, et un beige tombe pile dessus. |

La leçon vaut au-delà des couleurs : **une suite de tests écrite en même temps
que le code teste ce à quoi son auteur a pensé.** Ce sont les données réelles
qui montrent le reste, et il suffit d'un corpus de trente lignes pour les
obtenir. Les quatre cas sont désormais figés en tests de non-régression.

Ce qui reste imparfait et qu'on assume : un lavande très pâle ressort « blanc »,
et un olive ressort « marron ». À quarante noms, c'est le grain qu'on a choisi ;
forcer plus fin casserait les vrais blancs.

## Ce que le cadre bicolore a coûté — 3 septembre 2026

Le défaut listé sous « ce qui la ferait tomber » est traité. Trois mesures ont
été nécessaires, et **les deux premières ont été écartées par les chiffres**,
pas par un raisonnement.

| candidate | ce qu'elle comptait | verdict |
| --- | --- | --- |
| part du nom majoritaire | le nom le plus fréquent | surfaces unies **0,594–0,996** contre cadres mêlés **0,293–0,497** : les plages se touchent |
| part portant le nom de la moyenne | le nom réellement annoncé | pire — un plaid uni tombe à **0,196**, sous tous les cadres mêlés |
| la même, clarté neutralisée | retenue, mais pas pour sa séparation | une nef d'église atteint **0,928**, au-dessus de deux surfaces unies |

**Les deux premières échouent pour une seule cause**, et elle vaut d'être sue :
`NameColor` change de nom avec la clarté — « gris » et « gris clair », « orange »
et « marron ». Une ombre sur un mur uni compte donc comme une seconde couleur.
La troisième ramène chaque pixel à la clarté du cadre avant de le nommer, et
c'est **pour ça** qu'elle est gardée, pas parce qu'elle sépare mieux.

### La question était mal posée, et c'est la mesure qui l'a dit

Aucune des trois ne sépare les surfaces unies des scènes. En le constatant, on a
vu pourquoi : **annoncer « deux couleurs » sur une scène encombrée n'est pas un
faux positif, c'est la bonne réponse** — la moyenne n'y nomme rien. La seule
chose interdite est de le dire d'une surface unie.

L'exigence n'a donc qu'un côté, et un seul seuil y suffit : la part du **second**
nom. Le seuil de majorité, celui qui n'avait aucun vide où se poser, a été
retiré au lieu d'être ajusté.

### Un piège attrapé par un test, pas par la mesure

La neutralisation de la clarté **détruit le blanc** : ramené à la clarté moyenne
d'un cadre rouge et blanc, le blanc ressort « gris clair ». La première version
annonçait donc « rouge, ou gris clair » devant un pull rouge et blanc.

Le blanc est une clarté ; la neutraliser efface ce qui le définit. La correction
sépare les deux rôles — les pixels normalisés **décident** s'il y a deux
couleurs, les pixels d'origine les **nomment**. C'est un test qui l'a attrapé,
sur un cas fabriqué que la mesure sur photos réelles ne contenait pas.

### Ce que ce seuil vaut, dit franchement

**La marge est mince et le corpus est court** : trois surfaces unies plafonnent à
0,122 de second nom, le premier cadre réellement mêlé est à 0,151. Trois
centièmes, sur trois exemplaires d'un côté. Le seuil est à 0,14 et il se
remesure dès qu'il existe des photos prises **dans l'application, viseur à
l'écran** — les photos de ce corpus ont été prises sans le voir, et deux refus
sur trois y venaient du cadrage.

Sur les neuf cadres réels : **aucune surface unie dédoublée**, quatre cadres
mêlés sur six signalés. Les deux non signalés sont des scènes que la lumière
chaude rend réellement monochromes — leur nommer une couleur n'est pas absurde.

## Ce que quatre-vingt-six cadres réels ont montré du nommage

Passés dans `LectureCadre` le 03/09/2026 — le vrai code, sur les photos du
propriétaire. **Soixante-quatorze sur quatre-vingt-six annoncent deux
couleurs.** Ce taux ne dit rien du produit : ces photos ont été prises **sans
viseur à l'écran**, ce sont donc massivement des scènes, et « deux couleurs »
y est la bonne réponse. Il ne s'interprétera qu'avec des photos prises dans
l'application.

Ce qui s'interprète, ce sont les **douze cadres où l'application s'engage sur un
nom unique** : c'est là qu'un nom faux ne peut pas être rattrapé.

### Six sur douze sont faux, et pour une seule raison

Quatre « orange » et deux « marron » désignent en réalité de la **pierre, du
beige et du bois sous lumière chaude** — une nef d'église, deux bureaux aux murs
crème, un porche. Aucun n'est orange ni marron ; ce sont des surfaces neutres
que l'ampoule a réchauffées.

C'est exactement le défaut n° 1 de « ce qui la ferait tomber », et la parade
existe déjà dans `NameColor` : la règle de la lumière chaude, qui répond
« beige, ou blanc sous lumière chaude » au lieu d'affirmer. **Elle ne se
déclenche pas**, et la mesure dit pourquoi.

| cadre | teinte | saturation TSV | clarté TSL | rendu |
| --- | --- | --- | --- | --- |
| nef, orgue | 29,1° | 0,29 | **0,38** | marron |
| bureau crème | 31,2° | 0,17 | **0,54** | orange |
| bureau blanc | 36,5° | 0,14 | **0,61** | orange, ou gris |
| porche | 25,7° | 0,34 | **0,34** | marron |
| nef, assemblée | 30,7° | 0,32 | **0,45** | orange |
| nef, mariés | 24,0° | 0,23 | **0,44** | orange |

La règle demande trois choses : teinte entre 20 et 65°, saturation sous 0,35,
**et clarté au-dessus de 0,62**. Les six remplissent les deux premières et
échouent toutes sur la troisième. L'une d'elles la manque d'**un centième**.

### Pourquoi ce n'est pas un seuil à descendre

La tentation est d'abaisser 0,62. Elle est mauvaise : à 0,30, un vrai marron —
du bois, du cuir, un meuble — s'entendrait répondre « marron, ou blanc sous
lumière chaude », ce qui est faux et bavard. Un beige sombre sous ampoule et un
brun franc **rendent la même moyenne** ; aucune règle sur trois nombres ne les
sépare.

Ce qui les sépare est ailleurs, et la fiche le dit déjà à sa façon : c'est **le
seul vrai problème du sujet**. Deux pistes, ni l'une ni l'autre mesurée :

- ~~**la répartition dans le cadre** plutôt que la moyenne~~ — **mesurée et
  écartée le 03/09/2026, voir juste en dessous** ;
- **un point de référence blanc** dans la scène, que la personne désignerait une
  fois — ce qui change l'interface, donc le produit.

### La première piste est morte, et sa mort est instructive

L'idée : une ampoule tungstène tire **tout** le cadre vers le chaud, alors qu'un
meuble brun a des voisins neutres — un mur, un sol, un plafond. On mesurerait
donc la **part du cadre qui n'est pas chaude**, et une part quasi nulle
trahirait la lumière plutôt que la matière.

Elle sépare très bien ce qu'on ne lui demandait pas : les six cadres mal nommés
tombent entre **0,012 et 0,263**, les scènes de plein jour entre **0,761 et
1,000**. De quoi croire que ça marche.

**La grange l'a tuée.** Des murs de terre ocre, photographiés de jour, porte
ouverte : part hors-chaud **0,032** — au milieu des six, alors que son ocre est
réel et que « orange » y serait juste.

La raison se voit après coup et vaut au-delà de ce projet : la mesure répond
« tout le cadre est-il chaud ». Or c'est **exactement ce que produit aussi une
grande surface réellement chaude**. Elle ne distingue pas « tout est chaud parce
que la lumière l'est » de « tout est chaud parce que la chose l'est ».

Et le coup de grâce est dans le produit lui-même : cette mesure a besoin du
**contexte autour** de la surface, et l'application demande précisément de
**cadrer serré sur la surface**. Le viseur détruit ce dont la piste avait besoin.
Une idée peut être juste en physique et incompatible avec le geste qu'on demande
à l'utilisateur.

### Ce qui reste

La seconde piste — **un point de référence blanc**, désigné une fois par la
personne — n'est pas mesurée et **change l'interface**. C'est donc une décision
de produit, et c'est la seule qui reste sur la table.

**Rien n'a été touché dans `NameColor`.** C'est une brique partagée, la
consigne est de ne pas y toucher, et ce constat appelle une décision de produit
avant une ligne de code.

## Outils nécessaires

- Flutter et le paquet caméra : **déjà dans le projet**.
- Rien d'autre. Ni clé, ni service, ni abonnement.

## Ce qui la ferait tomber

1. **La lumière.** Une ampoule chaude fait virer un blanc au jaune et un gris au
   beige. C'est le seul vrai problème du sujet. La parade est de **dire son
   incertitude** — « beige, ou blanc sous lumière chaude » — plutôt que
   d'affirmer. Une réponse fausse et assurée est pire que pas de réponse pour
   quelqu'un qui ne peut pas vérifier.
2. ~~**La moyenne d'un objet bicolore.**~~ **Traité le 03/09/2026** —
   `LectureCadre.lire()`, à côté de `NameColor` qui n'a pas été touché. Un pull
   rouge et blanc rend désormais « rouge, ou blanc — deux couleurs dans le
   viseur », et jamais le rose de la moyenne, qui n'existe nulle part. Le
   vocabulaire est celui que `ColorReading` portait déjà : rien n'a été ajouté
   à l'entité non plus. Ce que trois mesures ont coûté est écrit plus bas.
3. **Nommer trop finement.** « Bleu pétrole » impressionne et n'aide personne.
   Une quarantaine de noms courants vaut mieux que deux cents nuances.

## Questions ouvertes

1. **Qui s'en sert, un daltonien ou quelqu'un qui assortit ?** Le premier veut
   un nom sûr et une comparaison ; le second veut une nuance précise et un code
   hexadécimal. Deux interfaces différentes, même noyau.
2. **Annonce vocale dès le départ ?** Pour un daltonien, lire l'écran va de soi ;
   pour un malvoyant, c'est la fonction entière.
