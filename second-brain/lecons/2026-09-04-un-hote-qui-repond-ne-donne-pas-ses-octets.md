# Un hôte qui répond ne donne pas ses octets

*04/09/2026 — mesuré en cherchant un miaulement pour `chat-traducteur/`.*

## Ce qui a été mesuré

`CLAUDE.md` §7 disait, depuis le 29/08 : « `youtu.be` et `youtube.com` sont
refusés — `EGRESS_BLOCKED` ». Sondé de nouveau :

| hôte | 29/08 | 04/09 |
| --- | --- | --- |
| `www.youtube.com` | refusé | **200** |
| `googlevideo.com` | non sondé | **répond** |
| `youtu.be` | refusé | refusé |
| `i.ytimg.com` | non sondé | refusé |

Le mur a bougé, et personne ne l'aurait su : rien ne signale qu'une mesure a
vieilli. Une session lit la phrase, la croit, et ne sonde pas.

Mais l'ouverture ne donne pas ce qu'on venait chercher. Cinq chemins vers les
octets d'un média, `yt-dlp 2026.08.19` installé depuis PyPI :

| chemin | résultat |
| --- | --- |
| métadonnées, liste des formats | **passent** |
| flux DASH `140` | `403 Forbidden` |
| clients `tv`, `web_safari`, `ios` | *« Sign in to confirm you're not a bot »* |
| flux HLS `233` | `403` sur chaque fragment |
| URL média, redirection suivie | `403`, zéro octet |
| `file-upload.com` (sixième chemin, hors CDN YouTube) | `000` |

## Le piège, avec sa cause

**Un `403` et un `000` ne disent pas la même chose, et on les confond.** Le
`000` est un tunnel refusé par le mandataire : aucune requête HTTP n'existe,
seul le propriétaire peut l'ouvrir. Le `403` est une **vraie réponse** — la
plateforme a vu la requête et l'a refusée, ici parce qu'une adresse de centre de
données sans cookies de session ne lui plaît pas.

Les deux parades sont opposées, et se tromper coûte la journée : sur un `000` on
ouvre un domaine, sur ce `403`-ci **aucune clé et aucune ouverture ne servent à
rien**. Le message le disait en toutes lettres — encore fallait-il lire l'erreur
plutôt que le code.

C'est le même partage que le CDN de higgsfield, une troisième fois : **le
connecteur travaille, les fichiers qu'il désigne ne suivent pas.** Ce qui est
neuf ici, c'est que la moitié qui bute a une cause *distante*, pas locale.

## Ce qui rend une phrase du dépôt fausse

Deux, et la seconde était la plus chère.

1. « `youtube.com` est refusé » : faux, il rend 200.
2. « Même joignable, une page YouTube ne donne qu'un titre, et regarder une
   vidéo n'est de toute façon pas possible. » **Faux aussi** : le connecteur
   TubeAlfred rend la **transcription entière** pour 1 crédit sur 100. Un
   référentiel de vulgarisation a pu être confronté à sa source mot à mot,
   là où le dépôt le donnait pour invérifiable.

La seconde est du type le plus coûteux qu'on connaisse ici : **une conséquence
fausse accrochée à une mesure juste**. La mesure des hôtes était bonne le 29/08 ;
« donc on ne peut rien tirer d'une vidéo » n'en découlait pas, et se relisait
pourtant comme si elle avait été mesurée elle aussi. Même forme que « les quatre
chemins d'image sont fermés, donc une session ne peut pas fabriquer
d'illustration » — corrigée le 31/08, et refaite ici huit jours plus tard.

**Le geste qui l'évite** : quand une impossibilité est écrite, séparer par écrit
ce qui a été *sondé* de ce qu'on en a *déduit*. La première moitié se re-sonde en
une commande ; la seconde ne se re-sonde jamais, parce que personne ne la voit
comme une hypothèse.
