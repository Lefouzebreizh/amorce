---
name: eprouver-une-regle
description: "Confronter à de vraies données une règle qu'on vient d'écrire — un seuil, un score, un classement, un nommage, un filtre — avant de la croire, parce qu'une suite de tests écrite en même temps que le code teste ce à quoi son auteur a pensé et rien d'autre. À utiliser juste après avoir écrit une règle de décision et **avant** de bâtir quoi que ce soit dessus, dès qu'une demande dit « mes tests passent », « est-ce que c'est juste », « ça a l'air de marcher », « je peux enchaîner ? », « quel seuil mettre », « comment je sais que ça marche », et dès qu'on s'apprête à afficher un résultat calculé à quelqu'un. À utiliser surtout **quand tout est vert** : c'est exactement là que le défaut se cache, et cinq fois sur cinq dans ce dépôt il a fallu de vraies données ou un simple affichage pour le voir. Ici on éprouve une **règle** ; pour un fichier média c'est `voir-le-son`, pour une interface `epreuve-du-pouce`, et quand quelque chose **échoue déjà** c'est `debogage-systematique`."
---

# Éprouver une règle avant de la croire

Une suite de tests écrite en même temps que le code **teste ce à quoi son auteur
a pensé**. Elle encode les mêmes hypothèses que la règle qu'elle surveille : si
l'hypothèse est fausse, les deux se trompent ensemble et le vert ne veut rien
dire.

Ce n'est pas une théorie. Dans ce dépôt, quatre règles écrites avec soin ont
passé leurs tests et se sont révélées fausses dès qu'on leur a montré autre
chose que ce que leur auteur avait imaginé.

## Les cinq cas, avec leur mesure

| Règle | Tests | Ce qui l'a démentie | Le défaut |
| --- | --- | --- | --- |
| `audit-code-ia/scripts/scan.py` | verts | un vrai dépôt Lovable | **11 constats, 9 faux** — des jetons de thème `token: "--background"` pris pour des secrets |
| `NameColor` | 21 verts | 34 couleurs usuelles | bordeaux → « rose », anthracite → « bleu marine », bleu ciel → « cyan » |
| La porte d'`Accord` | 11 verts | 17 photos d'intérieur réelles | **15 acceptées sur 17**, rendant presque toutes le même brun `#8D704B` |
| Les harmonies d'`Accord` | 13 verts | l'affichage des palettes | « tapis vert sur mur vert », et une saturation à 0,62 là où la borne exigeait 0,45 |
| Le seuil de stress de `chat-traducteur` | 48 verts | 40 vrais chats (ESC-50) | **30 chats sur 40 rendus « stressés »**, et annoncé comme *mesuré* |

Les tests d'origine ne portaient que sur des cas **francs** — un rouge pur, un
secret évident, deux couleurs qui s'affrontent. Le monde réel n'envoie pas de
cas francs.

**Le cinquième cas ajoute une nuance que les quatre premiers n'avaient pas, et
c'est la plus désagréable : la règle était mesurée.** Le seuil venait d'un
corpus de quinze sons, où il séparait proprement — 0,000 à 0,031 d'un côté,
0,199 à 0,738 de l'autre. Un écart de six, écrit et daté.

Le corpus était **fabriqué**. On y avait commandé « un miaulement », « un
feulement », « un ronronnement » : trois intentions nettes, bien séparées,
parce que c'est ainsi qu'on les avait demandées. Un vrai miaulement est fort et
modulé, et la médiane du corpus réel est tombée **exactement** sur la valeur que
le corpus fabriqué rangeait du côté de la détresse.

D'où l'avertissement qui vaut au-delà de ce projet : **un corpus fabriqué ne
contient que les sons qu'on a su demander**, et une règle réglée dessus sépare
toujours parfaitement — sur lui. Le fichier portait d'ailleurs la réserve, écrite
noir sur blanc : « ces quinze sons sont générés, pas enregistrés ». Une réserve
écrite n'empêche rien. Seule la mesure qui manque empêche.

