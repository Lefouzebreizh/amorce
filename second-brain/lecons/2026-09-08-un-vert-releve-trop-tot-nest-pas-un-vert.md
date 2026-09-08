# Un vert relevé trop tôt n'est pas un vert

08/09/2026 — une PR fusionnée sur un instantané de contrôles pris quelques
secondes après son ouverture.

## Ce qui s'est passé

`get_status` a rendu `total_count: 4`, quatre contextes Vercel, tous verts. La PR
a été fusionnée là-dessus. **Le contrôle qui comptait n'était pas encore
apparu** : « Ce que le dépôt dit de lui-même » a rapporté son échec après la
fusion, et il était rouge.

Le nombre de contrôles rapportés **croît** pendant les premières minutes. Un
appel qui en voit quatre ne dit pas qu'il y en a quatre : il dit qu'il y en avait
quatre à cette seconde-là. Lire un `state: success` global dans cette fenêtre,
c'est lire la moyenne de ce qui a eu le temps de répondre.

## Ce qui a rendu l'erreur facile

`CLAUDE.md` dit, à juste titre, qu'**un rouge Vercel sur une PR de documentation
n'est pas un signal**. À force de vérifier que les rouges présents étaient des
rouges Vercel, l'attention s'est déplacée sur *la nature des contrôles vus* et a
cessé de porter sur *ceux qui manquaient*. Une règle qui apprend à ignorer une
famille d'alertes doit s'accompagner de celle-ci, sans quoi elle apprend à
ignorer la liste entière.

## Le geste

Avant de fusionner, **relancer `get_status` une seconde fois** et comparer
`total_count`. S'il a bougé, la première lecture était prématurée. Et pour un
dépôt dont on connaît les contrôles, vérifier que celui qui décide est **nommé**
dans la liste plutôt que de se fier au `state` global.

Le correctif ne coûte rien de plus quand on peut reproduire le contrôle en
local : ici `python3 .claude/skills/coherence-depot/scripts/verifier-coherence.py`
rend le même verdict en une seconde, sans attendre GitHub.

## Ce que l'échec disait, et qui n'était pas de cette PR

Un projet `moteur-administratif` avait été fusionné sans être déclaré dans
`CLAUDE.md` — le geste que `CLAUDE.md` §9 nomme précisément comme celui qu'on
oublie. Le vérificateur a ensuite attrapé la conséquence de sa propre
correction : `INDEX.md` annonçait « vingt et un chantiers actifs » pour vingt-deux
lignes. **Un compte écrit en toutes lettres à côté d'un tableau se périme à
chaque ligne ajoutée**, et c'est le genre d'écart que personne ne relit.
