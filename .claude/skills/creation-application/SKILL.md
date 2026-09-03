---
name: creation-application
description: Poser l'architecture d'une application qui porte de la logique et des données — pas un site vitrine : où passe la frontière entre décider, toucher au disque et afficher, quand une base de données se justifie et laquelle, où vit l'état, comment importer et dédoublonner sans perdre ce que l'utilisateur a laissé, et comment ajouter une colonne des mois plus tard sans casser les installations qui tournent. À utiliser dès qu'une demande parle d'une application qui garde quelque chose entre deux ouvertures : « une appli qui gère », « il faut stocker », « on importe un catalogue », « un tableau de bord », « ça doit se souvenir de », « une base pour », « un import qui se relance ». Les décisions ci-dessous viennent de `life-organizer/` et du catalogue `iptv/`, et chacune a coûté quelque chose. Pour déclarer le projet dans le dépôt, enchaîner sur `/nouveau-projet` ; pour une branche qui traîne, `/branche-partagee`.
---

# Une application, pas une vitrine

Ce qui sépare les deux tient en une phrase : **une vitrine rend la même chose à
tout le monde, une application se souvient**. Dès qu'il y a de la mémoire, trois
questions arrivent ensemble et se répondent mal séparément — où vit la logique,
où vivent les données, et que devient l'existant quand le code change.

Deux projets de ce dépôt y ont déjà répondu, et différemment : `life-organizer/`
(Python, fichiers personnels, pas de base) et `iptv/` (TypeScript, catalogue de
120 000 entrées, SQLite). Leurs choix opposés sur la base ne sont pas une
incohérence — c'est la même méthode appliquée à deux contraintes.

## 1. Trois couches, et la frontière est le disque

`life-organizer/modules/<nom>/` porte exactement trois fichiers, et le découpage
n'est pas décoratif :

| Fichier | Ce qu'il a le droit de faire |
| --- | --- |
| `regles.py` | **Décider.** Aucune entrée-sortie, aucun import lourd. |
| `traitement.py` | **Agir.** Tout ce qui touche au disque est ici, et rien d'autre. |
| `commande.py` | **Brancher.** Arguments, affichage, code de sortie. Aucun calcul. |

Ce que cette frontière achète, et qui se mesure : le module de déduplication
*ne juge que des mesures déjà prises* — aucune image n'est ouverte dans
`regles.py`. Un seuil se vérifie donc **sur des nombres, en une seconde, sans
installer Pillow ni OpenCV**. Une règle mélangée au décodage aurait exigé un
environnement complet pour éprouver une comparaison de bits.

IPTV a la même frontière sous d'autres noms : `domaine/` décide, `cache/` écrit,
`app/` affiche. Peu importe le vocabulaire — ce qui compte est qu'**une fonction
qui décide ne sache pas d'où viennent ses entrées**.

**Le test qui dit si la frontière tient** : la couche de décision se teste-t-elle
sans disque, sans réseau et sans dépendance lourde ? Si non, elle n'est pas une
couche de décision.

## 2. Les types partagés vivent au centre, jamais dans un module

`life-organizer/noyau/modele.py` porte les types que les six modules
s'échangent, et son commentaire de tête dit pourquoi : *un module n'en appelle
jamais un autre*. Le classement reçoit le type détecté par le scan en argument,
il ne va pas le chercher.

Sans ce fichier commun, la seule façon de partager une notion serait un import
croisé — **et la chaîne devient indémêlable au troisième module**. Ces types sont
immuables et sans entrée-sortie : ils traversent les fonctions pures.

C'est la règle la plus rentable de la liste, et la plus facile à enfreindre au
deuxième module, quand il n'y a encore rien à démêler.

## 3. Une base de données se justifie, elle ne se suppose pas

`life-organizer/` n'en a pas : il range des fichiers, et le disque *est* la base.
`iptv/` en a une, et le commentaire de tête de `src/cache/schema.ts` porte le
raisonnement complet :

