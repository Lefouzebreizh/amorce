# `get_check_runs` peut rester bloqué sur « in_progress » vingt minutes après la fin

*11/09/2026 — mesuré sur la PR #894 du dépôt `amorce`.*

## Ce qui a été mesuré

| Appel | Ce qu'il rendait | Ce qui était vrai |
| --- | --- | --- |
| `pull_request_read` / `get_check_runs`, cinq fois entre 13 h 12 et 13 h 32 | « Lancer les suites Python » — `status: in_progress`, sans `conclusion` | — |
| `get_job_logs` sur ce même job | `14 suite(s) exécutée(s)`, `OK`, puis `Post job cleanup` **à 13 h 12 min 27** | le job était fini |
| `actions_get` / `get_workflow_run` sur le run | `status: completed`, `conclusion: success`, `updated_at: 13:12:29` | le run entier était vert |

Le travail a duré **deux minutes** ; la vue de la PR est restée fausse **vingt
minutes**. Cinq appels et cinq attentes ont été dépensés à surveiller un vert
déjà acquis.

## La cause, telle qu'on peut l'affirmer

Non mesurée. Ce qui est mesuré, c'est que **deux vues du même job ne s'accordent
pas** : celle qui passe par la pull request se périme, celle qui passe par le
run ne s'était pas périmée. Rien dans la première ne signale qu'elle est vieille
— pas d'horodatage de rafraîchissement, pas de `completed_at` absent qui
alerterait.

## Le geste qui tranche, corrigé par le cas suivant

La première rédaction disait « demander le run, ou lire le journal ». Éprouvée
une heure plus tard sur la PR #895, elle s'est révélée insuffisante :

- le **journal** rend `HTTP 404` tant que le job tourne — il ne distingue donc
  pas « fini » de « en cours », il n'existe qu'après ;
- le **run** ne bouge pas son `updated_at` pendant qu'un job avance : figé dix
  minutes, il ressemble à la vue périmée qu'on cherchait à éviter.

**La vue qui tranche vraiment est `actions_get` / `get_workflow_job`**, avec
l'identifiant du check. Elle rend le job **étape par étape**, avec l'heure de
début et de fin de chacune — sur #895, elle a nommé en un appel l'étape qui
retenait tout : *« Confronter les dépendances aux vulnérabilités connues »*,
en cours depuis treize minutes, les suites de tests encore en `pending`.

Aucune des trois autres vues ne dit ça. C'est la seule qui sépare « le job est
bloqué **là** » de « le job est fini et l'affichage traîne ».

Ça ne retire rien à la règle du `CLAUDE.md` — `get_status` **et**
`get_check_runs` avant toute fusion, toujours les deux. Ça ajoute seulement
que le second peut mentir par retard, là où on le croyait seulement
incomplet : la règle existante protège d'une suite **oubliée**, pas d'une
suite **affichée périmée**.

## Ce qui rend une phrase du dépôt incomplète

`CLAUDE.md`, section « Déploiements Vercel », dit que `get_status` ne rend que
les statuts de commit et que les suites GitHub Actions sont dans
`get_check_runs`. Vrai, et insuffisant : la phrase laisse croire que
`get_check_runs` est la source d'autorité sur ces suites. Elle en est la vue la
plus pratique ; la source est le run.
