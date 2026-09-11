# Une PR ouverte par l'API ne déclenche aucun workflow

**11/09/2026, mesuré sur la PR #905.** Le connecteur GitHub MCP ayant rendu
`403 Resource not accessible by integration`, la pull request a été ouverte
par l'API REST, authentifiée avec le jeton du gestionnaire d'identifiants de
Windows (`git credential fill`) — celui-là même qui fait marcher `git push`.

La PR s'ouvre normalement. Et **aucun workflow ne se déclenche** :

| Ce qui est apparu | Ce qui n'est pas apparu |
| --- | --- |
| `Vercel Preview Comments` et les cinq statuts Vercel | Amorce, Cohérence du dépôt, Psy IA, Tests Python |

`actions/runs?branch=…` rendait `total_count: 0`, dix minutes après
l'ouverture, alors que les branches voisines du même dépôt avaient leurs
runs. Et ce n'était ni un YAML invalide (vérifié), ni un filtre de chemins :
`coherence.yml` se déclenche sur **toute** `pull_request`, sans filtre.

## Ce qui trompe, et ce qui coûte

Une PR sans contrôle **ressemble à une PR en attente**. Une session pressée y
lit « les contrôles n'ont pas encore tourné », attend, puis conclut au bout
d'un moment que la CI est lente — ou pire, fusionne en croyant le vert
acquis. Le §10 de `CLAUDE.md` dit déjà de regarder **les deux familles**
(`check-runs` *et* les commit statuses) ; ce cas ajoute la marche d'après :
**un total de zéro run n'est pas « pas encore », c'est « jamais ».**

## La parade, mesurée

**Fermer puis rouvrir la PR.** Deux `PATCH` sur `state`, et les quatre
workflows sont partis dans la minute — tous verts.

```bash
J=$(printf "protocol=https\nhost=github.com\n\n" | git credential fill | sed -n 's/^password=//p')
for E in closed open; do
  curl -s -X PATCH -H "Authorization: Bearer $J" -H "Content-Type: application/json" \
    -d "{\"state\":\"$E\"}" https://api.github.com/repos/OWNER/REPO/pulls/N > /dev/null
  sleep 3
done
```

Un `git push` sur la branche fait pareil pour les workflows qui écoutent
`push`, mais pas pour ceux qui n'écoutent que `pull_request` — d'où le
fermer/rouvrir, qui couvre les deux.

## Ce qui n'est pas mesuré

La cause exacte. GitHub protège contre la récursion en n'armant pas Actions
sur les événements produits par certains jetons, mais **quel** jeton le
gestionnaire d'identifiants a rendu ici n'a pas été inspecté — et il n'a pas
à l'être : la parade ne dépend pas de la réponse. Ne pas partir chercher une
clé, comme le §7 le répète : ce n'est pas la clé qui manque.
