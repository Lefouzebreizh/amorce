# Un cri de synthèse passe les mesures et pas l'oreille

05/09/2026 — un rugissement fabriqué par `montage-auto/cri_dragon.py`, renvoyé
en une phrase : « horrible, ça ne va pas du tout avec la créature. »

## Ce que les mesures disaient

Toutes vertes. Le climax était devenu le plan le plus fort du film, +3,5 dB
au-dessus de l'explosion. La bande 8-16 kHz ne montait que de 2,4 dB : aucun
grésillement. Le vrai pic tenait à −0,5 dBFS.

## Ce qui n'allait pas, et qu'aucune mesure ne voit

Deux causes, l'une de méthode, l'autre de fond.

**De méthode** : deux caractères mélangés à parts égales portent deux
fondamentales sans rapport — 78 et 132 Hz. Ça ne fait pas un monstre plus riche,
ça en fait deux. Et une compression au rapport 6 sur un seuil à −30 dB écrase ce
qui restait de naturel.

**De fond** : une synthèse par formants n'a pas la matière d'un enregistrement,
et aucun réglage ne la lui donne. Les trois quarts du travail passé dessus —
bascule de présence, compression, superposition — étaient des rattrapages d'un
manque que rien ne rattrape.

## Ce qui marche, et ce que ça coûte

Le connecteur ElevenLabs, `eleven_text_to_sound_v2` : **0,3 centime** par
variation, quatre variations en trois secondes, et **les fichiers reviennent** —
ils sont servis depuis `storage.googleapis.com`, hôte joignable. Cela précise la
leçon du 01/09 sur higgsfield, dont le CDN est refusé : ce n'est pas « les
fichiers d'un connecteur ne reviennent pas », c'est « ça dépend de l'hôte qui
les sert », et celui d'ElevenLabs répond.

Posé **sans aucun traitement**, le cri généré a mis le climax 4,0 dB au-dessus
de l'explosion, avec 4 dB de haut-medium **en moins** que l'explosion. Ce qui
avait demandé cinq essais de rattrapage a été obtenu au gain seul.

## Le chiffre qui décide entre quatre variations

Le même prompt rend des sons très inégaux pour cet usage. Part de l'énergie
**sous 400 Hz**, c'est-à-dire perdue sur un téléphone :

| variation | sous 400 Hz | entendu à crête pleine |
| --- | --- | --- |
| 1 | **82,9 %** | −20,8 dB |
| 2 | 30,6 % | −17,7 dB |
| 3 | 37,7 % | **−16,6 dB** |
| 4 | 40,9 % | −19,0 dB |

Soixante-six points d'écart entre la première et la deuxième, pour la même
demande. **Générer plusieurs variations n'est pas un luxe** : c'est ce qui rend
le choix mesurable au lieu d'être un coup de dé.

## Et ce que la mesure ne choisit jamais

Sur le synthétiseur, le caractère qui mesurait le plus fort était `blesse` — un
cri d'agonie. Il n'a pas été retenu. Une mesure classe des candidats déjà
jugés recevables ; elle ne dit pas lequel raconte la bonne chose.
