# Une étape « ignorée » se résout depuis le dossier racine du projet

05/09/2026 — mesuré sur un déploiement Vercel rouge en permanence.

## Le symptôme

Un quatrième projet Vercel apparaît sur le dépôt — `chat-traducteur`, dossier
racine `chat-traducteur/web` — et il **échoue sur toutes les pull requests**, y
compris celles qui ne touchent que du Markdown dans un autre dossier.

L'hypothèse évidente était celle que `CLAUDE.md` §10 décrit déjà : un projet
créé depuis le tableau de bord n'a pas de `vercel.json`, donc aucun filtre de
chemins, donc il se déclenche sur tout. Elle est fausse ici, et le journal le
dit en une ligne :

```
bash: scripts/vercel-ignorer.sh: No such file or directory
```

## La cause

**Le filtre existe, et c'est lui qui casse.** L'étape ignorée du projet pointe
sur `scripts/vercel-ignorer.sh` — le chemin valable pour le projet `amorce`,
dont le dossier racine est la racine du dépôt. Vercel exécute cette commande
**depuis le dossier racine du projet**, ici `chat-traducteur/web`, où ce chemin
n'existe pas. Le script ne tourne donc jamais, la commande sort en erreur, et
Vercel compte ça comme un échec de construction plutôt que comme un « ignoré ».

Autrement dit : une commande d'étape ignorée n'est pas une propriété du dépôt,
c'est une propriété du **projet**, et elle ne se transporte pas d'un projet à
l'autre quand leurs dossiers racines diffèrent. Recopier celle qui marche est
exactement ce qui la casse.

## Ce que ça change pour le diagnostic

Un rouge Vercel permanent sur des PR de documentation a désormais **deux**
causes possibles, et elles ne se corrigent pas au même endroit :

| ce qu'on voit | cause | où se corrige |
| --- | --- | --- |
| « Ignored » vert partout, rouge seulement quand le quota est crevé | trop de projets liés | supprimer un projet |
| **rouge à chaque commit, journal `No such file or directory`** | **étape ignorée pointant hors du dossier racine** | `vercel.json` dans le dossier racine du projet, ou le réglage côté tableau de bord |

Et la règle du dépôt tient une fois de plus : **aller au journal avant de bâtir
une hypothèse.** Trois observations de statut disaient « échec » sans jamais
dire par quoi ; une lecture du journal, une seule ligne, a écarté la cause qui
paraissait certaine.
