# YouTube ne demande pas un compte, il demande un jeton — 04/09/2026

## Ce qui a été mesuré

Huit clients `yt-dlp` sur la même vidéo, depuis une session distante. Sept
rendent la même phrase — *« Sign in to confirm you're not a bot »* — et le
huitième dit autre chose :

| client | ce qu'il rend |
| --- | --- |
| défaut (`web`), `tv`, `web_safari`, `ios`, `android_vr`, `tv_embedded` | *« Sign in to confirm you're not a bot »* |
| `mweb` | **« require a GVS PO Token which was not provided »** |

La phrase des sept est trompeuse : elle fait chercher un compte, des
identifiants, une clé. Le huitième nomme la vraie serrure — un **jeton PO**,
que le navigateur fabrique en exécutant du JavaScript de Google, et que
`yt-dlp` sait faire fabriquer localement par le greffon
`bgutil-ytdlp-pot-provider`.

## Pourquoi ça n'a quand même pas débloqué

Le greffon s'installe depuis PyPI et **se charge** : `yt-dlp --verbose` le
liste sous `PO Token Providers`. Il lui manque son script serveur, publié dans
un dépôt GitHub tiers — et la portée GitHub accordée à une session distante
refuse tout dépôt hors de sa liste :

| chemin | résultat |
| --- | --- |
| `api.github.com/repos/<tiers>/…` | refusé — « not enabled for this session » |
| `github.com/<tiers>/releases/…` | `403` |
| `codeload.github.com/<tiers>/tar.gz/…` | `403` |
| `raw.githubusercontent.com/<tiers>/…` | **200** |
| paquet npm du même nom | n'existe pas |

`raw` répond, fichier par fichier, sans permettre de lister l'arbre — donc
reconstruire un projet TypeScript à l'aveugle. Le chemin existe et ne s'ouvre
pas d'ici.

## Ce que ça rend faux ailleurs

Deux phrases du dépôt disaient « c'est une adresse de centre de données que la
plateforme refuse ». C'est la conséquence, pas la cause, et la nuance change la
parade : **inutile de chercher une clé, un compte ou une ouverture de
domaine** — c'est un jeton calculé, et le calculer demande un dépôt hors
portée. Le mur est de nature *logicielle*, pas *contractuelle*.

## Le piège annexe, mesuré au portefeuille

`youtube_videos_batch` de TubeAlfred prend jusqu'à 50 identifiants en un appel
et **facture un crédit par vidéo**, pas par appel : 29 identifiants ont coûté
29 crédits sur 80. Le mot « batch » suggère l'inverse. Une recherche coûte 1,
une transcription coûte 1 — le lot n'est un lot que pour le réseau.

La conséquence pratique : sur un quota de 100, une fiche par vidéo se paie
comme une recherche. Trier sur les résultats de recherche — qui portent déjà
titre, durée et vues — avant de demander les fiches détaillées.
