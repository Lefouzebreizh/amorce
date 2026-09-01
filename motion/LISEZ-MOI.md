# motion/ — les habillages animés d'Aznaroth

Remotion 4. Titres, cartons et logos animés en **1080 × 1920 à 30 images/s**,
rendus en fichier vidéo qu'on pose ensuite sur les rushes dans CapCut.

```bash
npm run dev            # le studio, pour voir et régler
npm run build          # rend out/ep02-habillage.mp4
npm run build:carton   # rend le seul carton de fin
npm run typecheck
```

## Ce que ce projet résout, et pourquoi il existe

L'épisode 1 publié portait deux titres à la même place, à la même police.
« RIFT ZERO FIVE » tenait de 26,9 % à 70,3 % de la largeur — dégagé. « THE
SHADOW TITAN AWAKENS », plus long, avait été **étiré d'un bord à l'autre**
pour tenir sur une ligne : **9,8 % à 94,7 %**. Mangé à gauche par les boutons
de Facebook, au ras du bord à droite.

`src/zone-sure.tsx` rend ce défaut impossible. La boîte est **fixe** — 22 % à
88 % de large, 12 % à 45 % de haut — et le texte passe à la ligne au lieu de
s'étirer. Vérifié sur le rendu réel :

| titre | largeur occupée |
| --- | --- |
| CYBER HYDRA TITAN | 29,7 % → 80,1 % |
| PROTOCOLE ROMPU | 31,1 % → 78,9 % |
| ELLE APPREND DE CHAQUE TÊTE COUPÉE (35 signes) | **25,8 % → 84,2 %** |

Le plus long des trois est plus long que celui qui débordait, et il rentre.

## Comment poser l'habillage dans CapCut

Le rendu est **blanc et or sur fond noir**. Le noir n'est pas un fond, c'est
un canal alpha du pauvre :

1. Poser `ep02-habillage.mp4` en calque **au-dessus** des rushes.
2. Lui donner le mode de fusion **« Écran » (Screen)**.
3. Le noir disparaît, le blanc et l'or restent.

Ce chemin a été retenu plutôt qu'un vrai canal alpha parce que **CapCut
Android ouvre le H.264 sans discuter**, là où son support du WebM alpha et des
séquences PNG est incertain. Un habillage qu'on ne peut pas importer ne sert à
rien, si transparent soit-il.

**Le poids ne suit pas la règle du ~1 Mo/s** du protocole de publication :
0,97 Mo pour 17,73 s, parce que l'image est noire à 95 %. C'est normal ici, et
seulement ici — le contrôle du 1 Mo/s vaut pour le **montage final**, pas pour
un calque.

## Le piège qui coûte une demi-heure

`remotion render` télécharge son propre Chrome au premier lancement, depuis
**`remotion.media`** — que le mandataire refuse (`403 Host not in allowlist`).

Le navigateur est pourtant déjà sur la machine. Il faut le désigner, et c'est
le **`headless_shell`** de Playwright qu'il veut, pas le `chromium` complet —
ce dernier échoue sur un « Failed to launch the browser process » qui ne dit
pas pourquoi.

```bash
npx remotion render src/index.ts Ep02 out/ep02.mp4 \
  --browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
```

## Changer d'épisode

Un seul endroit : la constante `FRISE` en tête de `src/ep02.tsx`. Un texte,
son image de début, sa durée. La zone sûre et le passage à la ligne suivent
tout seuls, quel que soit ce qu'on y écrit.
