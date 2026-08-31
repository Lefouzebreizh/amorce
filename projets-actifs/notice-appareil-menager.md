# La notice de l'appareil, retrouvée en photo

> **Hypothèses posées** : module de Look & Find. **Distinct de la fiche
> « Notice, dangerosité et ingrédients »**, qui traite des produits de
> consommation au code-barres. Ici il s'agit d'appareils — télé, aspirateur,
> four, machine à laver — dont personne ne retrouve jamais le mode d'emploi.

## Pitch

Photographier son aspirateur et recevoir sa notice. Le besoin est universel et
sans concurrent propre : les sites de manuels sont des fermes à publicité.

## Objectif mesurable

**Sur quinze appareils d'un logement ordinaire, identifier marque et modèle
exacts pour au moins douze**, et le dire quand on ne sait pas. La notice
elle-même vient après — l'identification est le verrou.

## Score de faisabilité — 7/10

| Critère | Note | Justification |
| --- | --- | --- |
| Temps / Effort | 8/10 | Le parcours de scan existe. Le travail neuf est une lecture d'étiquette et une recherche. |
| Complexité technique | 6/10 | Lire une plaque signalétique est facile. Retrouver le bon PDF ensuite ne l'est pas : pas de source structurée. |
| Coût / Rentabilité | 6/10 | **Aucune base ouverte de notices n'existe.** C'est le point qui plafonne la note, et il ne dépend pas de nous. |
| Alignement | 9/10 | Exactement Look & Find : un objet, une photo, une information utile. |

**Verdict :** aucun critère sous 5, donc chantier — mais le coût est réel et il
faut le regarder en face avant d'écrire une ligne.

## La décision qui décide de tout : l'étiquette, pas l'appareil

L'idée est arrivée comme « la photo de la télé ». Ne pas la prendre au mot.

**Une télé vue de face ne dit pas son modèle.** Deux téléviseurs de la même
marque à trois ans d'écart sont visuellement indiscernables, et c'est le modèle
exact qui décide de la notice. Un modèle de vision qui hésite rendra une
référence plausible et fausse — et une notice fausse fait démonter la mauvaise
pièce.

**La plaque signalétique, elle, porte le modèle en toutes lettres** : au dos de
la télé, sous l'aspirateur, dans l'encadrement de la porte du lave-linge.

Ce déplacement change la nature du problème : ce n'est plus de la reconnaissance
visuelle d'un modèle parmi dix mille, c'est de la **lecture de texte sur une
étiquette**. C'est faisable, et c'est vérifiable — on peut comparer au texte
imprimé.

Le prix à payer est une contrainte d'usage à assumer franchement dans
l'interface : *« retourne l'appareil, cherche l'étiquette blanche »*. Le
demander explicitement vaut mieux qu'un taux d'erreur silencieux.

## Le mur, nommé

Il n'existe **pas de source ouverte et gratuite de notices**. Les sites qui en
agrègent vivent de la publicité, n'offrent pas d'interface programmable, et
changent de forme sans prévenir.

C'est le même mur que la fiche « ingrédients » rencontre avec OpenFoodFacts, à
une différence près, et elle est défavorable : OpenFoodFacts existe.

Trois issues, dans l'ordre où je les essaierais :
1. **Les sites constructeurs.** Chaque fabricant héberge ses propres PDF sous
   une adresse régulière. Une poignée de marques couvre l'essentiel d'un
   logement. C'est fastidieux et ça tient.
2. **Rendre l'identification seule.** Marque, modèle, année, et le lien de
   recherche tout prêt. Moins magique, immédiatement utile, zéro dépendance.
3. Renoncer aux notices et garder l'identification comme brique pour d'autres
   usages — pièces détachées, consommables, dimensions.

**L'issue 2 est la version un.** Elle se livre sans attendre personne.

## Frontière avec la fiche existante

`projets-actifs/notice-et-dangerosite-produit.md` lit un **code-barres** et
interroge une base ouverte pour des produits de consommation. Ici : **pas de
code-barres** — un appareil n'en porte pas d'utile une fois déballé — une plaque
signalétique, et pas de base. Deux chemins de données différents, deux fiches.

## Prochain pas

La question de la source avant le code : relever les adresses de PDF chez cinq
constructeurs courants et voir si elles sont régulières. Une demi-heure, et elle
décide si c'est l'issue 1 ou l'issue 2.
