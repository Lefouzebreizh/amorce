# La notice de l'appareil, retrouvée en photo

> **Hypothèses posées** : module de Look & Find. **Distinct de la fiche
> « Notice, dangerosité et ingrédients »**, qui traite des produits de
> consommation au code-barres. Ici il s'agit d'appareils — télé, aspirateur,
> four, machine à laver — dont personne ne retrouve jamais le mode d'emploi.

## Pitch

Photographier son aspirateur et recevoir sa notice. Le besoin est universel et
sans concurrent propre : les sites de manuels sont des fermes à publicité.

## Objectif mesurable

**Sur quinze appareils d'un logement ordinaire, ramener la bonne notice pour au
moins douze, en visant l'appareil de face**, avec au plus un choix à faire par
appareil. Et dire « je ne sais pas » pour les trois autres plutôt que servir la
notice d'un modèle voisin.

## Score de faisabilité — 7/10

| Critère | Note | Justification |
| --- | --- | --- |
| Temps / Effort | 8/10 | Le parcours de scan existe. Le travail neuf est une lecture d'étiquette et une recherche. |
| Complexité technique | 7/10 | Reconnaître une **famille** — marque, taille, génération — est à portée d'un modèle de vision, là où le modèle exact ne l'est pas. Un choix proposé à l'utilisateur ferme le reste. |
| Coût / Rentabilité | 6/10 | **Aucune base ouverte de notices n'existe.** C'est le point qui plafonne la note, et il ne dépend pas de nous. |
| Alignement | 9/10 | Exactement Look & Find : un objet, une photo, une information utile. |

**Verdict :** aucun critère sous 5, donc chantier — mais le coût est réel et il
faut le regarder en face avant d'écrire une ligne.

## La décision qui décide de tout : on vise l'appareil, et on ferme la famille

Une première version de cette fiche disait : *ne photographie pas l'appareil,
photographie sa plaque signalétique*. Le propriétaire l'a refusée, et il avait
raison — la conclusion était trop large pour la mesure qui la portait.

**Ce qui reste vrai :** une télé vue de face ne donne pas son modèle. Deux
téléviseurs de la même marque à trois ans d'écart sont visuellement
indiscernables.

**Ce qui était faux :** en conclure qu'il faut retourner l'appareil. Deux raisons.

### Un. La photo ne donne pas un modèle, elle donne une famille — et ça suffit

Une photo de face donne la **marque** (le logo), la **taille** (estimable au
cadre), le pied, le bord d'écran, le style de l'année. Ça ne désigne pas *un*
modèle : ça désigne **trois ou quatre**.

La dernière marche se franchit alors en un geste, pas avec une lampe torche
derrière un meuble : *« Samsung, environ 55 pouces, 2021-2023 — c'est
laquelle ? »*, trois vignettes, un appui. **L'appareil photo fait quatre-vingt-dix
pour cent, l'utilisateur fait le reste** — et il le fait de face, assis.

### Deux. Pour l'usage réel, le modèle exact ne sert souvent à rien

C'est le point qu'on manque en raisonnant sur l'identification plutôt que sur le
besoin. Refaire la recherche des chaînes, réinitialiser, réappairer la
télécommande, activer le HDMI-CEC : **c'est identique sur toute une gamme d'une
marque et d'une année.**

La notice utile est donc celle de la **famille**, et l'application signale les
rares points qui dépendent du modèle exact plutôt que d'exiger ce modèle
d'entrée. Exiger une précision dont la réponse n'a pas besoin est le meilleur
moyen de perdre l'utilisateur avant la réponse.

### Et la télé est le cas difficile, pas le cas normal

La généralisation venait de là. Un aspirateur, un micro-ondes, une machine à
laver portent **très souvent leur modèle en façade ou sur un autocollant
visible** — l'encadrement de porte d'un lave-linge se lit dès qu'on l'ouvre.

Donc : **on vise l'objet, point.** La plaque signalétique devient un **repli**,
proposé seulement quand la famille reste trop large — jamais la première
consigne.

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

**Deux mesures, dans cet ordre, avant d'écrire une ligne.**

1. **Les familles se reconnaissent-elles ?** Photographier de face les appareils
   d'un logement et voir si marque, taille et génération sortent juste. C'est ce
   qui décide si le produit tient — et c'est mesurable en une heure, sans code,
   sur les photos qu'on a déjà.
2. **Les notices se trouvent-elles ?** Relever les adresses de PDF chez cinq
   constructeurs courants et voir si elles sont régulières. Décide entre l'issue
   1 et l'issue 2.

La première passe avant la seconde : une source parfaite ne sert à rien si on ne
sait pas quel appareil on regarde.
