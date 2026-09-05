# Un décodage mono annonce une crête que le fichier n'a pas

05/09/2026 — mesuré en contrôlant l'écrêtage d'un montage avant de le livrer.

## Le chiffre

Le même fichier MP4, mesuré deux fois :

| comment | crête annoncée |
| --- | --- |
| `ffmpeg -vn -ac 1 -ar 48000 -c:a pcm_f32le` puis max(abs) | **+2,48 dBFS** |
| `ffmpeg -af ebur128=peak=true`, vrai pic | **−0,50 dBFS** |

Trois décibels d'écart, et la première mesure dit « ça écrête » d'un fichier qui
n'écrête pas.

## La cause

Deux choses se cumulent, et aucune n'est un bogue :

- un décodeur AAC rend des valeurs flottantes qui dépassent le plein échelle
  entre les échantillons — le fichier est conforme, la reconstruction déborde ;
- le rééchantillonnage de `-ac 1` ajoute son propre dépassement inter-échantillon,
  sur un signal qui n'est plus celui que le lecteur restituera.

## Ce que ça a coûté

Une réserve prise pour rien : la crête de mixage avait été abaissée à 0,90 pour
« corriger » un écrêtage inexistant, ce qui retirait un décibel au son ajouté
exactement là où il en manquait.

## La règle

**Le contrôle d'écrêtage se fait sur le flux livré, pas sur un décodage de
travail.** `ebur128=peak=true` rend le vrai pic, canal par canal, sur le signal
réel. Un `max(abs(x))` sur un WAV intermédiaire mesure l'intermédiaire.
