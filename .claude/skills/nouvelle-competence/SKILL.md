---
name: nouvelle-competence
description: "Écrire une compétence pour ce dépôt sans en fabriquer un doublon ni un doublon d'intention — vérifier d'abord ce qui existe **y compris sur `main`**, découper par tâche et non par sujet, laisser l'outillage dans le projet, écrire en français, et l'inscrire dans la table de `CLAUDE.md`. À utiliser dès qu'on dit « crée une skill », « fais-en une compétence », « note ça quelque part pour la prochaine fois », « il faudrait un skill pour ça », « documente cette méthode », ou dès qu'un enseignement mérite de survivre à la conversation. Complète `skill-creator`, qui donne la méthode générale : ici, ce sont les règles propres à ce dépôt-ci."
---

# Une compétence de plus n'est pas toujours un progrès

Ce dépôt en compte une trentaine. Passé un certain nombre, **le risque n'est
plus d'en manquer, c'est d'en avoir deux qui se disputent le même déclenchement**
— elles se lancent alors l'une à la place de l'autre au hasard, ce qui est pire
que n'en avoir aucune.

## Le premier geste : vérifier ce qui existe déjà

```bash
ls .claude/skills/
git fetch origin main && git ls-tree -r --name-only origin/main .claude/skills/ | cut -d/ -f3 | sort -u
```

**Les deux commandes, pas seulement la première.** Une compétence peut exister
sur `main` sans être encore sur la branche courante — c'est déjà arrivé : une
compétence de débogage a été écrite ici alors qu'une autre, plus complète,
attendait dans `main`. Elle a dû être supprimée deux heures plus tard.

Si quelque chose couvre déjà le terrain : **l'étendre plutôt qu'en créer une**.
Un paragraphe ajouté à la bonne compétence vaut mieux qu'une compétence de plus
qui lui prendra ses déclenchements.

## Découper par tâche, pas par sujet

Deux compétences sur le même *sujet* se marchent dessus. Deux compétences sur
deux *tâches* différentes cohabitent très bien, même si le sujet est commun :

| Sujet commun | Tâches distinctes | Compétences |
| --- | --- | --- |
| L'interface d'Amorce | concevoir un écran / choisir des couleurs | `custom-frontend-designer` / `usine-a-themes` |
| Le radar crypto | écrire du code / régler des seuils | `radar-crypto` / `regler-le-radar` |
| Paper-Manager | développer l'outil / s'en servir | `paper-manager` / `formulaire-pdf` |

Le test qui tranche : **les deux se déclenchent-elles sur les mêmes phrases ?**
Si oui, c'est une seule compétence. Si les phrases diffèrent nettement
(« refais cet écran » contre « c'est trop sombre »), ce sont deux tâches.

Quand deux compétences se frôlent, chacune dit où finit son terrain — voir la
fin de la description d'`usine-a-themes`, qui renvoie explicitement à sa
voisine.

## La description est le seul mécanisme de déclenchement

Le corps ne se lit qu'après. Toute l'information « quand m'utiliser » va donc
dans la description, et elle doit être **franche** : le défaut courant est de ne
pas se déclencher, pas de se déclencher trop.

Y faire figurer les phrases réelles, telles qu'on les tape depuis un téléphone —
« ça déborde », « le radar ne trouve rien », « c'est trop petit » — et pas
seulement le vocabulaire technique. Personne ne prononce « LUFS » ni
« trapèze » ; ce sont pourtant les réglages qui manquent.

## Ce que doit contenir le corps

Ce que rien d'autre ne sait, et rien de plus :

- **Où atterrit un changement** dans ce projet-là.
- **Les invariants**, avec ce qui casse concrètement si on les enfreint — pas
  « viole la règle 4 » mais « les sous-titres sortiront grainés ».
- **Les pièges déjà payés**, chacun avec sa mesure quand elle existe. Un chiffre
  coupe court à un débat qu'une affirmation relance : « à `age_min_heures: 1`,
  le profil « pool de deux heures » passe de écarté à 93/100 » vaut mieux que
  « ne pas descendre sous 6 h ».
- **La commande de vérification**, et ce qu'elle ne couvre pas.

Et ce qu'il ne doit **pas** contenir : ce que le `README` du projet dit déjà.
Une compétence a été amaigrie pour cette raison — le doublon vieillit mal, et
c'est la copie qui devient fausse.

## L'outillage vit dans le projet, pas dans la compétence

Quand une compétence a besoin d'un script, il va dans le dossier du projet et la
compétence l'appelle : `kdp/vignette.py`, `pepites/profils.py`. Il reste ainsi
lançable à la main, testable, et versionné avec le code qu'il mesure.

Le signal qu'un script s'impose : **si trois exécutions de la même tâche
écrivent trois fois le même bout de code**, l'écrire une fois pour toutes.

## Conventions du dépôt

- **Français partout** : nom, description, corps, titres de section. Les
  identifiants de code restent en anglais.
- Un dossier `.claude/skills/<nom>/SKILL.md`, en-tête `name` + `description`.
- **L'inscrire dans la table de `CLAUDE.md`**, une ligne : à quoi elle sert, en
  une phrase qui dit le bénéfice et non le contenu.
- Sous les 500 lignes. Au-delà, découper en `references/` avec un renvoi depuis
  le corps.

## Vérifier qu'elle sert

Une compétence ne se teste pas comme du code, mais deux contrôles valent le
détour :

1. **Se relire en se demandant ce qu'un lecteur qui a le dépôt sous les yeux
   n'aurait pas trouvé seul.** Ce qu'il aurait trouvé n'a pas à y être.
2. **L'éprouver sur une tâche réelle**, en la faisant lire à un agent qui exécute
   la demande. C'est ainsi que quatre défauts réels ont été trouvés dans ce
   dépôt — l'exercice n'a jamais servi à noter les compétences, il a servi à
   trouver des bugs.