- **Pourquoi une base du tout.** Une liste de fournisseur pèse de 50 à 400 Mo.
  La relire à chaque ouverture coûterait **vingt à quarante secondes avant le
  premier écran**, à chaque fois. Elle est analysée une fois, écrite, et
  l'interface ne parle plus qu'à la base.
- **Pourquoi SQLite, et pas Redis ni un fichier JSON.** `node:sqlite` est livré
  avec Node : pas de module natif à compiler, pas de service à faire tourner, et
  la recherche plein texte incluse. Un JSON obligerait à **tout charger en
  mémoire** — précisément ce que l'analyseur en flux évite en amont, et il serait
  absurde de le défaire à l'étage du dessus.

**La question à se poser avant d'ajouter une base : qu'est-ce qui casse sans
elle ?** Si la réponse est « rien, mais ça ferait plus sérieux », il n'en faut
pas. Si la réponse est un nombre — des secondes d'attente, des mégaoctets en
mémoire — elle est justifiée, et ce nombre s'écrit dans le fichier de schéma.

**Et ce qui n'entre jamais en base s'écrit aussi.** Chez IPTV : aucun mot de
passe. L'adresse d'une source y est enregistrée masquée, si bien que la base peut
être copiée, sauvegardée ou envoyée en pièce jointe sans livrer l'abonnement de
personne. Un réimport reçoit l'adresse réelle en argument.

## 4. L'état : une configuration qui se relit, un journal qui décide

Deux mécanismes de `life-organizer/noyau/` méritent d'être repris tels quels.

**La configuration dit tout ce qui ne va pas, d'un coup** (`config.py`). Un
fichier se remplit à la main, souvent tard, sur plusieurs sections : s'arrêter à
la première erreur oblige à relancer huit fois. Et **rien n'est corrigé en
silence** — une clé absente prend sa valeur par défaut *et c'est dit*, une valeur
aberrante est refusée. Un outil qui range deux mille fichiers ne doit jamais
avoir « à peu près » compris.

**Le mode simulation n'est pas un `if` dans chaque module, c'est le journal**
(`journal.py`). Un module déclare ce qu'il fait, le journal l'écrit, et ne laisse
agir que si l'on a demandé d'appliquer : `prevoir()` rend un booléen et le geste
vit dans le `if`. Un module ne peut donc pas agir sans être passé par le journal.

Éparpiller la condition dans six modules garantirait qu'un jour l'un d'eux
l'oublie — et déplace deux mille fichiers pendant qu'on croyait regarder.

## 5. Prévoir les évolutions : le piège de la table qui existe déjà

C'est le défaut le plus discret de tout ce document, et il est écrit en toutes
lettres dans `iptv/src/cache/schema.ts` :

> `CREATE TABLE IF NOT EXISTS` ne touche pas une table présente. Une colonne
> ajoutée au schéma n'apparaît donc **jamais** chez qui a déjà importé quelque
> chose.

Ce qui le rend coûteux : **il n'existe que sur une base qui a vécu, donc jamais
dans les tests**, qui partent tous d'une base neuve. Tant que l'application ne
tourne que sur la machine qui l'écrit, c'est une hypothèse ; dès qu'elle tourne
ailleurs, c'est le cas courant.

La parade tient en trois points :

1. Une liste de migrations **rejouée à chaque ouverture**.
2. Chaque entrée doit être **sans effet la seconde fois** — `PRAGMA table_info`
   dit ce qui manque, plutôt que d'attendre l'erreur d'un `ALTER` en double.
3. Un index qui cite une colonne migrée **se crée après les migrations**, jamais
   dans le schéma : celui-ci s'exécute d'abord, sur une table que
   `CREATE TABLE IF NOT EXISTS` n'a pas touchée, et l'ouverture tombe sur
   « no such column ».

## 6. Importer : un flux, une identité, un horodatage

L'import Xtream d'IPTV tient en quatre décisions, et chacune se transpose.

**Rien n'est jamais tenu en mémoire.** `cache/importer.ts` est une chaîne de
générateurs : on lit, on normalise, on écrit, entrée par entrée. Aucun tableau
intermédiaire — sans quoi tout le travail de l'analyseur en flux serait défait à
l'étage du dessus.

