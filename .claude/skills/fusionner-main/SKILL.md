---
name: fusionner-main
description: Remettre une branche à jour sur `main` dans ce dépôt et résoudre les conflits qui en sortent — ils tombent presque toujours sur les quatre mêmes fichiers partagés (`CLAUDE.md`, le hook de démarrage, `.gitignore`, `INDEX.md`) et ont presque toujours la même forme, deux sessions ayant ajouté une ligne à la même liste. À utiliser dès qu'une branche est en retard, qu'une PR est déclarée non fusionnable, qu'un conflit apparaît, que GitHub affiche « cette branche présente des conflits », avant d'ouvrir une PR, et dès qu'une demande dit « récupère main », « mets à jour la branche », « résous le conflit », « ça ne se fusionne plus », « rebase » — y compris quand elle ne dit que « pourquoi je ne peux pas fusionner ».
---

# Ici, un conflit n'est presque jamais une divergence de fond

Ce dépôt reçoit plusieurs sessions en parallèle, et elles se croisent toutes sur
les mêmes fichiers racine. Dix commits « Fusionner main » figurent déjà dans
l'histoire. Le relevé des fichiers les plus touchés dit pourquoi :

| Fichier | Modifications | Ce que chaque session y fait |
| --- | ---: | --- |
| `CLAUDE.md` | 56 | ajoute une ligne à la table de l'outillage, ou un piège |
| `.claude/hooks/session-start.sh` | 17 | ajoute l'installation de son projet, et sa commande de test |
| `.gitignore` | 9 | ajoute ce que son projet produit |
| `INDEX.md` | 6 | ajoute une idée, ou change un statut |

Ces quatre-là sont des **listes partagées**. Deux sessions y ajoutent chacune sa
ligne, git ne sait pas laquelle garder, et c'est tout le conflit. **La réponse
est presque toujours : garder les deux.** Choisir un côté fait disparaître le
travail de l'autre session, en silence, et personne ne s'en aperçoit avant que
son projet ne s'installe plus au démarrage.

## La manœuvre

```bash
git fetch origin main
git merge origin/main --no-edit
git diff --name-only --diff-filter=U     # ce qui reste à trancher
```

**Fusionner, jamais rebaser.** Un commit de fusion garde valide le clone de
quiconque a déjà récupéré la branche ; une réécriture d'historique le casse.
C'est vrai même sur une branche qu'on a créée soi-même, parce qu'on ne sait pas
qui l'a déjà lue.

## Trancher, selon la forme du conflit

**Les deux côtés ont ajouté à la même liste** — le cas courant. Garder les deux
ajouts, dans un ordre lisible. Rien ne se perd, et c'est la seule résolution qui
respecte le travail des deux sessions.

**Les deux côtés ont réécrit la même phrase** — plus rare, et c'est là qu'il faut
réfléchir. La règle du dépôt tranche : *ce qui est fusionné gagne, toujours*.
Prendre la version de `main`, puis se demander ce que la sienne apportait
d'unique et le rajouter en une incise plutôt qu'en la remplaçant. Une résolution
qui écrase `main` oblige l'autre session à refaire son travail.

**Les deux côtés ont changé la même logique, et choisir perd un comportement** —
le seul cas qui mérite de s'arrêter et de demander. Il ne s'est encore jamais
produit sur ces quatre fichiers.

## La ligne d'accueil du hook, à part

La dernière ligne de `session-start.sh` énumère les commandes de vérification de
chaque projet. Elle est le conflit le plus fréquent du dépôt, et le plus facile à
résoudre de travers : c'est **une seule ligne** que les deux côtés ont allongée,
donc git la donne entière des deux côtés. Recomposer une ligne qui contient les
deux ajouts, jamais en choisir une.

Cette ligne est le seul endroit où une session distante apprend quelles commandes
existent. En perdre une rend un projet muet au démarrage — sans erreur, sans
test rouge, sans rien.

## Avant de pousser

```bash
python3 .claude/outils/etat.py          # l'écart avec main est-il résorbé
npm run typecheck && npm run lint && npm test
```

Et les tests des projets voisins si la fusion a touché un fichier partagé : une
résolution ratée sur le hook ou sur `.gitignore` ne casse pas Amorce, elle casse
le projet d'à côté. La ligne d'accueil du hook les énumère tous.

## Le commit de fusion

Il dit **ce qui a été tranché et pourquoi**, pas « merge branch main ». Les
messages du dépôt ressemblent à :

> Fusionner main : garder sa liste du hook, lui adjoindre le garde-fou
>
> Les deux côtés ont corrigé la même ligne, différemment. Ce qui est fusionné
> gagne — on garde la liste de main, on ne conserve de l'autre version que sa
> mise en garde.

## Le meilleur conflit est celui qu'on n'a pas

Le retard se paie au carré : une branche vieille d'une journée croise cinq
sessions. Deux habitudes l'évitent presque entièrement.

**Partir de `main` frais, et le revérifier juste avant d'ouvrir la PR** — c'est
écrit dans `CLAUDE.md`, et c'est ce qui coûte le moins cher.

**Ne pas laisser dormir une PR verte.** Elle ne vieillit pas seule : ce sont les
autres qui avancent. Voir `/steward` pour la mener jusqu'à la fusion.

Si la PR a déjà été fusionnée et qu'on veut enchaîner, ne pas empiler sur son
historique : repartir de `main`.

```bash
git fetch origin main && git checkout -B <branche> origin/main
```
