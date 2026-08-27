---
name: integrer-main
description: Intégrer `main` dans une branche de ce dépôt et mener la PR jusqu'à la fusion sans perdre de cycle — le script qui classe les conflits, les quatre listes de la racine qui se télescopent à chaque fois, la course perdue quand GitHub refuse la fusion, et quelle intégration continue tourne réellement selon ce qu'on touche. À utiliser avant d'ouvrir une PR, avant de fusionner, quand « GitHub refuse de fusionner », « il y a un conflit », « ma branche est en retard », « main a bougé », quand une fusion est bloquée ou qu'on reprend une branche laissée de côté — et au démarrage de tout travail un peu long, parce que le coût de l'intégration croît avec l'attente.
---

# Intégrer main, et fusionner

Ce dépôt reçoit plusieurs sessions en parallèle. Entre l'ouverture d'une PR et
sa fusion, `main` avance — parfois de cinq projets. Le coût n'est pas dans la
résolution des conflits, qui est mécanique, mais dans le temps passé à les
identifier et dans les allers-retours quand GitHub refuse la fusion.

## Le geste

```bash
bash .claude/skills/integrer-main/scripts/integrer.sh --etat   # regarder sans toucher
bash .claude/skills/integrer-main/scripts/integrer.sh          # intégrer et classer
```

Le script refuse de travailler sur `main`, sur un arbre sale ou sur une fusion
déjà en cours ; il dit ce que `main` a reçu, tente la fusion, et **classe** les
conflits en deux tas : les listes de la racine, additives, et le reste, qui
demande un jugement. Il affiche les blocs côte à côte pour éviter d'ouvrir
chaque fichier. Codes de sortie : `0` propre, `1` refus, `2` conflits à résoudre.

Il ne résout rien, et c'est délibéré : garder les deux côtés d'une liste est
mécanique, mais la phrase qui l'introduit ne se fusionne pas. Résoudre à
l'aveugle produit un « neuf projets » suivi de dix éléments — une erreur qui
survit des mois parce qu'elle a l'air d'avoir été relue.

## Les quatre listes qui se télescopent

Chaque projet ajouté allonge les mêmes fichiers. Un conflit y est presque
toujours additif : **garder les deux côtés**, puis relire ce qui les introduit.

| Fichier | Ce qui s'y ajoute | Le piège |
| --- | --- | --- |
| `CLAUDE.md` | le projet dans la phrase d'en-tête, une ligne dans la table des recettes | Le **compte** en gras (« neuf projets ») ne se fusionne pas : le recompter sur la liste résolue |
| `.gitignore` | les chemins que le projet ne versionne pas | Aucun — coller les deux blocs |
| `.claude/hooks/session-start.sh` | l'installation des dépendances du projet | Deux branches qui ajoutent une étape au même endroit : garder les deux, l'ordre est libre |
| `.claude/skills/verifier/SKILL.md` | la séquence de vérification du projet | Le préambule ne compte plus les projets, exprès : ne pas réintroduire un nombre |
| `.github/requirements-tests.txt` | la bibliothèque qu'un nouveau test atteint | Ne jamais y recopier la liste du hook : voir l'en-tête du fichier |

Un conflit **ailleurs** que dans ces fichiers est un signal, pas une corvée :
quelqu'un travaille le même sujet. Regarder les PR ouvertes avant de trancher.
Deux branches ont fabriqué Life-Organizer chacune de son côté ; la seconde a été
refaite. Ce qui est fusionné gagne, toujours.

## La course qu'on perd en fusionnant

`main` peut bouger **entre** la dernière intégration et l'appel à la fusion.
GitHub répond alors `405 Pull Request has merge conflicts`. Ce n'est pas une
panne et il ne faut pas réessayer : réintégrer, résoudre, pousser, refusionner.
Trois tours d'affilée sont un déroulement normal ici, pas un signe d'erreur.

Le raccourci qui évite un tour : intégrer **juste avant** d'appeler la fusion,
et non juste avant d'ouvrir la PR. L'ouverture, elle, ne coûte rien à refaire.

## Ce qui est réellement vérifié

Une idée fausse circule : « le seul workflow porte sur `look_and_find/**`, donc
une PR ailleurs n'a aucun contrôle ». C'était vrai, ça ne l'est plus.

| Workflow | Se déclenche sur |
| --- | --- |
| `tests-python.yml` | **toutes les PR, sans filtre de chemin** — il découvre les `*/tests` contenant des `test_*.py` |
| `amorce.yml` | `src/`, `scripts/`, les configurations de la racine |
| `agence.yml` | `agence/**` |
| `look-and-find.yml` | `look_and_find/**`, plus déclenchement manuel |

Conséquences pratiques : une suite Python posée dans `<projet>/tests/` est
gardée **sans rien déclarer** ; une PR qui ne touche qu'à `.claude/` ou à des
fichiers Markdown ne déclenche que `tests-python`, qui ne dit rien de son
contenu — c'est `/verifier` qui tient lieu de filet, et il faut l'avoir lancé
pour de vrai. Une suite sous deux niveaux (`archives-backlog/x/tests`) n'est
**pas** découverte : la boucle ne descend qu'un cran.

## L'enchaînement complet

1. `integrer.sh --etat` avant de commencer un travail long : savoir si `main` a
   déjà bougé coûte deux secondes et évite de bâtir sur du périmé.
2. Travailler, committer par intention (voir `/steward`).
3. `integrer.sh`, résoudre, **`/verifier` sur le projet touché**, committer la
   fusion, pousser.
4. Ouvrir la PR — description en français, ce que la décision coûte, et ce qui
   n'a **pas** été vérifié.
5. `integrer.sh` une dernière fois, puis fusionner par **commit de fusion**.
6. Après la fusion, la branche est finie. Une PR fusionnée ne se réutilise pas :
   repartir de `main` en gardant le même nom (`git checkout -B <branche>
   origin/main`), ce qui donne une avance rapide à pousser, sans rien réécrire.

## Ce que ce document ne couvre pas

Le style des commits, la barrière de vérification et le diagnostic des échecs
d'intégration continue sont dans `/steward`, qui ne les répète pas ici.
