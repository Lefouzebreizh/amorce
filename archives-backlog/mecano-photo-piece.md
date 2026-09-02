# Mécano — identifier une pièce auto en photo

> **Hypothèses posées** : lecture tranchée le 31/08/2026 — il s'agit de
> **mécanique automobile**, pas de jouet de construction. La première version de
> cette fiche examinait les deux et affirmait qu'en mécanique « Look & Find le
> fait déjà ». **C'était faux**, et la correction est en bas : elle change les
> raisons de la note, pas la note.

## Pitch

Photographier une pièce détachée de voiture et savoir laquelle c'est —
puis où la racheter.

## Objectif mesurable

**Sur quinze pièces déposées, photographiées telles qu'elles sortent du
véhicule — grasses, sombres, courbes —, lire la référence exacte pour au moins
onze**, et afficher « référence illisible, essuie et rapproche » pour les
autres. Jamais une référence approchante : elle fait commander la mauvaise
pièce.

## Score de faisabilité — 5/10 pour l'idée entière

| Critère | Note | Justification |
| --- | --- | --- |
| Temps / Effort | 7/10 | Le parcours de scan existe et se réemploie. |
| Complexité technique | 5/10 | Lire une référence **estampée dans du métal gras et sombre** est le pire cas de lecture optique — pire qu'une étiquette imprimée d'électroménager. |
| Coût / Rentabilité | 4/10 | **Aucune base de compatibilité ouverte n'existe.** TecDoc, la référence du secteur, est sous licence commerciale. C'est le mur le plus dur des trois idées de la journée. |
| Alignement | 6/10 | Même appareil photo, mais **la fiche produit existante ne sert à rien ici** — mesuré, voir plus bas. |

**Verdict :** aucun critère sous 4, donc pas de plafonnement, mais le coût
commande. L'idée entière — « identifie n'importe quelle pièce et dis-moi si elle
va sur ma voiture » — ne se construit pas aujourd'hui.

## Ce que j'avais affirmé, et ce que la mesure dit

**Affirmé :** « en mécanique, c'est déjà ce que fait Look & Find, ce n'est pas
une idée neuve mais un réglage de l'existante. »

**Mesuré, dans `look_and_find/lib/features/product_detail/domain/entities/` :**

- les catégories du scan sont `mobilier`, `high-tech`, `électroménager`,
  `décoration`, `autre`. **Il n'y a pas d'automobile** : une pièce de voiture
  retombe sur `autre` ;
- la fiche produit porte `dimensions` en centimètres, un `model3dUrl`, un
  `averagePrice`, des `merchants` et des `alternatives`. Les cotes et la vue 3D
  existent pour répondre à « est-ce que ce fauteuil passe dans mon salon ».
  **Sur une plaquette de frein, aucun de ces champs ne veut dire quoi que ce
  soit** — et les deux qui compteraient, la référence constructeur et la liste
  des véhicules compatibles, n'existent pas.

Ce n'est donc pas un réglage : c'est un domaine à part, avec sa propre entité.
La leçon est celle de `/eprouver-une-regle` : une phrase plausible sur du code
qu'on n'a pas ouvert se relit ensuite comme si elle avait été vérifiée.

## La décision qui décide de tout : la référence est estampée, pas déduite

Même déplacement que pour la notice d'appareil, et pour la même raison.

**Deux étriers de frein de marques différentes sont visuellement
indiscernables**, et c'est la référence exacte qui décide de l'achat. Un modèle
de vision qui hésite rendra une référence plausible — et une référence fausse
fait commander la mauvaise pièce, ce qui coûte plus qu'une absence de réponse :
la personne aurait cherché elle-même.

**La référence constructeur est estampée sur la pièce**, dans la fonte ou sur une
étiquette collée. Ce n'est plus de la reconnaissance visuelle, c'est de la
lecture de caractères. Vérifiable, en plus : on peut comparer au texte gravé.

Le prix à payer est une contrainte d'usage à assumer dans l'interface — *« essuie
la pièce, cherche les chiffres gravés »* — plutôt qu'un taux d'erreur silencieux.

## La version qui tient debout, et elle vaut 7/10

Le mur n'est pas la lecture, c'est la **compatibilité** : savoir si une pièce va
sur *ce* véhicule demande une base sous licence.

**Alors on ne répond pas à cette question-là.** Le cas d'usage réel est plus
étroit et plus fréquent : **la pièce est déjà démontée et dans la main.** On ne
cherche pas si elle est compatible — on sait qu'elle l'est, elle sortait du
véhicule. On cherche **où racheter exactement la même**.

| | Idée entière | Version réduite |
| --- | --- | --- |
| Question posée | « Cette pièce va-t-elle sur ma voiture ? » | « Où racheter cette pièce-ci ? » |
| Base de compatibilité | indispensable, sous licence | **inutile** |
| Preuve de compatibilité | à calculer | **la pièce déposée elle-même** |
| Note | 5/10 | **7/10** |

Temps 8, complexité 6, coût 7, alignement 7 — la moyenne tombe à 7. C'est le
même geste que pour les deux autres idées du jour : **rétrécir jusqu'à ce que la
dépendance impossible disparaisse.** Corpus fermé pour les tutos, plaque
signalétique pour la notice, pièce déjà démontée ici.

## Ce qu'il faut mesurer avant d'écrire une ligne

Une seule chose, et elle se fait en une soirée avec un téléphone : **photographier
dix pièces réellement déposées** — pas des pièces neuves sous blister — et
compter combien de références se lisent. Si c'est trois sur dix, la version
réduite tombe aussi et il faut le savoir avant, pas après.

C'est le même protocole que les dix photos d'intérieur qui ont fondé la porte
d'Accord : ce sont les clichés inexploitables qui décident de la conception.

## Statut

En sommeil, avec une sortie nommée. Reprise dès que les dix photos existent.