**Une entrée a une identité stable, et l'écriture est un `upsert`.**
`ON CONFLICT (id) DO UPDATE SET …` : un réimport met à jour, il ne duplique pas.
L'identifiant est une empreinte de l'URL du flux.

**Ce qui a disparu se déduit d'un horodatage, pas d'une comparaison.** Chaque
ligne reçoit un `vu_le` au passage ; après l'import, les lignes de cette source
plus anciennes que l'horodatage ont disparu du catalogue. C'est une requête, pas
un diff de 120 000 entrées.

**La purge se désactive quand l'import est partiel.** Les épisodes chargés à la
demande — un appel par série — arrivent par un import qui ne purge rien :
purger sur un import partiel effacerait les quarante mille autres entrées parce
qu'on a ouvert une fiche.

**Et ce que l'utilisateur a laissé survit au retrait, mais devient muet.** Un
favori et une reprise de lecture ciblent un identifiant, qui est une empreinte
d'URL : il ne dit ni le titre ni rien d'autre. Sans une table qui consigne les
retraits *référencés*, tout ce qu'on sait afficher est « vous étiez à 22 % d'un
film que le fournisseur ne sert plus », sans pouvoir dire lequel — arrivé le
01/09/2026, sur deux films. Seuls les retraits référencés sont consignés : les
cent quatre-vingts épisodes purgés à chaque passage noieraient les seuls dont
quelqu'un se souvienne.

## 7. Dédoublonner : masquer, pas supprimer ; rejouer, pas accumuler

Le dédoublonnage d'IPTV (`depot.ts`, `dedoublonner`) porte cinq décisions.

**On masque, on ne supprime pas.** Un fournisseur range la même chaîne dans
plusieurs catégories de qualité — TF1 quatre ou cinq fois de suite, sous le même
numéro. Le masquage garde la réversibilité : un bouton « inclure » les fait
revenir.

**Le geste est idempotent, et c'est ce qui le rend rejouable.** Un masquage
précédent est **levé avant d'être rejoué** sur l'état actuel. Un réimport a pu
changer les qualités disponibles pour un titre : accumuler donnerait un catalogue
qui rétrécit à chaque passage sans que personne ne le demande.

**Un groupe d'un seul membre n'a personne à qui perdre.** C'est exactement ce qui
protège un titre qui n'existe qu'en qualité inférieure — sans cette ligne, le
seul exemplaire d'un film rare disparaît parce qu'il est en SD.

**Le champ qui dit « déjà éprouvé » se remet à zéro avec le masquage.** Sinon un
doublon jamais testé reste candidat au test de flux, et un test qui le trouve
vivant écrit `etat = 'ok'` par-dessus — défaisant le masquage sans que personne
l'ait demandé. **Deux états qui partagent une colonne se lèvent ensemble.**

**Masquer ou retirer se décide sur ce qui référence.** Une fiche de série est
*retirée* et non masquée : rien ne la référence jamais — favoris et reprises
ciblent un épisode — et un réimport la redéclare. Un élément référencé, lui, se
masque.

Tout cela vit dans une transaction : `BEGIN`, `COMMIT`, `ROLLBACK` sur exception.
Un dédoublonnage interrompu à la moitié laisserait un catalogue dans un état que
personne n'a décidé.

## 8. « Identique » et « doublon » ne sont pas le même mot

`life-organizer/modules/nettoyage/regles.py` porte la distinction, et elle vaut
pour tout import de données réelles :

- **Deux fichiers identiques ne sont pas forcément des doublons, et
  réciproquement.** Une photo recadrée, recompressée ou passée par une messagerie
  n'a plus **un seul octet** en commun avec l'originale : un SHA les croit
  étrangères. À l'inverse, deux photos d'une rafale sont *presque* identiques et
  ne sont pas des doublons — personne ne veut qu'on lui retire la seule où tout
  le monde a les yeux ouverts.
