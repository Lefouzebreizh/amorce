# Trois défauts d'une chaîne ffmpeg, tous invisibles dans la mesure d'avant

Recadrage d'une capture d'écran verticale en 9:16 avec une voix off posée
dessus. Les trois ont le même point commun que le §8 de `CLAUDE.md` décrit :
**la mesure disait vert sur la source, et le fichier livré était faux.**

## 1. `crop` arrondit son décalage à un nombre pair en 4:2:0

Le séparateur de la barre d'adresse du navigateur occupait les lignes 248 à 250
de la source, mesuré sur **toutes** les images. `crop=1080:1920:0:251` aurait
donc dû le retirer entièrement — et la ligne 250 est restée, visible en haut de
l'image livrée, à **224 de clarté sur un fond à 20**.

La cause : en `yuv420p`, la chrominance est échantillonnée une ligne sur deux,
et le filtre `crop` **ramène silencieusement un décalage impair au pair
inférieur**. 251 devient 250. Aucun avertissement, aucune erreur, et la
commande rend le bon format.

La parade tient en une règle : **un décalage de `crop` se choisit pair**, et se
vérifie sur le fichier de sortie, jamais sur la mesure faite dans la source. Le
contrôle qui l'a trouvé coûte trois lignes — tirer les images du fichier livré
et lire la clarté des quarante premières et dernières lignes.

## 2. Un fichier intermédiaire en 16 bits écrête avant que le limiteur le voie

Pour choisir le gain de la voix, la chaîne avait été décomposée en étapes, avec
un WAV entre chacune : égalisation, gain, limiteur. Les mesures annonçaient
**−11,9 LUFS** après un gain de +10 dB, et un limiteur qui ne coûtait qu'un
décibel.

C'était faux. Le WAV intermédiaire est en **PCM 16 bits** : le gain de +10 dB y
avait déjà écrêté à 0 dBFS, et le limiteur recevait un signal déjà détruit. La
même chaîne écrite **en une seule passe** rendait **−14,4 LUFS** — deux
décibels et demi d'écart, et un verdict opposé sur le réglage à choisir.

Deux façons de ne pas le repayer : écrire la chaîne d'un seul tenant, ou sortir
les intermédiaires en `pcm_f32le`, qui n'a pas de plafond à 0 dBFS.

## 3. `-ac 2` sur une source mono coûte trois décibels sur le fichier livré

La chaîne mesurée en WAV rendait **−1,4 dBTP** et **−16,3 dB** au-dessus de
400 Hz. Le MP4 sorti de la même chaîne avec `-ac 2` rendait **−4,3 dBTP et
−19,2 dB** : le rééchantillonneur applique l'atténuation de conservation de
puissance en passant d'un canal à deux.

`pan=stereo|c0=c0|c1=c0` duplique le canal sans toucher au niveau, et rend les
trois décibels. C'est la différence entre un mixage au niveau du téléphone
(−11,1 LUFS) et un mixage qui paraît lointain (−14,1), pour un paramètre qu'on
n'aurait pas songé à mesurer.
