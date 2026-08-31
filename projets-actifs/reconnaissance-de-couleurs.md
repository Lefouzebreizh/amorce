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

## Outils nécessaires

- Flutter et le paquet caméra : **déjà dans le projet**.
- Rien d'autre. Ni clé, ni service, ni abonnement.

## Ce qui la ferait tomber

1. **La lumière.** Une ampoule chaude fait virer un blanc au jaune et un gris au
   beige. C'est le seul vrai problème du sujet. La parade est de **dire son
   incertitude** — « beige, ou blanc sous lumière chaude » — plutôt que
   d'affirmer. Une réponse fausse et assurée est pire que pas de réponse pour
   quelqu'un qui ne peut pas vérifier.
2. **La moyenne d'un objet bicolore.** Un réticule sur une rayure rend la
   moyenne des deux couleurs, qui n'existe nulle part. Détecter la dispersion
   et le dire.
3. **Nommer trop finement.** « Bleu pétrole » impressionne et n'aide personne.
   Une quarantaine de noms courants vaut mieux que deux cents nuances.

## Questions ouvertes

1. **Qui s'en sert, un daltonien ou quelqu'un qui assortit ?** Le premier veut
   un nom sûr et une comparaison ; le second veut une nuance précise et un code
   hexadécimal. Deux interfaces différentes, même noyau.
2. **Annonce vocale dès le départ ?** Pour un daltonien, lire l'écran va de soi ;
   pour un malvoyant, c'est la fonction entière.
