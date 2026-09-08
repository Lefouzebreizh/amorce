# La surface de MiniMax se lit sans joindre MiniMax

08/09/2026 — après que le fournisseur a été tranché (MiniMax, unique, plafond
20 $/mois) et que les cinq hôtes de l'éditeur ont été mesurés injoignables
depuis une session distante.

## Le problème, et pourquoi il n'en est pas un

`api.minimax.chat`, `api.minimaxi.chat`, `api.minimax.io`,
`platform.minimaxi.com`, `www.minimax.io` : **`000` sur les cinq**, tunnel refusé
avant toute requête. La documentation en ligne est donc illisible d'ici, et
`/api-tierce-verifiee` interdit d'écrire une intégration de mémoire.

**PyPI est joignable**, et MiniMax y publie son propre serveur MCP :
`minimax-mcp`, dont le code appelle l'API réelle. Une roue téléchargée sans
l'installer (`pip download --no-deps`) rend la surface exacte en trente
secondes — routes, en-têtes, noms de modèles, paramètres, statuts, valeurs par
défaut. C'est la parade du §7 appliquée à une **documentation** plutôt qu'à un
modèle : quand l'éditeur est injoignable, son paquet ne l'est pas.

**Écarter l'homonyme avant de lire.** `minimax` sur PyPI est « a configurable
minimax package » — l'algorithme des jeux à deux joueurs, sans aucun rapport.
`minimax-client` et `minimax-python` s'annoncent tous deux **non officiels**.
Seul `minimax-mcp` est publié par l'éditeur. Même piège que le paquet npm
`composio`, déjà écrit dans `CLAUDE.md` §7.

## La surface, relevée dans `minimax-mcp 0.0.19`

Authentification : `Authorization: Bearer <clé>`, plus un en-tête
`MM-API-Source`. L'hôte n'est pas codé en dur — il vient de la variable
d'environnement `MINIMAX_API_HOST`, et la clé de `MINIMAX_API_KEY`.

| ce qu'on veut | route |
| --- | --- |
| lancer une vidéo | `POST /v1/video_generation` → rend un `task_id` |
| suivre la tâche | `GET /v1/query/video_generation?task_id=…` |
| récupérer le fichier | `GET /v1/files/retrieve?file_id=…` → `file.download_url` |
| une image | `POST /v1/image_generation` |
| une voix | `POST /v1/t2a_v2` |

**La vidéo est asynchrone en trois temps**, et c'est ce qui décide de la forme
du code : on soumet, on sonde, on va chercher le fichier. Le statut ne vaut que
`Success` ou `Fail` ; **tout le reste signifie « encore en cours »**, et il ne
faut donc pas écrire une énumération fermée des états intermédiaires. Le client
officiel sonde toutes les **20 secondes**, trente fois — dix minutes —, et
**soixante fois pour `MiniMax-Hailuo-02`**, qui est plus lent. Un plan de dix
secondes n'est donc pas une requête qui répond : c'est une tâche qui dure des
minutes, ce qu'une interface doit montrer.

Modèles par défaut : **`MiniMax-Hailuo-2.3`** en vidéo, **`image-01`** en image.
Paramètres acceptés en vidéo : `prompt`, `first_frame_image` (URL, `data:` ou
fichier local encodé en base64 par l'appelant), `duration`, `resolution`. En
image : `aspect_ratio` (`"1:1"` par défaut), `n`, `prompt_optimizer`.

**`aspect_ratio` est exposé directement**, sans passer par un nœud de flux —
c'est l'inverse du connecteur ElevenLabs, où le 9:16 est inatteignable depuis une
session distante (`CLAUDE.md` §7). Une série verticale peut donc demander son
cadrage dans l'appel lui-même. Non vérifié : que le 9:16 sorte réellement, ce
qui demande une clé.

## Ce que le brief V3 disait, et qui est faux

Il annonçait `POST /v1/videos/generations` puis `GET /v1/tasks/{task_id}`. Ces
deux routes sont **celles de Kling**, sondées le matin même — et elles
n'existent pas chez MiniMax, qui nomme les siennes autrement et ajoute une
troisième étape (`/v1/files/retrieve`) que le brief ne mentionne pas du tout.

Une intégration écrite sur le brief aurait donc rendu 404 sur les deux appels et
oublié l'étape qui livre le fichier. C'est la raison d'être de la règle : **un
brief décrit une intention, jamais une API** — et l'écart ne se voit qu'en
lisant la surface réelle, pas en relisant le brief.
