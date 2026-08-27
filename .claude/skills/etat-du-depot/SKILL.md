---
name: etat-du-depot
description: Voir ce qui a changé dans ce dépôt pendant qu'on ne regardait pas — quelles autres sessions travaillent en ce moment et sur quoi, si le sujet qu'on s'apprête à écrire existe déjà, et si ce que `CLAUDE.md` affirme du dépôt est encore vrai. Outillé par deux scripts qui mesurent au lieu de supposer. À utiliser **avant d'écrire la première ligne** d'un nouveau chantier, avant d'ouvrir une pull request, après avoir récupéré `main`, et dès qu'une demande dit « on démarre quoi », « qui bosse sur quoi », « est-ce que ça existe déjà », « c'est à jour ? », « relis CLAUDE.md », « vérifie la doc », « pourquoi ça conflicte tout le temps ». À utiliser aussi quand on s'apprête à ajouter un projet, une compétence ou un agent : c'est là que la documentation devient fausse.
---

# Le dépôt bouge sous tes pieds

Ce dépôt reçoit **une dizaine de sessions en parallèle**. Ce n'est pas une
image : mesuré à un instant quelconque, treize branches avaient été poussées
dans les sept jours, trois d'entre elles dans les deux minutes précédentes.

Deux conséquences, et ce sont les deux seules choses que cette compétence
traite. Le reste — savoir où atterrit une demande, résoudre un conflit, passer
le relais — est couvert par `/naviguer-le-depot`, `/fusionner-main` et
`/passer-le-relais`, qui ne sont pas répétés ici.

## 1. Quelqu'un travaille peut-être déjà sur ton sujet

```bash
python3 .claude/skills/etat-du-depot/scripts/etat-du-terrain.py <mots du sujet>
python3 … --jours 3      # ne montrer que les branches des trois derniers jours
```

Il montre trois choses, dans cet ordre : où en est `main` **maintenant** (il
récupère toutes les branches distantes, pas seulement `main` — sans quoi il ne
verrait pas les sessions ouvertes depuis le démarrage du conteneur), quelles
branches ont bougé récemment et sur quoi, et ce que le dépôt contient déjà sous
ces mots.

**Pourquoi le lancer avant d'écrire plutôt qu'après.** Deux sessions ont
construit Life-Organizer chacune de son côté ; la seconde a perdu une journée
entière et a dû refaire son travail sur la base fusionnée. Rien ne l'avait
prévenue : `git status` ne montre pas les branches des autres, et le `main`
cloné à l'ouverture de la session est déjà en retard de plusieurs heures.

Ce que le script ne fait pas : décider. Il montre, et c'est à la lecture qu'on
tranche. Trois lectures possibles, dans l'ordre de préférence :

1. **Une branche porte le même sujet** → la lire (`git show origin/<branche>:<fichier>`),
   puis rejoindre plutôt que refaire. Ce qui existe déjà a déjà payé ses pièges.
2. **Le dépôt contient déjà quelque chose** sous ces mots → partir de
   l'existant. Ce qui est fusionné gagne, toujours.
3. **Le terrain est libre** → écrire, et rester bref : plus la branche vit
   longtemps, plus elle attrape de conflits.

Cette compétence a servi à s'écrire elle-même, et ça vaut mise en garde : trois
compétences étaient prévues, le script en a trouvé **deux déjà écrites** sur une
branche voisine. Elles ont été abandonnées avant d'exister. C'est le résultat
normal, pas un échec — la journée gagnée est là.

## 2. Ce que le dépôt dit de lui-même a peut-être cessé d'être vrai

```bash
python3 .claude/skills/etat-du-depot/scripts/verifier-coherence.py
python3 … --strict       # échouer aussi sur les « à regarder »
```

`CLAUDE.md`, les compétences et le hook de démarrage sont la mémoire du projet :
c'est ce qu'une session neuve lit avant d'écrire. Ils ont un défaut unique mais
grave — **ils vieillissent en silence**. Un projet ajouté par une session
pendant qu'une autre travaillait, et la liste des projets est fausse. Aucun test
n'échoue sur une phrase.

Relevé sur une seule journée de ce dépôt : « trois projets » quand il y en avait
six, une section annonçant deux règles et en listant trois, une ligne
d'outillage qui cachait cinq installations du hook, quatre compétences absentes
de leur propre table. Aucune n'était trouvable autrement qu'en relisant tout —
et personne ne relit tout.

Le script compte des deux côtés et compare : projets réels contre projets cités,
compétences sur disque contre table de `CLAUDE.md`, agents, chemins cités qui
n'existent plus, listes annoncées « trois » qui portent quatre puces, projets
installables absents du hook, dossiers de tests hors de portée de l'intégration
continue.

Il sépare **faux** (démontrable : le chemin n'existe pas, le compte ne tombe
pas) de **à regarder** (une piste qui demande un humain : un projet sans ligne
dans le hook n'a peut-être rien à installer). Seul le premier fait échouer. La
distinction n'est pas de la politesse : un outil qui crie faux est un outil
qu'on cesse de lire, et le jour où il a raison plus personne ne le croit.

### Quand le lancer

- **Après avoir ajouté un projet, une compétence ou un agent** — c'est
  exactement le geste qui rend `CLAUDE.md` faux, et le seul moment où la
  correction coûte une ligne.
- **Avant d'ouvrir une pull request** qui touche à `CLAUDE.md`, au hook ou aux
  compétences.
- **En relisant `CLAUDE.md`** : trente secondes de script valent mieux qu'une
  relecture de quatre cents lignes, qui ne voit de toute façon pas ce qui
  manque.

### Corriger ce qu'il trouve

Corriger, et non signaler : un « faux » se répare en une ligne, et le laisser
en l'état revient à décider que la mémoire du dépôt peut mentir.

Deux réserves, tirées de la nature du terrain :

- **`CLAUDE.md`, le hook et `/verifier` sont des aimants à conflits** : presque
  toutes les branches y ajoutent quelque chose. Si une autre session est en
  train d'y travailler (`etat-du-terrain.py` le dit), corriger quand même mais
  s'attendre à fusionner — voir `/fusionner-main`, la résolution y est
  **additive**, jamais un arbitrage.
- **Ne pas faire taire le contrôle** en retirant la phrase qu'il juge fausse.
  « Trois règles » suivi de quatre puces se corrige en écrivant « quatre », pas
  en supprimant la quatrième.

## Ce que ni l'un ni l'autre ne voit

Le premier ne connaît que ce qui est **poussé** : une session qui travaille
depuis une heure sans pousser reste invisible. Le second ne juge que ce qui se
compte ; il ne dira jamais qu'une explication est devenue fausse alors que les
noms qu'elle cite existent toujours. Une phrase qui décrit un mécanisme disparu
passe au travers — c'est la relecture humaine qui l'attrape, et c'est pour ça
qu'elle garde sa place.
