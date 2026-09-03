# Le connecteur ElevenLabs rend ses fichiers — l'hôte n'est pas celui qu'on croyait

`CLAUDE.md` §7 tire du cas higgsfield une conséquence générale : « le trafic
d'un connecteur MCP échappe à la politique réseau, **mais seulement pour
l'appel — pas pour les fichiers qu'il rend** », et enchaîne sur « le "regardé,
pas seulement mesuré" du §8 **ne peut pas s'appliquer ici** ».

**C'est vrai de higgsfield et faux d'ElevenLabs**, mesuré le 03/09/2026.

| connecteur | hôte qui sert le résultat | ce que rend le mandataire |
| --- | --- | --- |
| higgsfield | `d8j0ntlcm91z4.cloudfront.net` | `connect_rejected` |
| **ElevenLabs** | **`storage.googleapis.com`** | **200, fichier récupéré** |

Une musique de 15 s générée par `eleven_music_v2` s'est téléchargée en une
commande : **378 033 octets, HTTP 200**, MP3 48 kHz stéréo. Coût de la
génération : **16,36 cents**.

L'hôte n'est pas une surprise : le §4 de `CLAUDE.md` note déjà que
`storage.googleapis.com` répond, c'est de là que `chat-traducteur` tire son
YAMNet. Ce qui manquait, c'est le lien entre les deux — personne n'avait
regardé **par quel hôte** ElevenLabs sert ses générations.

**La leçon n'est donc pas « les connecteurs rendent leurs fichiers », c'est :
un mur mesuré sur un connecteur ne se généralise pas aux autres.** Ce qui
décide est l'hôte du CDN, et il se lit dans l'URL du résultat — une seconde de
lecture avant de renoncer.

Conséquence pratique immédiate : une session distante **peut** fabriquer un son
et le poser dans un montage, et le §8 s'applique normalement — le fichier
revient, donc il se mesure et se regarde.

## Le corollaire, mesuré dans la foulée : un lit musical se règle au-dessus de 400 Hz

Musique posée à −13 dB sous une voix off, ce qui paraissait raisonnable :
mesurée dans les silences de la voix du fichier livré, elle rendait **−40,2 dB
au-dessus de 400 Hz**, contre **−41,9 dB** pour le même silence *sans musique
du tout*. **1,7 dB au-dessus du silence** : inaudible sur un téléphone, alors
que la piste était bien là et que toutes les mesures de sonie globale
paraissaient normales.

Deux causes qui s'additionnaient, et aucune ne se voit en LUFS :

- le `sidechaincompress` à `release=350` ne rouvrait pas dans une pause de
  0,4 s — il faut une détente **plus courte que la plus courte pause**, mesurée
  sur la voix par `silencedetect` ;
- le réglage avait été choisi sur la sonie pleine bande, alors que le §2 dit
  que seul ce qui passe au-dessus de 400 Hz existe sur l'appareil visé.

Réglée à −7 dB avec `release=200`, la musique rend −26 à −30 dB dans les
pauses pour une voix à −14 dB : douze à seize décibels dessous, audible sans
jamais mordre. **Et le niveau de la parole n'a pas bougé d'un dixième de
décibel** entre −13, −9, −7 et −5 dB de musique — la preuve que le lit ne passe
jamais devant.
