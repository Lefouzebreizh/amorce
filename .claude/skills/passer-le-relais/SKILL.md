---
name: passer-le-relais
description: Clore une session de travail et en ouvrir la suivante sans rien perdre — le résumé de reprise qui tient en vingt lignes, ce qu'on y met et ce qu'on écrit plutôt dans le dépôt, et la mécanique pour créer puis archiver la session. À utiliser dès qu'un fil s'allonge, change de sujet, porte des captures d'écran ou de longues sorties de commandes, avant d'attaquer un gros morceau, et quand une demande dit « passe le relais », « ouvre une nouvelle session », « fais un résumé de reprise », « ce fil devient long », « on repart de zéro » ou « archive ça ». À proposer de soi-même : personne ne pense à passer le relais avant que ce soit déjà cher.
---

# Passer le relais

`CLAUDE.md` en fait une règle de travail : une conversation longue est relue en
entier à chaque message, captures comprises, et finit par coûter plus cher que
le travail qu'elle porte. Ce document dit **comment** le faire sans rien perdre.

## Ce qui se perd, et ce qui ne se perd pas

La session suivante repart d'un **clone frais**. Ce qui n'est pas poussé
n'existe pas pour elle — ni les fichiers non committés, ni la branche restée
locale, ni ce qu'on a compris et gardé pour soi.

D'où la règle qui rend le relais bon marché : **ce qui doit survivre va dans le
dépôt, pas dans le résumé.** Une décision de conception va en tête du module
qu'elle justifie ; un piège rencontré va dans la recette du projet ; une
convention va dans `CLAUDE.md`. Le résumé n'est alors qu'un **pointeur** — et
c'est pour cela qu'il tient en vingt lignes.

Écrire d'abord, résumer ensuite. Un résumé qui porte des connaissances que le
dépôt ignore est une mémoire qui mourra avec la session d'après.

## Fabriquer le résumé

```bash
bash .claude/skills/passer-le-relais/scripts/etat.sh
```

Le script relève ce qui se vérifie plutôt que de se raconter : branche, commits
non poussés, fichiers non committés, retard sur `main`, ce que la branche
apporte, projets touchés. Il signale en clair ce qui serait perdu.

Il laisse quatre lignes à remplir à la main, parce qu'elles ne se relèvent nulle
part :

| Ligne | Ce qu'elle évite à la session suivante |
| --- | --- |
| **Vérifié par** — la commande lancée et son résultat | Refaire une vérification déjà faite, ou pire, croire vérifié ce qui ne l'est pas |
| **Prochain geste** — la première commande à taper | Un quart d'heure à retrouver où on en était |
| **Décisions pas encore écrites dans le dépôt** | Reprendre une décision déjà tranchée, autrement |
| **Piège rencontré** | Repayer une heure déjà payée |

Si la dernière ligne est longue, c'est le signe qu'elle n'est pas à sa place :
un piège appartient à la recette du projet, où la prochaine personne le lira
sans avoir à ouvrir une vieille session.

## Ce qu'un résumé de reprise n'est pas

- **Le récit de la conversation.** Personne ne relira ce qu'on a essayé puis
  abandonné. Ce qui compte est l'état, pas le chemin.
- **Une recopie de ce que le dépôt dit déjà.** Pointer `paper-manager/README.md`
  coûte une ligne ; le paraphraser en coûte trente et se périme.
- **Un compte rendu de réussite.** Ce qui n'a pas été vérifié, ce qui a été
  laissé de côté et pourquoi valent plus que la liste de ce qui marche.

## La mécanique

Dans une session distante, l'enchaînement complet tient en trois appels :

1. **Pousser** ce qui reste. Le script le rappelle ; c'est la seule étape dont
   l'oubli est irréversible.
2. **Créer la session suivante** avec `create_session` (serveur
   `claude-code-remote`) : le résumé en `prompt`, un `title` qui dit le sujet,
   et les mêmes `tags` que la session courante pour qu'on retrouve la série.
   L'environnement et le modèle sont hérités si on ne les précise pas — les
   préciser sans raison, c'est risquer de repartir sur un socle différent.
3. **Archiver la session courante** avec `archive_session`, une fois la
   nouvelle démarrée, et donner son nom à l'utilisateur.

Archiver avant d'avoir vérifié que la suivante a bien démarré ferait perdre le
fil dans les deux sens : le faire dans cet ordre.

## Quand le proposer

Personne ne demande de passer le relais avant que ce soit déjà cher. Les signes
qui doivent le déclencher, sans attendre qu'on le demande :

- le fil porte une **image** ou une longue sortie de commande — elles se relisent
  intégralement à chaque message ;
- le sujet **change** (on passe d'un projet à un autre) ;
- un **gros morceau** commence, alors que le fil porte déjà un travail terminé ;
- une PR vient d'être **fusionnée** : le fil qui l'a menée n'a plus d'usage.

Le proposer coûte une phrase. Ne pas le proposer coûte à chaque message suivant.
