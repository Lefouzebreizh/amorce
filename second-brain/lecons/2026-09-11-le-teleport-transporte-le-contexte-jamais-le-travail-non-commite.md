# Le téléport transporte le contexte, jamais le travail non commité

**11/09/2026, mesuré.** Une session distante (conteneur `anthropic_cloud`,
origine `android`) avait écrit dix-huit fichiers d'un projet neuf dans
`/home/user/amorce`, sans commit ni poussée. Erwann a lancé
`claude --teleport <session>` depuis son PC pour reprendre la main. Le fil a
repris avec **toute la conversation**, et l'arbre de travail local ne portait
**rien** :

| Ce qui a suivi | Ce qui n'a pas suivi |
| --- | --- |
| Le contexte entier de la conversation | Les fichiers écrits sur le disque du conteneur |
| Les décisions prises, les mesures faites | La branche : `git branch -r` ne la connaissait pas |

`psy-ia/` n'existait pas, et `origin` n'avait aucune branche du nom de la
session. Le travail était intégralement dans le conteneur, et le PC repartait
d'un dépôt **184 commits en retard** sur `origin/main`.

## Ce que ça coûte, et pourquoi ça aurait pu coûter bien plus

Ici, rien : le contenu des dix-huit fichiers était encore **dans le
contexte**, donc réécrit en quelques minutes. C'est un coup de chance de
calendrier, pas une propriété du mécanisme — une session plus longue aurait
vu ce contenu partir au compactage, et il n'en serait resté qu'un résumé.
Le résumé transporte l'état, jamais les fichiers (§3).

## La parade, et elle tient en une phrase

**Committer et pousser avant de téléporter**, même un lot inachevé, même
laid : une branche poussée existe pour tout le monde, un fichier sur le
disque d'un conteneur n'existe pour personne (§10 bis — « tant qu'un lot
n'est pas sur `main`, il n'existe pour personne d'autre » vaut aussi entre
deux machines de la même personne).

Et pour la session qui **reçoit** le téléport, dans cet ordre :

1. `git fetch --prune -q origin main` puis `git rev-list --count HEAD..origin/main`
   — le PC est presque toujours en retard, et le §9 le dit déjà pour la
   lecture des règles : ici c'est le travail lui-même qui est en jeu.
2. Vérifier que ce que la conversation décrit existe sur le disque, avant de
   continuer à en parler. Un `ls` du dossier cité coûte une seconde ; croire
   qu'il est là coûte le lot.

## Ce qui n'est pas mesuré

Si le conteneur tourne encore après le téléport, et si ses fichiers y sont
toujours récupérables. Non vérifié — et de toute façon inaccessible depuis le
PC, qui n'a aucun chemin vers le disque d'une session cloud (§7).
