# motion/ — les habillages animés d'Aznaroth

Remotion 4. Titres, cartons et logos animés en **1080 × 1920 à 30 images/s**,
rendus en fichier vidéo qu'on pose ensuite sur les rushes dans CapCut.

```bash
npm run dev            # le studio, pour voir et régler
npm run build          # rend out/ep02-titres.mp4  (calque, mode Écran)
npm run build:carton   # rend out/ep02-carton.mp4  (clip normal)
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

| carte | largeur occupée |
| --- | --- |
| COUNT | 41,6 % → 68,5 % |
| ZERO-FOUR — SEAL BROKEN | 27,2 % → 82,7 % |
| THE SHADOW TITANS ARE WAKING | **28,7 % → 81,2 %** |

Mesuré sur le fichier rendu, pas sur l'intention. La plus longue des trois
passe sur trois lignes et reste dedans, là où l'épisode 1 l'aurait étirée.

## Comment poser l'habillage dans CapCut

**Deux fichiers, deux traitements différents.** Ce n'est pas une complication
gratuite : le second ne peut pas passer par le même chemin que le premier, et
c'est un composite regardé qui l'a montré.

**`ep02-titres.mp4` — les trois cartes, en mode Écran.**

1. Le poser en calque **au-dessus** des rushes.
2. Lui donner le mode de fusion **« Écran » (Screen)**.
3. Le noir disparaît, le blanc reste.

**`ep02-carton.mp4` — le titre doré, en clip normal.**

Il se pose **à la suite** du dernier rush, en fusion **Normale**. Pas en Écran.

En Écran, le noir devient transparent — c'est tout l'intérêt, et c'est
justement le problème : le fond du carton disparaît avec. Posé sur un dragon en
contre-jour, l'or s'y dilue et le titre devient illisible. Le carton est
opaque, il n'a rien à laisser passer.

Le mode Écran a été retenu plutôt qu'un vrai canal alpha parce que **CapCut
Android ouvre le H.264 sans discuter**, là où son support du WebM alpha et des
séquences PNG est incertain. Un habillage qu'on ne peut pas importer ne sert à
rien, si transparent soit-il.

### Si on compose avec ffmpeg plutôt qu'avec CapCut

`blend=all_mode=screen` s'applique **plan par plan**, chrominance comprise. Sur
du `yuv420p`, il fusionne donc les plans U et V comme s'ils étaient des
luminances, et l'image entière vire au violet. Rien ne le signale : le rendu
sort, il est simplement faux.

```bash
# passer en RVB AVANT la fusion, revenir en YUV après
-filter_complex "[0:v]format=gbrp[b];[1:v]format=gbrp[o];\
                 [b][o]blend=all_mode=screen,format=yuv420p[v]"
```

Et si l'on colle ensuite deux morceaux : le **démultiplexeur** `concat` ne
rééchantillonne pas l'audio. Deux parties à 44,1 et 48 kHz produisent un
fichier plus long que la somme des deux — 18,64 s pour 13,92 + 1,60 mesurés.
Passer par le **filtre** `concat` avec un `aresample` sur chaque entrée.

**Le poids ne suit pas la règle du ~1 Mo/s** du protocole de publication :
0,80 Mo pour 15,5 s, parce que l'image est noire à 95 %. C'est normal ici, et
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

## Les instants sont ATTENDUS, pas mesurés

`tiktok/feuilleton-ep02.md` laisse ses instants entre crochets à dessein, et
écrit pourquoi : *« un instant plausible écrit d'avance est un instant qu'on
croira mesuré dans trois semaines »*. La voix n'est pas enregistrée.

Les valeurs de `FRISE_ATTENDUE` sont donc dérivées du seul chiffre que l'EP01
ait mesuré — **3,04 syllabes par seconde** — et de la structure en trois actes.
Elles servent à voir le montage tourner, pas à le caler.

Dès que la voix existe : relever ses trois passages à l'enveloppe, reporter les
instants dans `feuilleton-ep02.md`, puis ici. **Le nom de la constante dit son
état** ; le renommer sans mesurer serait le seul vrai défaut possible.

## Changer d'épisode

Un seul endroit : la constante `FRISE_ATTENDUE` en tête de `src/ep02.tsx`. Un
texte, son image de début, sa durée. La zone sûre et le passage à la ligne
suivent tout seuls, quel que soit ce qu'on y écrit.
