---
name: fusionner-main
description: Rapatrier `main` dans une branche de ce dépôt et résoudre les conflits, qui tombent presque toujours sur les trois mêmes fichiers partagés — le hook de démarrage, la compétence `verifier` et `CLAUDE.md`. Dit la méthode qui va vite (repartir de la version de main, y réinjecter ses ajouts) plutôt que celle qui fait perdre une heure. À utiliser dès qu'une pull request est marquée en conflit, dès qu'on dit « récupère main », « mets à jour ma branche », « ça conflicte », « la PR est bloquée », « rebase », « fusionne main », et **avant** d'ouvrir une PR sur une branche vieille de plus d'un jour — ce dépôt reçoit plusieurs sessions en parallèle et un jour d'attente ajoute un conflit.
---

# La fusion de `main` revient plus souvent qu'on ne croit

Ce dépôt reçoit plusieurs sessions en parallèle, et **presque toutes les
branches touchent aux mêmes trois fichiers partagés**. Sur une seule session
d'une journée, la fusion peut se présenter trois fois. Ce n'est pas un accident
d'organisation : c'est la structure du dépôt, et il vaut mieux avoir la recette
que la redécouvrir.

## Les trois fichiers, et pourquoi eux

| Fichier | Ce que chaque branche y ajoute |
| --- | --- |
| `.claude/hooks/session-start.sh` | Le bloc d'installation de son projet |
| `.claude/skills/verifier/SKILL.md` | La section de vérification de son projet |
| `CLAUDE.md` | Une ligne dans la table de l'outillage, et une mention du projet |

**Les conflits y sont presque toujours additifs** : deux branches ajoutent deux
choses différentes au même endroit. Personne n'est en désaccord, git ne sait
simplement pas dans quel ordre les mettre. La résolution est donc l'**union**,
jamais un arbitrage — si tu te surprends à choisir un camp sur ces trois
fichiers-là, relis : tu es probablement en train de supprimer le travail de
quelqu'un.

## La méthode qui va vite

```bash
git fetch origin main
git log --oneline HEAD..origin/main   # regarder ce qui est arrivé, ça oriente tout
git merge origin/main --no-edit
```

Sur un conflit dans l'un des trois fichiers partagés :

```bash
git checkout --theirs <fichier>       # repartir de la version de main
```

puis **y réinjecter ses propres ajouts**, à la main.

C'est contre-intuitif, et c'est pourtant beaucoup plus rapide que de résoudre
marqueur par marqueur. La raison : `main` ne fait pas qu'ajouter, il
**restructure**. Des projets sont déplacés (`mon-app-audio/` est parti sous
`archives-backlog/`), des sections sont réécrites, des formulations sont
améliorées. Recoller ligne à ligne, c'est reconstituer patiemment un fichier
qui a changé de forme, et finir avec un mélange des deux structures. Repartir de
la sienne, c'est écraser le travail des autres.

**Ne jamais rebaser.** Ces branches sont poussées et parfois relues ; un
`rebase` invalide le checkout de tout le monde. Le dépôt fusionne par commit de
fusion, comme le reste de son historique.

## Après la fusion, trois contrôles que rien n'automatise

1. **Les commandes que main a déplacées.** Si un projet a bougé, ses chemins de
   test ont bougé avec lui. Vérifier que ceux qu'on a écrits pointent encore
   quelque part.
2. **Ses propres compétences.** Une compétence qu'on a écrite avant la fusion
   peut être devenue fausse après : elle nommait un dossier déplacé, comptait
   des projets, ou renvoyait vers une compétence disparue. C'est le piège le
   plus discret de la fusion, parce que rien ne le signale.
3. **Les doublons de compétence.** `main` a pu apporter une compétence qui
   couvre le même sujet que la sienne. Deux compétences sur un même sujet se
   déclenchent l'une contre l'autre au hasard, ce qui est pire que n'en avoir
   aucune : garder celle de `main`, y verser ce que la sienne avait d'unique,
   supprimer la sienne.

Puis la barrière habituelle, sur le projet touché :

```bash
bash -n .claude/hooks/session-start.sh   # le hook a été édité, il doit rester valide
npm run typecheck && npm run lint && npm test
```

## Ce qui a déjà été déminé

Deux aimants à conflits ont été retirés — inutile de les recréer :

- **La ligne d'accueil du hook** ne s'écrit plus d'un bloc. Chaque projet
  déclare sa commande dans son propre bloc (`commandes+=("…")`) et la ligne se
  compose à la fin. Avant, c'était sept cents caractères sur une seule ligne que
  tout nouveau projet devait modifier : un conflit garanti par projet ajouté.
- **Le décompte de projets de `CLAUDE.md`** a disparu de la phrase
  d'introduction. Il est passé de « cinq » à « onze » en quelques semaines, se
  trompait entre-temps, et forçait une modification de la même ligne à chaque
  arrivée. L'énumération qui suit dit la même chose sans se périmer.

Si un nouveau conflit se répète, chercher la même forme : **une ligne unique que
tout le monde doit modifier**. La découper vaut mieux que documenter comment la
résoudre.

## Ouvrir la PR avant qu'elle ne vieillisse

Une branche de plus d'un jour dans ce dépôt, c'est un conflit de plus à
résoudre. Le `CLAUDE.md` le dit dans « Rythme de travail » et cette compétence
en est la preuve empirique : la même branche a fusionné `main` trois fois en une
session, et la troisième fois `main` avait pris cent commits d'avance.
