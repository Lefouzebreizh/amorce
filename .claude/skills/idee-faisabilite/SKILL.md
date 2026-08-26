---
name: idee-faisabilite
description: Capturer une idée en vrac, la noter sur 10 selon quatre critères (temps, complexité technique, coût/rentabilité, alignement avec les cinq chantiers du dépôt), puis écrire la fiche dans /inbox/, /projets-actifs/ ou /archives-backlog/ et mettre à jour INDEX.md. À utiliser dès que quelqu'un lance une idée, même à moitié formulée — « j'ai pensé à un truc », « et si on faisait une app qui… », « ça vaut le coup de… », « note ça quelque part », « est-ce que c'est faisable » — et aussi pour trier l'inbox, relancer une idée en pause ou décider entre deux projets. Ne pas attendre le mot « faisabilité » : une idée jetée en passant est exactement le cas d'usage.
---

# Trier une idée : de la phrase en vrac à la fiche exécutable

Ce dépôt accueille déjà **cinq chantiers**. Le risque n'est pas de manquer
d'idées, c'est d'en ouvrir une sixième sans regarder ce qu'elle coûte. Ce skill
existe pour que la même idée reçoive la même note à trois semaines d'intervalle
— sans cette grille, la note suit l'humeur du jour.

## Le parcours

1. **Reformuler** l'idée en 2 phrases maximum. Si la reformulation est
   impossible, l'idée n'est pas encore une idée : poser les questions et
   s'arrêter là.
2. **Poser 2 à 3 questions** qui lèvent les angles morts — jamais des questions
   de politesse. Voir « Les questions qui servent » plus bas.
3. **Noter** les quatre critères. Voir la grille.
4. **Router** la fiche vers le bon dossier selon le score.
5. **Écrire** la fiche et mettre à jour `INDEX.md`.

Les étapes 1 et 2 se font dans la conversation.

**Ne pas écrire de fiche sur des hypothèses inventées en silence** : elle a
l'air fiable et ne l'est pas. Mais attendre les réponses n'est pas toujours
juste non plus. Le test est la **robustesse du score** : noter l'idée sous la
lecture la plus pessimiste des questions ouvertes, puis sous la plus optimiste.

- L'écart franchit une frontière de routage (≤ 3 / 4–6 / ≥ 7) → l'idée part en
  `/inbox/` avec les questions, et rien d'autre. Écrire la suite serait tirer à
  pile ou face.
- L'écart reste dans la même case → écrire la fiche tout de suite, avec les
  hypothèses **nommées en tête** et les questions en bas. Une fiche annotée fait
  avancer ; une question sans fiche fait attendre.

Dans les deux cas les hypothèses s'écrivent, jamais elles ne se supposent.

## La grille de notation

Chaque critère se note **sur 10**. Le score final est la **moyenne arrondie**,
avec une correction expliquée plus bas.

### 1. Temps / Effort

Combien d'heures avant un premier livrable montrable — pas avant la version
finale, qui n'arrive jamais quand on l'estime.

| Note | Ce que ça veut dire |
| --- | --- |
| 9–10 | Moins d'une journée. |
| 7–8 | Un week-end. |
| 5–6 | Deux à quatre semaines à temps partiel. |
| 3–4 | Plusieurs mois. |
| 1–2 | Pas d'horizon crédible. |

### 2. Complexité technique / Outils

| Note | Ce que ça veut dire |
| --- | --- |
| 9–10 | Les outils du dépôt suffisent, rien à apprendre. |
| 7–8 | Une bibliothèque nouvelle, documentée, sans surprise. |
| 5–6 | Une techno à apprendre, ou une intégration tierce à apprivoiser. |
| 3–4 | Un domaine entier à apprendre (ML, 3D, temps réel). |
| 1–2 | Dépend d'une brique qui n'existe pas encore. |

### 3. Coût / Rentabilité

Compter le coût **récurrent**, pas seulement le ticket d'entrée : un serveur à
5 €/mois est plus cher qu'une licence à 100 € une fois.

| Note | Ce que ça veut dire |
| --- | --- |
| 9–10 | Gratuit, tout tourne en local ou dans le navigateur. |
| 7–8 | Quelques euros par mois, ou un achat unique modeste. |
| 5–6 | Coût récurrent réel sans revenu en face. |
| 3–4 | Investissement notable dont le retour reste hypothétique. |
| 1–2 | Coût qui grimpe avec l'usage — le succès coûte plus cher que l'échec. |

### 4. Alignement

L'idée se greffe-t-elle sur ce qui tourne déjà ?

| Chantier | Ce que c'est | Ampleur |
| --- | --- | --- |
| **Look & Find** (`look_and_find/`) | Application mobile. Flutter, Riverpod 3. | ~76 fichiers |
| **Amorce** (racine) | Montage vidéo vertical, 100 % navigateur. Next.js 15, React 19, Tailwind v4. | ~56 fichiers |
| **Chaîne KDP** (`kdp/`) | Pré-presse de couvertures Amazon KDP. Python. | ~26 fichiers |
| **Studio audio** (`mon-app-audio/`) | Outil audio. Python, Streamlit. | ~8 fichiers |
| **Patrimoine** (`patrimoine/`) | Allocation d'actifs. Python. | ~2 fichiers |

**Un dossier n'est pas un chantier.** Les deux derniers sont des amorces, pas
des bases de code sur lesquelles s'appuyer : s'aligner sur `patrimoine/` et ses
deux fichiers ne réutilise rien. Recompter avant de noter — la liste vieillit,
et un alignement adossé à une coquille vide est la façon la plus discrète de
gonfler un score :

