# Feuilleton — EP01 · Le réveil d'Azeroth

Le titre et les sous-titres du premier épisode, avec leurs instants.

Ce fichier existe parce que le montage a déjà été perdu une fois : le conteneur
d'une session distante est effacé, et tout ce qui n'a pas été écrit dans le
dépôt part avec lui. Il avait fallu redemander à l'auteur le nom du dragon et
le texte de la voix off. Une fois suffit.

Il n'est pas dans `scripts/` et n'entre donc pas dans le carnet : ce n'est pas
un script à tourner mais un montage déjà fait, et on n'a pas besoin d'une
grille de sous-titres en tenant une caméra.

## Les trois noms, qui ne se contredisent pas

Une session précédente a buté là-dessus — les fichiers disaient « titan » d'un
côté et « Rift Zero-Five » de l'autre. Ce n'était pas une contradiction :

| Nom | Ce qu'il désigne |
| --- | --- |
| **Rift Zero-Five** | la faille — c'est elle qui porte un numéro, et donc elle qui fait série |
| **Azeroth** | le dragon |
| **shadow titan** | ce que la voix off appelle le dragon, pas un troisième personnage |

**Réserve sur « Azeroth ».** C'est le nom du monde de Warcraft chez Blizzard, et
dans leur écriture récente Azeroth *est* un titan endormi qui s'éveille — soit
mot pour mot la phrase de la voix off. Le risque n'est pas juridique avant
longtemps, il est d'être introuvable : une recherche sur ce nom ne rend que du
WoW. L'auteur a tranché en connaissance de cause. Trois replis gardent la
sonorité si l'envie revient : **Zeroth** (qui répond à Zero-Five), **Nazeroth**,
**Vhal-Zeroth**.

## La voix off, mesurée

Le fichier (`ElevenLabs_titan_1_m2.mp3`) dure **5,62 s** : c'est la voix seule,
pas le montage. Trois passages, séparés par deux respirations de 0,22 s et
0,24 s, relevés à l'enveloppe du signal :

| Passage | Début | Fin | Durée |
| --- | --- | --- | --- |
| 1 | 0,04 s | 0,62 s | 0,58 s |
| 2 | 0,84 s | 2,90 s | 2,06 s |
| 3 | 3,14 s | 5,44 s | 2,30 s |

**Le découpage du texte se déduit de ces durées**, faute d'avoir pu transcrire
mot à mot — `huggingface.co` est refusé par la politique de sortie des sessions
distantes, donc aucun modèle Whisper ne s'y télécharge. La phrase fait
15 syllabes pour 4,94 s de parole, soit 3,04 syllabes par seconde ; à ce débit
les trois passages en attendent 1,8 / 6,3 / 7,0, et un seul découpage referme
le compte :

> **Rift.** — **Zero-Five, breach open.** — **The shadow titan awakens.**

Ce n'est donc pas « Rift Zero-Five / Breach open / The shadow titan awakens »,
comme la lecture du texte brut le suggérait. Le premier passage ne dure que
0,58 s : il ne porte qu'un mot.

## Où la voix se pose

Une seule valeur commande tout : **la voix démarre à 4,36 s** du montage.

Elle vient de ce qu'on veut que « The shadow titan awakens » tombe sur
l'apparition du dragon, à 7,50 s. Le passage 3 commençant à 3,14 s dans le
fichier, le décalage vaut 7,50 − 3,14 = 4,36 s. Ce n'est pas un réglage à
l'oreille, c'est une soustraction.

Et cette seule contrainte place les deux autres passages sur les images qui
les disent — ce qui n'était pas cherché, et qui est la raison de la retenir :

| Passage | Dans le montage | Ce qui se passe à l'image |
| --- | --- | --- |
| « Rift » | 4,40 → 4,98 s | la Terre se fissure (4,54 s) |
| « Zero-Five, breach open » | 5,20 → 7,26 s | le sceau runique claque (5,50 s), la faille s'ouvre (6,30 s) |
| « The shadow titan awakens » | 7,50 → 9,80 s | la coupe sur le dragon (7,50 s) |

La voix occupe donc 4,36 → 9,98 s. Avant, l'installation ; après, le dragon qui
avance, qui inspire et qui rugit — sans un mot. C'est le montage qui paie ce que
la voix a annoncé.

## Le titre

**Faille Zéro-Cinq** — sous-titre d'épisode : **EP01 · Le réveil d'Azeroth**

C'est le titre qui passe le test de `concepts.md` : la faille porte un numéro,
donc l'EP02 s'écrit tout seul. « Le titan d'ombre » nomme la créature et
s'arrête là ; « Azeroth s'éveille » met en vitrine le nom dont on vient de dire
qu'il enterre la série.

## Les sous-titres

Calés sur la voix, pas sur les coupes.

| Texte | Entrée | Sortie |
| --- | --- | --- |
| `RIFT` | 4,40 s | 5,15 s |
| `ZERO-FIVE — BREACH OPEN` | 5,20 s | 7,45 s |
| `THE SHADOW TITAN AWAKENS` | 7,70 s | 10,10 s |
| `FAILLE ZÉRO-CINQ` / `EP01 · LE RÉVEIL D'AZEROTH` | 13,20 s | 15,10 s |

Quatre décisions :

- **La révélation garde sa première image.** La carte 3 entre à 7,70 s, soit
  0,20 s après la coupe du dragon et après le début du mot qu'elle porte. Les
  deux lectures se défendaient : suivre la voix à 7,50 s parce que sans le son
  le sous-titre *est* la voix, ou rendre au dragon l'image de son apparition.
  C'est la seconde qui est retenue — décision de l'auteur, sur le seul point du
  montage où le texte pouvait coûter quelque chose. Le retard se paie peu : une
  ligne qui suit la parole se lit normalement, une ligne qui la devance non.
- **Chaque carte tient un peu après le dernier mot** (0,17 à 0,30 s) : une ligne
  qui disparaît sur la syllabe finale se lit comme une coupure.
- **La carte 2 n'est pas scindée.** « Zero-Five » et « breach open » se
  sépareraient vers 6,2 s, ce qui tomberait bien sur l'ouverture de la faille
  (6,30 s) — mais cet instant est estimé au débit moyen, pas mesuré. Deux cartes
  posées sur une estimation valent moins qu'une carte posée sur une mesure.
- **Rien entre 10,1 et 13,2 s.** Le dragon avance (pas à 9,58 et 11,08) et
  inspire à 12,30. C'est ce vide qui fait exister la carte de titre.

Capitales sur les trois premières : c'est le style du genre, et ça se lit à un
mètre. Rien sous les 15 % du bas ni contre le bord droit — TikTok y pose sa
légende et sa colonne de boutons.

## Ce qui reste à vérifier

Deux choses, et une seule compte vraiment.

**L'instant exact où « breach » commence** dans le deuxième passage. Il est
estimé au débit moyen (≈ 6,2 s), pas mesuré. Le jour où une transcription mot à
mot est possible — sur un poste où `huggingface.co` n'est pas bloqué, ou avec un
modèle déjà en cache — elle donne la valeur et permet de scinder la carte 2.

**Le reste est mesuré**, et n'a plus à être redemandé : les trois passages
viennent de l'enveloppe du fichier, le décalage de 4,36 s d'une soustraction, et
les instants d'image du plan sonore
`.claude/skills/bande-son/references/plan-exemple.json`.

Le fichier de voix lui-même n'est pas versionné — le dépôt ne porte aucun
binaire. S'il se perd, c'est ce tableau-ci qui le remplace.