## La méthode, en trois gestes

### 1. Rassembler vingt à quarante cas réels

Pas trois. Trois cas se choisissent inconsciemment parmi ceux qui marchent.
Trente forcent la main : il y en aura forcément un que la règle n'a pas prévu.

Les sources qui ont servi ici : un vrai dépôt public, une liste de couleurs
usuelles écrite de mémoire en deux minutes, une pellicule de téléphone. **Aucune
n'a demandé plus de dix minutes à réunir**, et chacune a trouvé un défaut.

### 2. Lancer le vrai code, jamais une réimplémentation

Le piège est de réécrire la logique dans le langage où les données sont faciles
à lire — typiquement Python pour des images ou du JSON. Cette copie diverge, et
c'est elle qu'on éprouve alors, pas le code qui partira.

Le motif qui marche : **préparer les données dans le langage commode, exécuter
la règle dans le sien.**

```bash
# Réduire les données réelles en JSON avec l'outil qui sait les lire
python3 -c "…"   > /tmp/cas.json
# Puis lancer la vraie règle dessus
dart run outil_temporaire.dart      # ou node, ou python -m …
```

Le fichier d'exécution est temporaire et se supprime après — il ne rejoint pas
le dépôt, seules ses **conclusions** y entrent.

### 3. Afficher la sortie et la regarder

Le compte de réussites ne suffit pas. Trois des cinq défauts ci-dessus ne se
voyaient que dans la sortie elle-même :

- La porte d'Accord acceptait quinze photos sur dix-sept — un taux honorable,
  jusqu'à ce qu'on remarque qu'elles rendaient **toutes la même couleur**.
- Les harmonies proposaient « un tapis vert » pour un mur vert. Chiffre juste,
  conseil nul.
- Le traducteur de chat rendait « stress » trente fois sur quarante. Aucun
  chiffre n'était faux ; c'est la **répartition** qui l'était, et elle ne se
  voit qu'en comptant les verdicts par classe. Un taux plausible pris isolément
  devient absurde quand on le rapporte à ce qu'il prétend décrire.

Imprimer une ligne par cas, avec l'entrée et la sortie côte à côte, et la lire.

## Ce qu'on en fait ensuite

**Chercher la cause, pas le contre-exemple.** Le réflexe est d'ajouter une
condition pour le cas qui a raté. Les cinq défauts ci-dessus avaient chacun une
cause de fond, et la corriger réglait plusieurs cas d'un coup :

- la porte mesurait le **conflit** entre teintes, alors que ce qui sépare une
  surface d'une pièce est leur **dispersion** ;
- la saturation TSL s'emballe près du blanc, là où celle de TSV décrit ce que
  l'œil voit ;
- un seuil d'achromatisme fixe ne tient pas : plus une couleur est sombre, plus
  il lui faut de saturation pour mériter un nom de teinte.

**Figer chaque cas en test de non-régression, avec sa cause en commentaire.** Le
correctif se réinvente ; la raison, non.

**Écrire les mesures dans la fiche du projet**, même quand les données elles-mêmes
ne peuvent pas être versionnées — aucun binaire dans ce dépôt. Un tableau de
chiffres est une connaissance, pas une pièce jointe :

> Cadre tenu par une surface : concentration 0,82 – 1,00. Pièce entière :
> 0,12 – 0,59. Le seuil est posé dans le vide qui les sépare.

Un seuil dont on peut relire d'où il vient se déplace sans crainte. Un seuil nu
ne se touche plus jamais.

## Quand s'arrêter

L'épreuve ne cherche pas la perfection. Elle cherche **la classe de défauts que
personne n'avait imaginée**, et elle l'a trouvée dès qu'un cas surprend.

Ce qui reste faux après correction s'écrit et s'assume : un lavande très pâle
ressort « blanc », un olive ressort « marron » — à quarante noms c'est le grain
choisi, et forcer plus fin casserait les vrais blancs. Une limite écrite vaut
mieux qu'une limite découverte par un utilisateur.
