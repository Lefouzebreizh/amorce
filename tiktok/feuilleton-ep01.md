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

## La génération, mesurée

Le 27 août, le fichier de génération a été redéposé
(`Cyberpunk_Druid_and_Titan_Portal.mp4`, **15,04 s**, 480 × 854, 24 i/s). Ce
qui suit est relevé dessus, image par image — plus rien ici ne vient d'ailleurs.

**Ce n'est pas un montage : c'est un seul plan continu.** Aucune coupe franche
de bout en bout. L'œil devient le sorcier par **fondu enchaîné**, et le dragon
paraît par un **iris rapide**, pas par une coupe. Les seules vraies ruptures
d'image du fichier sont à 7,125 s et 10,42 s ; tout le reste est du mouvement.

| Instant | Ce qui se passe |
| --- | --- |
| 0,00 → 1,33 s | l'œil, iris cosmique |
| 1,33 → 1,71 s | fondu enchaîné vers le sorcier |
| 1,71 → 4,37 s | le sorcier, runes vertes, orbe de lave |
| **4,37 s** | le regard s'embrase |
| 4,50 s | le premier éclair |
| **5,00 s** | le sceau runique commence à se former |
| ~6,5 s | le sceau s'étire en colonne |
| **7,125 s** | la déflagration — la faille s'ouvre |
| 7,2 → 10,0 s | le vortex |
| **10,00 s** | une première silhouette au centre du vortex |
| **10,29 s** | le dragon devient lisible, ailes déployées |
| 10,29 → 10,50 s | l'iris s'ouvre sur la falaise |
| 10,50 → 13,7 s | le dragon sur la falaise |
| **14,13 → 14,88 s** | la corne s'embrase et se dresse |
| 15,04 s | fin |

**Ce que ça a démenti.** Les instants qui figuraient ici venaient du plan sonore
`.claude/skills/bande-son/references/plan-exemple.json`, dont l'en-tête affirme
qu'ils sortent « des coupes réelles du montage ». Le fichier dit autre chose, et
sur le seul chiffre dont tout dépendait il dit autre chose de trois secondes :

| Ce qui était écrit | Ce qui est mesuré | Écart |
| --- | --- | --- |
| le regard s'embrase 3,40 s | 4,37 s | +0,97 |
| la Terre se fissure 4,54 s | *rien de tel* — un éclair à 4,50 s | — |
| le sceau claque 5,50 s | 5,00 s (formation) | −0,50 |
| la faille s'ouvre 6,30 s | **7,125 s** | +0,83 |
| coupe sur le dragon 7,50 s | **10,29 s** | **+2,79** |
| le rugissement 13,18 s | la corne s'embrase 14,13 s | +0,95 |

Deux lectures restaient possibles — ce fichier est une autre génération du même
prompt, ou les instants écrits n'ont jamais été relevés sur un fichier. C'est la
seconde qui est retenue, et **pas par élimination** : replacée sur les instants
mesurés, la voix retombe sur les images qui la disent, ce que l'ancien calage ne
faisait pas. Un chiffre faux ne produit pas cet alignement-là par accident.

Reste une conséquence à traiter ailleurs : `plan-exemple.json` continue
d'affirmer que ses instants viennent d'un montage réel. Il enseigne la bonne
méthode avec les mauvais nombres, et c'est à son dossier de le corriger, pas à
celui-ci.

## Où la voix se pose

Une seule valeur commande tout : **la voix démarre à 7,15 s** du montage.

Elle vient de ce qu'on veut que « The shadow titan awakens » tombe sur
l'apparition du dragon, à **10,29 s**. Le passage 3 commençant à 3,14 s dans le
fichier de voix, le décalage vaut 10,29 − 3,14 = 7,15 s. Ce n'est pas un réglage
à l'oreille, c'est une soustraction.

**L'ancre est 10,29 s et non 10,42 s**, alors que la plus forte rupture d'image
est à 10,42. À 10,00 le dragon n'est qu'une tache sombre ; à 10,29 il a des
ailes. La phrase nomme un titan, elle se pose sur la première image où c'en est
un — pas sur celle où le vortex achève de disparaître.

Et cette seule contrainte place les deux autres passages sur les images qui les
disent — ce qui n'était pas cherché, et qui est la raison de la retenir :

| Passage | Dans le montage | Ce qui se passe à l'image |
| --- | --- | --- |
| « Rift » | 7,19 → 7,77 s | la déflagration s'allume à 7,125 s : le mot tombe dessus |
| « Zero-Five, breach open » | 7,99 → 10,05 s | le vortex, et à 10,00 s la première silhouette — « open » se referme au moment où quelque chose passe |
| « The shadow titan awakens » | 10,29 → 12,59 s | le dragon lisible, puis la falaise |

La voix occupe donc 7,19 → 12,77 s. Avant, toute l'installation — l'œil, le
sorcier, le sceau. Après, 1,4 s de silence, puis la corne qui s'embrase sans un
mot. C'est le montage qui paie ce que la voix a annoncé.

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
| `RIFT` | 7,19 s | 7,94 s |
| `ZERO-FIVE — BREACH OPEN` | 7,99 s | 10,24 s |
| `THE SHADOW TITAN AWAKENS` | 10,49 s | 12,89 s |
| `FAILLE ZÉRO-CINQ` / `EP01 · LE RÉVEIL D'AZEROTH` | 15,30 s | 17,20 s |

Quatre décisions :