- **La ressemblance se règle, parce qu'elle ne se devine pas.** Le seuil est un
  réglage de premier plan, doublé d'une échelle nommée pour qui ne veut pas
  raisonner en bits. Il n'a pas de valeur universelle : il dépend d'un appareil,
  d'un sujet, d'une habitude de déclenchement.
- **L'ordre des filtres est une décision.** La netteté passe avant la
  ressemblance : une photo floue écartée n'a plus à être comparée, c'est un
  décodage de moins — et surtout cela évite qu'une photo nette soit écartée comme
  doublon de sa propre version ratée.

## 9. Plusieurs sessions sur le même dépôt

Ce dépôt reçoit plusieurs sessions en parallèle, et c'est le piège le plus
extérieur au code — donc le plus facile à ne pas voir venir.

**Les conflits n'arrivent presque jamais sur la logique.** Deux sessions
travaillent sur des projets sans code commun ; elles se croisent sur **les
fichiers qui connaissent tout le monde** — `CLAUDE.md`, `INDEX.md`, le hook de
démarrage, les tableaux de compétences, la fiche d'un projet.

**La solution retenue : garder les deux apports.** Une ligne enrichie par l'autre
session et un bloc ajouté par la vôtre ne s'excluent pas. Les fusionner prend dix
secondes ; en choisir un fait disparaître du travail sans que personne s'en
aperçoive.

**Quand le conflit porte vraiment sur la même logique, ce qui est fusionné
gagne.** Se couler dans la base commune coûte moins cher que réconcilier deux
architectures : deux branches ont déjà construit Life-Organizer chacune de leur
côté, et la seconde a été refaite.

**Un « rebase réussi » ne veut pas dire « texte cohérent ».** Quand deux
réécritures se croisent sur le même paragraphe, tous les hunks peuvent
s'appliquer et produire un texte abîmé — l'ancienne phrase revenue, la nouvelle à
côté, un fragment orphelin au milieu. Git ne signale rien. **Après tout rebase
sur un fichier partagé, relire le raccord**, pas seulement le code de sortie.

Le reste de la mécanique — de combien on a pris du retard, quels commits sont
déjà passés autrement — est dans `/branche-partagee`. Et la règle qui les évite
tous : **fusionner tôt et en lots courts**. Une seule nuit à retarder a produit
trois conflits sur le même fichier.

## Leçons apprises

1. **Une couche de décision qui a besoin du disque n'en est pas une.** Le test
   est mécanique : elle se vérifie sans disque, sans réseau, sans dépendance
   lourde, ou bien la frontière est ailleurs qu'où on croit.
2. **Les types partagés vivent au centre dès le deuxième module**, pas au
   troisième. Au troisième, il y a déjà des imports croisés à démêler.
3. **Une base de données se justifie par un nombre** — des secondes d'attente,
   des mégaoctets en mémoire — et ce nombre s'écrit dans le schéma. Sans nombre,
   pas de base.
4. **Le défaut de migration n'existe que sur une base qui a vécu**, donc jamais
   dans les tests. C'est le seul de cette liste qu'aucune suite verte ne peut
   attraper.
5. **Un import se rejoue toujours.** Identité stable, `upsert`, horodatage pour
   ce qui a disparu — et purge désactivée dès que l'import est partiel.
6. **Un dédoublonnage se lève avant de se rejouer**, sinon il accumule. Et il
   masque plutôt qu'il ne supprime, sauf si rien ne référence l'entrée.
7. **« Identique » n'est pas « doublon ».** Le seuil de ressemblance est un
   réglage utilisateur, jamais une constante — il dépend de l'appareil et de
   l'habitude de celui qui photographie.
8. **Ce que l'utilisateur a laissé doit survivre au retrait de la donnée**, et
   rester lisible : un identifiant seul ne dit rien, il faut consigner le titre
   au moment du retrait.
9. **Un conflit sur un fichier partagé se résout en gardant les deux apports.**
   Et après tout rebase, on relit le raccord — un rebase sans conflit peut rendre
   un texte abîmé.