```bash
find <dossier> -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.dart' \
  -o -name '*.py' \) -not -path '*/.dart_tool/*' -not -path '*/build/*' | wc -l
```

Sous ~15 fichiers, plafonner l'alignement à 6 : il n'y a pas encore de quoi
se greffer. Ne pas se fier aux dates de commit pour juger de l'activité — un
clone frais les écrase toutes le même jour.

| Note | Ce que ça veut dire |
| --- | --- |
| 9–10 | Fonctionnalité d'un chantier existant, réutilise son code. |
| 7–8 | Projet distinct mais même pile technique et même public. |
| 5–6 | Sixième front, sans rapport avec les cinq autres. |
| 1–4 | Sixième front **et** pile inconnue **et** public différent. |

### Quand la moyenne tombe entre deux

Arrondir **vers le bas**. Le demi-point qui ferait basculer vient toujours du
critère qu'on connaît le moins bien, et c'est toujours celui qu'on a noté avec
optimisme. Un 6,5 est un 6.

### La correction qui empêche de se mentir

**Si un critère tombe à 3 ou moins, le score final est plafonné à 5**, quelle
que soit la moyenne. Une moyenne noie un bloqueur : 10/10/10/2 donne 8, alors
que le 2 suffit à tuer le projet. Toujours dire lequel plafonne et pourquoi.

## Où va la fiche

| Score | Dossier | Ce qu'on écrit |
| --- | --- | --- |
| **≥ 7** | `/projets-actifs/` | Fiche complète, plan MVP en 3 étapes. |
| **4 à 6** | `/archives-backlog/` | Fiche complète + la condition précise qui la ferait remonter. |
| **≤ 3** | `/archives-backlog/` | Fiche courte : pourquoi c'est mort, **et** la version réduite qui, elle, passerait. |
| _pas encore notée_ | `/inbox/` | L'idée brute et les questions en attente. |

Un score bas ne justifie pas de jeter l'idée sans rien écrire : la trace de
*pourquoi* c'était non évite de la reproposer dans six mois.

Le nom de fichier est en minuscules, sans accent, mots liés par des tirets :
`convertisseur-rushes-vertical.md`.

## Écrire la fiche

Le gabarit est dans `assets/fiche.md`. Le copier et le remplir :

```bash
cp .claude/skills/idee-faisabilite/assets/fiche.md projets-actifs/mon-idee.md
```

Deux sections sont celles qu'on bâcle et qui font toute la valeur :

- **L'objectif mesurable** doit être vérifiable par quelqu'un d'autre.
  « Améliorer l'export » n'est pas un objectif ; « exporter un MP4 1080×1920
  de 30 s en moins de 10 s sur un Xiaomi » en est un.
- **L'étape 1 tient en moins de 48 h.** C'est la raison d'être du format : une
  première étape à deux semaines ne démarre jamais. Si le premier pas crédible
  demande plus de 48 h, c'est que le projet est mal découpé — le redécouper
  plutôt que d'allonger l'étape.

## Mettre à jour INDEX.md

Un script s'en charge, parce que réécrire une ligne de tableau Markdown à la
main casse l'alignement une fois sur trois et efface la ligne d'exemple :

```bash
python3 .claude/skills/idee-faisabilite/scripts/index.py \
  --idee "Convertisseur de rushes" \
  --statut Faisable \
  --score 8 \
  --fiche projets-actifs/convertisseur-rushes.md \
  --prochain-pas "Lister les formats d'entrée à couvrir"
```

Le script ajoute la ligne, ou **remplace** celle qui porte déjà le même nom
d'idée — c'est ce qui permet de faire évoluer un statut sans dupliquer.
Statuts acceptés : `En cours`, `Faisable`, `En pause`, `À trier`.

## Les questions qui servent

Une bonne question change la note. Une mauvaise question fait poli. Viser
celles dont la réponse déplace un critère :

- « Qui s'en sert le lundi matin, concrètement ? » → déplace l'alignement.
- « Qu'est-ce qui existe déjà et pourquoi ça ne suffit pas ? » → tue les
  redites, ou révèle la vraie valeur ajoutée.
- « Qu'est-ce qui rend ça impossible aujourd'hui ? » → révèle la dépendance
  cachée, celle qui plafonne le score.
- « Si tu ne devais garder qu'une seule fonction, laquelle ? » → c'est le MVP,
  et souvent l'étape 1.

Éviter « quel est ton budget ? » posée à froid : la réponse est toujours « ça
dépend ». Proposer plutôt un ordre de grandeur et le faire corriger.

## Pas de complaisance

C'est la règle qui fait la valeur du skill, et la plus facile à trahir parce
qu'annoncer un 4 est désagréable.

- Annoncer le score **avant** de proposer la version simplifiée. Inverser
  l'ordre, c'est enrober — la personne retient la solution et rate le
  diagnostic.
- Nommer le critère qui coince, pas « c'est ambitieux ».
- Toujours accompagner un score ≤ 6 d'une **version réduite chiffrée** : quel
  périmètre en moins ferait remonter quel critère à combien. Un refus sans
  contre-proposition n'aide personne.
- Ne pas gonfler l'alignement parce que l'idée est séduisante. C'est le critère
  le plus tentant à arranger, et c'est celui qui protège le mieux contre le
  sixième chantier abandonné.

## Convention du dépôt

Français partout : fiches, questions, messages de commit (à l'infinitif,
décrivant l'intention). Voir `CLAUDE.md` à la racine.
