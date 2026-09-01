---
name: relais
description: Clore un fil de conversation devenu lourd et en ouvrir un neuf sans rien perdre — rassemble l'état réel depuis le dépôt (branche, PR ouvertes, fiches, dernier vert) et rédige le résumé de reprise. À utiliser dès qu'une conversation change de sujet, dépasse la dizaine d'échanges, porte des captures d'écran, ou qu'on dit « on passe à autre chose », « nouvelle session », « ça devient long », « reprends où on en était », « fais un résumé pour continuer ailleurs », ou simplement « archive » sans autre précision (règle écrite dans `CLAUDE.md` §9 bis) — dans ce dernier cas, le résumé part aussi en fichier téléchargeable, pour que la session suivante démarre dessus sans qu'on ait à le retaper. À utiliser aussi de sa propre initiative quand le fil s'alourdit : chaque message relit l'intégralité du fil, donc un fil long coûte plus cher que le travail qu'il porte, et personne ne pense à le dire.
---

# Passer le relais

Une conversation est relue **en entier à chaque message**, captures comprises.
Le coût croît donc avec le carré de sa longueur, alors que ce qu'elle apporte
reste constant. Un fil qui a changé trois fois de sujet paie encore, à chaque
tour, pour les deux premiers.

`CLAUDE.md` en fait une règle. Ce skill l'outille — et surtout, il évite le
piège du résumé écrit de mémoire.

## La règle qui fait tout le reste

**Le résumé se construit depuis le dépôt, jamais depuis le souvenir de la
conversation.** Un résumé de mémoire recopie ce qu'on croyait avoir fait ; le
dépôt dit ce qui a été fait. Les deux divergent toujours — et c'est la version
fausse qui survivrait, puisque le fil qui la contredisait vient d'être fermé.

## Rassembler l'état

```bash
git branch --show-current
git log --oneline origin/main..HEAD | cat        # ce qui n'est pas encore fusionné
git status --short                                # ce qui n'est même pas committé
python3 .claude/skills/steward/scripts/preflight.py   # ce qui pend hors du diff
sed -n '/## Idées/,/## Terrain/p' INDEX.md 2>/dev/null   # les fiches en cours
```

Trois questions à trancher avant d'écrire, parce que ce sont celles qu'un
nouveau fil ne peut pas deviner :

1. **Y a-t-il du travail non poussé ?** Le conteneur d'une session distante est
   repris après inactivité. Ce qui n'est pas poussé n'existe pas — pousser
   avant de clore, toujours.
2. **Une PR reste-t-elle ouverte ?** Une PR sans personne pour la mener est une
   PR qui pourrit et qui conflitte. La fusionner, ou la fermer en disant
   pourquoi.
3. **Qu'est-ce qui n'est écrit nulle part ?** Une décision prise en séance et
   restée dans le fil est perdue à la fermeture. Elle va dans `CLAUDE.md`, dans
   un skill, ou dans une fiche — pas dans le résumé, qui n'est lu qu'une fois.

C'est le point trois qui compte le plus. Le résumé transporte l'état ; le dépôt
transporte la mémoire.

## Le résumé de reprise

Court. Il est lu une fois, pour redémarrer, puis n'est plus jamais consulté.

```markdown
## Reprise — [sujet en trois mots]

**Le but à terme :** [ce que cette discussion cherche à obtenir au bout du
compte — pas la tâche du jour]

**Où on en est :** [une phrase : ce qui est fusionné, ce qui reste ouvert]

**Le prochain pas :** [une action, assez précise pour être commencée sans
rien relire]

**Ce qu'il faut savoir et qui n'est pas évident :**
- [décision prise et sa raison, si elle n'est pas déjà dans le dépôt]
- [piège rencontré, s'il n'est pas déjà consigné]

**Où c'est écrit :** [fichiers à ouvrir — fiche, skill, section de CLAUDE.md]
```

**Le but vient en premier, et il n'est pas facultatif.** C'est la seule ligne du
résumé qui ne se périme pas : l'état est faux le lendemain, le prochain pas est
franchi dans l'heure, le but tient jusqu'à ce qu'il soit atteint. C'est aussi la
seule qui permette au fil suivant de refuser une bonne idée qui n'y mène pas —
sans elle, une session enchaîne des pas justes vers une destination que personne
n'a choisie. S'il ne tient pas en une ligne, c'est que le fil porte deux sujets :
en ouvrir deux.

Ne pas y recopier ce que le dépôt dit déjà : la fiche projet, la grille de
notation, les invariants. Le résumé **pointe**, il ne duplique pas. Un résumé
qui reproduit une fiche crée une seconde version qui divergera de la première.

## Ce qu'on ne ferme pas

Un fil se clôt sur un état propre, jamais au milieu :

- du travail non poussé,
- une PR ouverte que personne ne reprend,
- une vérification rouge dont personne ne connaît la cause.

Dans ces trois cas, finir d'abord. Un fil fermé sur un chantier ouvert n'a rien
allégé — il a juste déplacé le problème là où plus personne ne le voit.
