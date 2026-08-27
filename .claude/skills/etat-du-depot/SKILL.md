---
name: etat-du-depot
description: Répondre « qu'y a-t-il dans ce dépôt et où en est-ce » par une mesure plutôt que par une liste écrite à la main — les chantiers **découverts** (jamais énumérés), leurs lignes, commits et tests, la dernière touche de chacun, et l'écart de la branche avec `main`. À utiliser au début d'une session, et surtout **avant d'écrire noir sur blanc un chiffre sur le dépôt** : compte rendu, résumé de reprise, fiche d'idée, mise à jour de `CLAUDE.md`. À utiliser dès qu'une demande dit « où on en est », « fais le point », « qu'est-ce qu'il y a dans ce dépôt », « combien de projets », « lequel est abandonné », « résume l'atelier ». Pour ce que la *machine* sait faire — binaires, bibliothèques, réseau — c'est `capacites-session` ; pour le retard d'une branche et ses conflits, `branche-partagee`.
---

# Ici, une liste écrite à la main est fausse le lendemain

Le décompte des projets de `CLAUDE.md` a dû être recorrigé **trois fois en une
semaine**. La ligne du hook a listé les dépendances installées avec trois projets
de retard. Aucune de ces erreurs n'a fait rougir un test : un texte périmé ne
casse rien, il désinforme simplement la session suivante.

Le script ne connaît donc pas les chantiers, il les **découvre** — tout
répertoire racine portant du code ou des commits. Un chantier apparu ce matin y
figure sans que personne l'ait déclaré, et un chantier archivé en disparaît tout
seul.

```bash
python3 .claude/skills/etat-du-depot/scripts/inventaire.py
```

Il rend la branche, la tête, l'écart avec `origin/main`, l'état de l'arbre, puis
un chantier par ligne : lignes de code, commits, fichiers de test, dernière
touche.

## Lire les colonnes ensemble

Aucune ne dit grand-chose seule ; croisées, elles racontent le dépôt.

**Beaucoup de lignes, peu de commits, dernière touche ancienne** — un projet né
d'une seule session et jamais rouvert. Ce n'est pas un défaut en soi : ce dépôt
assume des chantiers en sommeil, et `INDEX.md` leur donne une condition de
reprise. Mais un chantier dormant qui n'a *pas* de fiche est un oubli, pas une
décision.

**Beaucoup de lignes, zéro test** — ce qui cassera en premier, et sans prévenir.

**Zéro ligne mais des commits** — un volet sans code (`tiktok/`) ou un chantier
qui vient de naître.

## Le moment où il faut vraiment s'en servir

Avant d'**écrire un chiffre sur le dépôt** quelque part : compte rendu, résumé de
reprise, fiche d'idée, ou la phrase de `CLAUDE.md`. C'est exactement là que
l'inventaire d'hier se recopie sans qu'on y pense — et c'est l'erreur que ce
script existe pour rendre impossible.

Au **début d'une session** aussi : le dépôt reçoit plusieurs sessions en
parallèle, et la branche courante peut être en retard de plusieurs fusions sans
que rien ne le signale. La ligne « Écart » le dit en une seconde et renvoie vers
`branche-partagee` quand il y a du retard.

## Ce qu'il ne fait pas, et qui le fait

Il compte, il ne juge pas — et il s'arrête au dépôt.

| La question | Où elle se traite |
| --- | --- |
| Que sait faire cette machine ? binaires, bibliothèques, réseau | `capacites-session` |
| De combien ma branche est-elle en retard, et quoi faire du conflit | `branche-partagee` |
| Ce chantier mérite-t-il d'être poursuivi | `INDEX.md` et `/idee-faisabilite` |
| Les PR ouvertes, les vérifications, les revues | les outils `mcp__github__*` |

Ne pas dupliquer ces réponses ici : deux compétences qui disent la même chose se
déclenchent l'une à la place de l'autre, et la moins bonne gagne une fois sur
deux.
