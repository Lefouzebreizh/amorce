# `get_status` ne montre jamais les contrôles qui comptent

08/09/2026 — une PR fusionnée sur un « tout est vert » qui ne regardait pas les
contrôles décisifs. Ils n'y figurent pas, et ils n'y figureront jamais.

## Le fait

GitHub a **deux** canaux distincts, et l'outil n'en lit qu'un :

| canal | qui y écrit ici | visible dans `get_status` |
| --- | --- | --- |
| *commit statuses* | Vercel, un contexte par projet | **oui** |
| *check runs* | GitHub Actions | **non, jamais** |

Mesuré sur la PR #802 : `get_status` rend `state: "success"`, `total_count: 5`,
cinq contextes Vercel tous verts — **au même instant** où « Cohérence du dépôt »
était terminé et « Tests Python » encore en cours, aucun des deux n'apparaissant
dans la réponse.

Sur la PR précédente, la même lecture avait conclu au vert. « Cohérence du
dépôt » a rapporté son échec après la fusion, et « Tests Python » était rouge
aussi. **Deux rouges invisibles derrière un `state: "success"`.**

Ce n'était donc pas un instantané pris trop tôt — c'était le mauvais canal. Une
seconde lecture, plus tard, aurait rendu exactement la même chose.

## Ce qui a rendu le piège difficile à voir

`CLAUDE.md` dit, à juste titre, qu'**un rouge Vercel sur une PR de documentation
n'est pas un signal**. Cette règle apprend à trier les contrôles *présents* dans
la liste — et par là même, elle apprend à traiter la liste comme complète. Une
règle qui enseigne à ignorer une famille d'alertes doit dire dans la même phrase
ce qu'elle ne couvre pas, sinon elle enseigne à ignorer l'absence.

## Le geste

Avant de fusionner, lire les **check runs**, pas seulement les statuts :

```
actions_list  method=list_workflow_runs  workflow_runs_filter={"branch": "<branche>"}
```

Les deux qui décident dans ce dépôt s'appellent **« Cohérence du dépôt »**
(`.github/workflows/coherence.yml`) et **« Tests Python »**
(`.github/workflows/tests-python.yml`). Si l'un des deux n'est pas nommé dans ce
qu'on vient de lire, on n'a pas lu son état.

Et les deux se rejouent **en local en quelques secondes**, ce qui coûte moins
qu'un aller-retour avec GitHub :

```bash
python3 .claude/skills/coherence-depot/scripts/verifier-coherence.py
bash .claude/skills/verifier/scripts/verifier.sh
```
