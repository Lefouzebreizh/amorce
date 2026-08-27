---
name: passer-le-relais
description: Clore une session devenue longue et écrire le résumé de reprise qui permet à la suivante de repartir sans rien perdre — l'état poussé, ce qui est vérifié et ce qui ne l'est pas, la prochaine action unique, et les pièges découverts en chemin. Dit aussi ce qui ne survit **pas** à un changement de session. À utiliser dès qu'une conversation change de sujet ou s'alourdit, dès qu'on dit « on continue demain », « nouvelle session », « fais un point », « résume où on en est », « ça rame », « je reprends plus tard », et systématiquement avant d'archiver un fil. Un fil long est relu en entier à chaque message, captures comprises : il finit par coûter plus cher que le travail qu'il porte.
---

# Une conversation longue coûte plus que le travail qu'elle porte

Chaque message d'un fil rejoue tout ce qui précède, images comprises. Passé un
certain point, la conversation devient l'essentiel de la dépense et le travail
l'accessoire. Le `CLAUDE.md` en fait une règle de travail ; ce fichier-ci dit
comment l'appliquer sans rien perdre.

**Rien n'est perdu en changeant de session**, à une condition : que ce qui compte
soit dans le dépôt et non dans la discussion. La mémoire du projet vit dans
`CLAUDE.md`, dans les compétences et dans les blocs de commentaires en tête de
fichier. C'est déjà la convention ; le passage de relais ne fait que la
respecter jusqu'au bout.

## Avant d'écrire quoi que ce soit

```bash
git status --short     # rien ne doit rester non commité
git push -u origin <branche>
```

Ce qui n'est pas poussé n'existe pas pour la session suivante. C'est le seul
point de cette compétence qui n'admet pas d'exception.

## Ce qui ne survit pas

À dire explicitement dans le résumé, parce que la session suivante n'a aucun
moyen de le deviner :

- **Les agents lancés en arrière-plan.** Un redémarrage de conteneur les tue en
  silence, et leur travail est perdu s'ils ne l'ont pas écrit sur disque. C'est
  arrivé une fois : huit agents, aucun résultat. D'où la consigne, quand on en
  lance : leur demander d'écrire une première version de leur sortie **tôt**,
  puis de l'affiner.
- **Le répertoire de travail temporaire.** Tout ce qui y est rangé disparaît.
- **Les décisions prises oralement dans le fil.** Une règle donnée en cours de
  route — « décide sans me demander », « ne touche pas à X » — n'existe nulle
  part ailleurs. Si elle vaut pour la suite, elle va dans `CLAUDE.md` ou dans une
  compétence ; sinon elle va dans le résumé et se perdra après.
- **Les fichiers envoyés dans la conversation** : PDF, captures, exports. Ils
  restent lisibles par la personne, pas par la session suivante. Un livrable qui
  doit durer se commite ou se refabrique par une commande.

## Le résumé de reprise

Six sections, courtes. Il s'écrit pour quelqu'un qui n'a rien lu du fil.

```markdown
## D'où on part
Branche, dernier commit, état de la pull request. Une ligne.

## Ce qui est fait
Ce qui tourne et se vérifie. Pas l'historique des tentatives — l'état.

## Ce qui n'est pas vérifié
La partie que personne ne lira si elle n'est pas écrite ici, et la plus
importante : ce qui n'a pas pu être éprouvé, et pourquoi. Un « tout est vert »
qui tait ce qui n'a pas été contrôlé est un compte rendu faux.

## La prochaine action
**Une seule**, exécutable, avec sa commande. Pas une liste de souhaits : la
chose à faire en premier au prochain message.

## Les pièges trouvés en chemin
Ce qui a coûté du temps et n'était écrit nulle part. S'il s'agit d'un piège
durable, il ne va pas ici : il va dans la compétence ou le commentaire de tête
concerné, et le résumé dit seulement où.

## Ce qui reste ouvert
Les questions en suspens, avec la décision à prendre — pas la discussion.
```

## Le réflexe qui rend le résumé inutile

À chaque fois qu'un enseignement durable apparaît dans le fil, **l'écrire à sa
place** plutôt que dans le résumé : un piège d'API dans la compétence du projet,
une décision de conception dans le bloc de tête du fichier, une règle de travail
dans `CLAUDE.md`. Le résumé n'a alors plus à porter que l'état et la prochaine
action, et il tient en quinze lignes.

Un résumé qui grossit est le signe qu'on a laissé la connaissance dans la
discussion au lieu de la ranger.

## Puis

Créer la session suivante avec ce résumé comme premier message, **donner son
nom** à la personne, et archiver la précédente. Une session ouverte qu'on ne
reprendra pas continue d'apparaître dans les listes et brouille la lecture.
