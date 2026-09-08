# La recherche GitHub est fermée à une session, la lecture d'un dépôt public ne l'est pas

*08/09/2026 — mesuré en allant lire un projet tiers pour en étudier
l'architecture.*

## Ce qui a été mesuré

Deux appels, deux réponses opposées, et il serait facile de conclure de la
première à la seconde :

| geste | résultat |
| --- | --- |
| `api.github.com/search/repositories?q=…` | **refusé** — « This GitHub API path is not available: sessions are bound to their configured repositories » |
| `add_repo` sur un dépôt public tiers, puis `git clone --depth 1` | **réussi** — 311 fichiers, quelques secondes |

Le mandataire git de la session **sert les lectures anonymes de n'importe quel
dépôt public**, et il le dit en propres termes : la portée annoncée au démarrage
ne nomme que les dépôts *attachés*, pas ce qui est lisible.

## Le piège, et il est le même que d'habitude

Une session qui reçoit le refus de la recherche en conclut naturellement
qu'elle ne peut pas atteindre un dépôt tiers — et renonce à lire le code qu'on
lui demande d'étudier, ou pire, l'invente de mémoire.

**C'est un refus d'outil, pas une limite du monde**, exactement comme le MCP qui
refuse une fusion que `curl` réussit, ou le 403 sur une branche déjà supprimée.
La distinction pratique tient en une phrase : on ne peut pas **chercher** un
dépôt, on peut **lire** n'importe lequel dont on a le chemin.

## Ce que ça change au dialogue

Quand une demande nomme un projet sans son propriétaire — « regarde ViralMint » —
la bonne réponse n'est pas « je n'ai pas accès », c'est **« donne-moi
`proprietaire/depot` ou l'URL »**. La première ferme la tâche à tort ; la
seconde coûte une ligne au propriétaire et débloque tout.

Ce qui reste vraiment hors de portée, mesuré le même jour : les **outils d'API**
(billets, pull requests, serveur MCP GitHub) et la poussée ne couvrent pas un
dépôt non attaché, et les objets Git LFS ne sont pas servis sur cette voie —
d'où le `GIT_LFS_SKIP_SMUDGE=1` sans lequel le clone d'un dépôt qui les utilise
s'interrompt au filtre.
