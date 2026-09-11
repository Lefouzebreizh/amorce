# `Monitor` ne bloque pas, et une session qui le croit invente du temps écoulé

*11/09/2026 — mesuré sur les PR #894 et #895 du dépôt `amorce`, en corrigeant
une leçon fausse que la même session venait d'écrire.*

## Ce qui s'est passé

Une session voulait attendre la fin d'une suite d'intégration continue. Elle a
appelé `Monitor` avec `sleep 45`, puis `sleep 90`, `120`, `180`, `240`, `280`,
en interrogeant GitHub entre chaque. Elle a compté **plus de vingt minutes**
d'attente, vu que `get_check_runs` rendait toujours `in_progress`, et en a
conclu que cette vue se périmait sans le dire. Elle a écrit la leçon, ouvert une
PR, et l'a poussée.

Puis elle a demandé l'heure au conteneur : **13 h 15 min 38**. Le premier
commit datait de 13 h 10 min 19. **Cinq minutes s'étaient écoulées, pas vingt.**

## La cause, et elle est écrite dans l'outil

`Monitor` **lance la commande en tâche de fond** et rend la main
immédiatement — son propre message le dit en toutes lettres : *« Keep working —
do not poll or sleep. »* Un `sleep 240` posé là ne fait donc attendre personne :
il tourne à côté pendant que la session enchaîne l'appel suivant dans la
seconde.

Six appels de `Monitor` totalisant **1 115 secondes annoncées** ont produit
**zéro seconde** d'attente réelle.

## Pourquoi ça ne se voit pas

Rien ne ment. `Monitor` répond, l'appel suivant répond, la suite est vraiment
`in_progress` — chaque mesure est juste. Ce qui est faux est l'**intervalle
supposé entre elles**, et c'est la seule grandeur que la session n'a pas
mesurée. Un enchaînement de dix appels ressemble à dix minutes, parce que c'est
ce qu'il coûterait à un humain.

La leçon fausse qui en est sortie était pire qu'inutile : elle accusait une vue
GitHub de se périmer, ce qui aurait fait contourner un outil qui fonctionne.

## Le geste, et il tient en une commande

**Pour dater une observation, demander l'heure — jamais la déduire du nombre
d'appels passés.**

```bash
date -u +"%Y-%m-%dT%H:%M:%SZ"
```

Et pour attendre pour de vrai, un `sleep` **au premier plan** dans `Bash`, ou
un `Monitor` dont on lit la notification de fin avant de conclure quoi que ce
soit.

## Ce qui reste vrai de l'observation d'origine

Une seule chose, et elle est petite : sur la PR #894,
`pull_request_read` / `get_check_runs` rendait encore `in_progress` quand
`actions_get` / `get_workflow_run` rendait déjà `completed / success`. L'écart
est de l'ordre de la minute, pas de la vingtaine — un décalage ordinaire entre
deux vues, pas un défaut.

Ce qui vaut d'être retenu de ce côté-là est l'outil, pas le retard :
**`actions_get` / `get_workflow_job` rend le job étape par étape**, avec l'heure
de début de chacune. C'est la seule vue qui dise *où* un job en est — ici,
l'étape `Confronter les dépendances aux vulnérabilités connues`, les suites de
tests encore en `pending` derrière elle. Ni le check, ni le run, ni le journal
(qui rend `404` tant que le job tourne) ne donnent ça.

## Ce que ça dit du `CLAUDE.md` §1 bis, écrit le même jour

La section posée quelques minutes plus tôt dit qu'un résultat ne se présente
jamais comme mesuré sans que la mesure ait eu lieu. Elle a été enfreinte dans
l'heure, par la session qui l'écrivait, sur un nombre — « vingt minutes » — que
personne n'avait relevé. **Une durée ressentie est une impression, pas une
mesure**, et le §3 le demande déjà en propres termes : le nombre, pas
l'impression.
