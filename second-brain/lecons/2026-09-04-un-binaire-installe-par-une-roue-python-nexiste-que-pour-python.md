# Un binaire installé par une roue Python n'existe que pour Python — 04/09/2026

## Ce qui a été mesuré

Sur la machine d'une session distante, deux réponses contradictoires pour le
même outil :

| question | réponse |
| --- | --- |
| `which ffmpeg` | **absent du PATH** |
| `imageio_ffmpeg.get_ffmpeg_exe()` | `…/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2` |

Les deux sont vraies. `imageio-ffmpeg` pose un vrai ffmpeg 7.0.2, complet et
exécutable, **dans son propre dossier de paquet** — jamais sur le `PATH`.

## Le piège, et il coûte une soirée à quelqu'un d'autre

Tout ce qui est écrit en Python et cherche ffmpeg par `imageio_ffmpeg` le
trouve. **Tout ce qui n'est pas écrit en Python ne le voit pas.** `yt-dlp`
regarde le `PATH` et rien d'autre : lancé sur une machine parfaitement équipée,
il rend « ffmpeg not found » et refuse la conversion.

Le symptôme est trompeur au dernier degré, parce qu'il pousse à installer un
**second** ffmpeg alors que le premier est là, à quelques centimètres. Et il ne
se voit pas chez celui qui écrit le code s'il a par ailleurs un ffmpeg système.

## La parade, en deux temps

1. **Désigner le binaire** plutôt que d'espérer qu'il soit trouvé —
   `--ffmpeg-location` pour `yt-dlp`, l'équivalent pour tout autre outil.
2. **Se replier** quand il reste introuvable, au lieu de renoncer : télécharger
   le format natif et laisser la conversion à l'étage qui, lui, sait où est le
   binaire.

Et surtout : **réutiliser la fonction qui sait déjà chercher**, jamais en
réécrire une seconde. `chat-traducteur/adaptateurs/audio.py` portait `_ffmpeg()`
— `PATH` puis roue — depuis le premier jour ; le script de téléchargement avait
été écrit sans elle. Deux façons de trouver le même binaire finissent toujours
par diverger, et c'est celle qui n'a pas la note explicative qui gagne.

## Où ça mord dans ce dépôt

Le hook de démarrage installe `imageio-ffmpeg` et rien d'autre. Tout projet qui
appelle un outil externe attendant ffmpeg est concerné : `montage-auto/`,
`bande-son/`, `chat-traducteur/`, `archives-backlog/mon-app-audio/`.

La forme générale, qui vaut au-delà de ffmpeg : **une dépendance installée par
un gestionnaire de paquets d'un langage n'est visible que depuis ce langage.**
Une roue Python, un `node_modules`, un environnement virtuel — le binaire
existe, il est juste invisible à qui ne sait pas où regarder.
