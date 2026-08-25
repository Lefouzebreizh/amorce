---
name: bande-son
description: Fabriquer la bande-son d'une vidéo — musique, voix off, bruitages — et la sortir au bon niveau pour la plateforme visée, à partir d'une simple phrase d'intention. Mesure le fichier, propose les réglages, mixe avec ffmpeg, puis vérifie le résultat en LUFS et en vrai pic. À utiliser dès qu'une vidéo et du son se croisent : « fais-moi la bande-son de ce clip », « quel volume pour la musique », « la musique couvre ma voix », « le son est trop faible sur TikTok », « ajoute une ambiance », « ça sonne amateur », « il manque du rythme » — et aussi quand un fichier .mp4 ou .mov arrive avec une intention de montage mais rien de dit sur le son. Ne pas attendre le mot « LUFS » : personne ne le prononce, et c'est précisément le réglage qui manque.
---

# Le son se juge en LUFS, pas en décibels de crête

C'est l'erreur qui coûte une journée. Un mixage calé à -1 dBFS de **crête** peut
mesurer -22 LUFS de **loudness** : il ne sature pas, la forme d'onde remplit
l'écran, tout paraît normal — et à la publication il sort deux fois plus faible
que la vidéo suivante. Les plateformes ne normalisent pas la crête, elles
normalisent la loudness perçue, et elles **baissent** ce qui dépasse sans jamais
remonter ce qui manque.

Donc : mesurer avant de toucher, viser une cible chiffrée, vérifier après.
Le reste de cette recette découle de là.

## Le parcours, en quatre gestes

**1. Mesurer avant de toucher.** `scripts/sonometre.py` sur chaque source rend
la loudness intégrée, le vrai pic, l'étendue dynamique et — sur une voix — les
passages parlés. On ne propose aucun réglage avant d'avoir ces chiffres : sans
eux on devine, et deviner sur du son, c'est refaire trois fois.

**2. Traduire l'intention en réglages.** L'utilisateur donne une phrase, pas des
décibels : « recette de cuisine, 45 s, voix off, ambiance chaleureuse ». Le
tableau plus bas convertit ça en niveau de musique, profondeur de baisse et
densité de bruitages. **Ne poser qu'une seule question**, et seulement si la
réponse ne se devine pas : la plateforme de destination, quand elle n'est pas
dite. Le reste s'infère de la vidéo (durée, format, présence de parole).

**3. Mixer.** `scripts/monter.py` fait le montage complet : boucle et fondu de
la musique, baisse sous la voix par chaîne latérale, mixage, normalisation en
deux passes, remultiplexage sans ré-encoder l'image.

**4. Rendre la carte du mixage.** Pas un fichier lâché sans un mot. Toujours
ces trois blocs :

```
Bande-son — <fichier de sortie>
  Mesuré : -14,1 LUFS · vrai pic -1,2 dBTP · étendue 6,8 LU  → conforme <plateforme>
  Décidé : musique -16 dB, plongeant à -26 dB sous la voix (baisse de 10 dB)
           fondu de sortie 2 s · bruitages : aucun
  À changer d'un mot : « plus de musique », « la voix devant », « plus calme »
```

La dernière ligne compte autant que les deux autres : l'outil doit être
contredit en une phrase, sinon personne n'y revient.

## Les cibles

| Destination | Loudness intégrée | Vrai pic |
| --- | --- | --- |
| TikTok, Reels, Shorts | **-14 LUFS** | -1 dBTP |
| YouTube (horizontal) | -14 LUFS | -1 dBTP |
| Podcast (Apple, Spotify) | -16 LUFS | -1 dBTP |
| Diffusion TV (EBU R128) | -23 LUFS | -1 dBTP |

Viser la cible, jamais la dépasser : au-dessus, la plateforme baisse **tout** le
mixage, voix comprise, et le résultat sort plat. En dessous de -1 dBTP de marge,
l'encodage AAC final repousse les crêtes au-delà de 0 et fait craquer un
fichier qui passait pourtant les mesures avant encodage.

## De la phrase aux réglages

| L'intention dit… | Musique | Baisse sous la voix | Bruitages |
| --- | --- | --- | --- |
| voix off, tutoriel, explication | -16 dB | 10 à 12 dB | rares, ponctuation seulement |
| ambiance, voyage, sans parole | -6 dB | — | discrets, sous le rythme |
| rythmé, sport, accroche courte | -8 dB | 8 dB | marqués, sur les coupes |
| calme, intime, témoignage | -18 dB | 12 dB | aucun |
| démonstration produit | -14 dB | 10 dB | un par geste montré |

Détails et cas limites : `references/intentions.md`.

## Les huit pièges

1. **Crête ≠ loudness.** Le piège principal, rappelé en tête. `dynaudnorm` et
   la normalisation par crête ne remplacent pas `loudnorm`.
2. **`loudnorm` en une passe est dynamique**, donc imprévisible : il compresse
   au fil de l'eau et le résultat mesuré ne tombe pas sur la cible. Toujours
   deux passes — mesurer, puis appliquer les valeurs mesurées.
3. **Baisser la musique en continu au lieu de la faire plonger sous la voix.**
   Une musique posée douze décibels plus bas pour rester intelligible devient
   inaudible dans les blancs, là où elle devrait porter. La baisse suit les
   passages parlés ; ce n'est pas un réglage de volume.
4. **Un compresseur à chaîne latérale ne tient pas une profondeur annoncée.**
   Mesuré sur ce dépôt : `sidechaincompress` réglé pour 12 dB n'en rendait que
   8, et donnait le même résultat pour 0 et pour 6 — son taux dépend du niveau
   instantané de la voix, pas de sa loudness. `monter.py` trace donc une
   enveloppe sur les passages parlés détectés, dans son propre étage de gain
   (l'écrire sur le volume de la musique ferait que bouger le curseur efface la
   baisse, et inversement).
5. **44,1 kHz contre 48 kHz.** La piste audio d'une vidéo est en 48 kHz, une
   musique téléchargée souvent en 44,1. Rééchantillonner explicitement, sinon
   la dérive s'entend sur une minute.
6. **Ne jamais ré-encoder l'image quand seul le son change** : `-c:v copy`.
   Sinon on paie une perte de qualité et plusieurs minutes pour rien.
7. **Une musique plus courte que la vidéo** se boucle avec un fondu enchaîné,
   pas par un redémarrage sec — la reprise brutale est le marqueur amateur le
   plus audible, juste devant la coupure nette en fin de vidéo (fondu de 1,5 à
   2 s, aligné sur la dernière image).
8. **Mesurer le fichier final, pas le mixage avant encodage.** C'est le seul
   chiffre qui correspond à ce que la plateforme recevra.

## Outillage

```bash
S=.claude/skills/bande-son/scripts

python3 $S/sonometre.py ma-video.mp4                    # mesurer
python3 $S/sonometre.py voix.wav --parole               # + repérer les passages parlés

python3 $S/monter.py --video clip.mp4 --musique fond.mp3 --voix voix.wav \
        --plateforme tiktok --intention "tutoriel, voix off, calme"
```

Les deux scripts trouvent ffmpeg seuls : celui du système d'abord, sinon celui
livré par `imageio-ffmpeg` (même stratégie que `mon-app-audio/core/mixeur.py`).
Aucune installation à demander avant d'avoir essayé.

Si la vidéo porte déjà sa voix dans sa propre piste audio, ne pas demander de
fichier séparé : `--voix-de-la-video` l'extrait.
