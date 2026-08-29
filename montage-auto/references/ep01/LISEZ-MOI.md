# Les fichiers de build de l'épisode 01

`finir_episode.sh` lit ces trois-là dans son répertoire de travail, sous les
noms `st.ass`, `carte.ass` et `plan_auto.json`. Ils ont vécu une nuit entière
dans `/tmp`, où un conteneur repris les aurait emportés — et ce sont du
**texte** : l'invariant « aucun binaire versionné » ne les concerne pas, rien
ne justifiait qu'ils restent dehors.

| ici | attendu par la chaîne |
| --- | --- |
| `sous-titres.ass` | `st.ass` |
| `carton-fin.ass` | `carte.ass` |
| `automation.json` | `plan_auto.json` |

`automation.json` n'est pas `aznaroth-automation.json` : celui-ci porte les
micro-silences **et** les cinq couches sonores posées à la main, avec leurs
instants et leurs gains mesurés. Ses chemins de fichiers sont absolus et
pointent vers un `/tmp` disparu — **les instants et les gains valent, les
chemins sont à refaire.** C'est le contraire qui serait coûteux : un instant se
remesure en une nuit, un chemin se retape en dix secondes.

Les rushes et les bruitages, eux, ne sont pas ici et ne peuvent pas y être. Ils
ont été renvoyés au propriétaire en trois archives.