- **La révélation garde sa première image.** La carte 3 entre à 10,49 s, soit
  0,20 s après l'apparition du dragon et après le début du mot qu'elle porte.
  Les deux lectures se défendaient : suivre la voix à 10,29 s parce que sans le
  son le sous-titre *est* la voix, ou rendre au dragon l'image de son
  apparition. C'est la seconde qui est retenue — décision de l'auteur, sur le
  seul point du montage où le texte pouvait coûter quelque chose. Le retard se
  paie peu : une ligne qui suit la parole se lit normalement, une ligne qui la
  devance non.
- **Chaque carte tient un peu après le dernier mot** (0,17 à 0,30 s) : une ligne
  qui disparaît sur la syllabe finale se lit comme une coupure.
- **La carte 2 n'est pas scindée.** « Zero-Five » et « breach open » se
  sépareraient vers 9,0 s, ce qui tomberait bien au cœur du vortex — mais cet
  instant est estimé au débit moyen, pas mesuré. Deux cartes posées sur une
  estimation valent moins qu'une carte posée sur une mesure.
- **Le montage doit passer à 17,2 s**, et c'est la voix retimée qui l'impose.
  L'ancien calage laissait 3,1 s de vide avant la carte de titre, et c'est ce
  vide qui la faisait exister. La voix finissant maintenant à 12,77 s, il ne
  reste que 1,4 s avant que la corne s'embrase (14,13 s), et la génération
  s'arrête à 15,04 s : la carte n'a plus de place. **Tenir la dernière image
  jusqu'à 17,2 s** rend au rugissement son climax et au titre son silence.
  À défaut, le repli est de poser la carte à 13,20 → 15,04 s : elle entre dans
  le silence et se trouve déjà là quand la corne s'allume — mais elle occupe le
  climax, ce qui est précisément ce qu'on cherchait à éviter.

Capitales sur les trois premières : c'est le style du genre, et ça se lit à un
mètre. Rien sous les 15 % du bas ni contre le bord droit — TikTok y pose sa
légende et sa colonne de boutons.

## Ce qui reste à vérifier

Deux choses, et elles tiennent au même fichier manquant.

**L'instant exact où « breach » commence** dans le deuxième passage. Il est
estimé au débit moyen (≈ 9,0 s dans le montage), pas mesuré. Ce n'est plus un
blocage technique : `scripts/asr_hors_ligne.py --instants` date chaque mot hors
ligne, sans Hugging Face, et le fait déjà sur la narration du générateur.
Il ne manque que la prise ElevenLabs elle-même, que le dépôt ne porte pas —
un dépôt du fichier, et la carte 2 se scinde dans la minute.

**La génération porte une narration, et ce n'est pas la tienne.** Une première
lecture de ce fichier a conclu qu'il ne contenait aucune parole : l'énergie dans
la bande 800–3500 Hz n'y faisait pas de structure nette, et un éclair à 4,5 s y
montait à 38 % comme l'aurait fait une syllabe. **Cette conclusion était
fausse.** Lancée pour de bon, la reconnaissance sort une phrase, et deux modèles
indépendants s'accordent sur les mots :

> *« Rift 0-5 is breached. The shadow titan takes flight. »*

| Mot | Instant |
| --- | --- |
| `RIFT` | 0,04 s |
| `ZERO` · `FIVE` | 2,28 · 2,84 s |
| `IS` · `BREACH'D` | 3,28 · **3,48 s** |
| `THE` · `SHADOW` · `TITAN` | 4,08 · 4,32 · 4,80 s |
| `TAKES` · `FLIGHT` | 5,40 · 5,80 s |

**Ce n'est pas le texte du dépôt** — qui dit *« Zero-Five, breach open »* et
*« the shadow titan awakens »*. Deux mots sur trois diffèrent aux endroits qui
comptent. La lecture la plus simple est que le générateur a écrit et dit sa
propre narration, et que la prise ElevenLabs la remplace. Elle n'est pas
vérifiée, et une seule personne peut la trancher.

**Ce que ça change, et ce que ça ne change pas.** Rien de la pose calculée
ci-dessus : elle place la prise ElevenLabs sur les images, et cette narration-ci
n'est pas elle. Mais deux choses méritent d'être sues avant de monter — la
narration du générateur occupe 0,04 → 5,80 s et devra être **coupée ou baissée**
sous la voix off, faute de quoi deux textes parleront en même temps ; et si la
prise ElevenLabs se révélait être cette narration extraite, alors ses trois
passages écrits plus haut (0,84–2,90 et 3,14–5,44) ne collent pas aux mots
mesurés, et c'est ce tableau-là qu'il faudrait reprendre.

**La leçon, plus utile que le résultat.** Une courbe d'énergie ne dit pas s'il y
a une voix : un choc l'occupe comme une syllabe, et une voix mixée bas s'y
cache. Devant le doute, on transcrit au lieu de raisonner sur des courbes —
`scripts/asr_hors_ligne.py` le fait hors ligne, sans Hugging Face, et c'est ce
qui a tranché ici.

**Le reste est mesuré** : les trois passages viennent de l'enveloppe du fichier
de voix, le décalage de 7,15 s d'une soustraction, et les instants d'image du
fichier de génération lui-même, relevé image par image.

Ni l'un ni l'autre n'est versionné — le dépôt ne porte aucun binaire. S'ils se
perdent, ce sont ces tableaux-ci qui les remplacent.
