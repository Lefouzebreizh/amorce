# `scenes/` — des plans fabriqués par le code, pas filmés

Une scène est **une page HTML qui expose `dessiner(t)`**. `rendre_scene.py`
appelle cette fonction une fois par image, photographie le résultat et pousse le
tout dans ffmpeg. C'est le principe de Remotion, sans Remotion.

```bash
python3 montage-auto/rendre_scene.py \
    --scene  montage-auto/scenes/portail.html \
    --site   capture-du-site.png \
    --sortie rushes/portail-martin.mp4 \
    --apercu 0.3 2.6 5.8 12.2      # écrit aussi ces instants en PNG
```

## Pourquoi une page HTML plutôt qu'un moteur de rendu

- **Elle s'ouvre dans un navigateur.** On règle une bordure ou une durée en
  rechargeant l'onglet, sans chaîne de compilation ni serveur de studio.
- **Elle est déterministe.** `dessiner(t)` ne lit ni horloge, ni
  `requestAnimationFrame`, ni `Math.random` — tout le hasard passe par une
  graine fixe. Deux rendus donnent le même fichier, à l'octet près. Une scène
  qui se rejoue autrement à chaque exécution ne se monte pas : on ne peut plus
  caler un son dessus.
- **Elle ne coûte aucune dépendance.** Le Chromium de Playwright et le ffmpeg
  d'`imageio` sont déjà là. `motion/` (Remotion) reste le bon outil pour les
  **habillages** — titres, cartons — qu'on repose ensuite dans CapCut ; `scenes/`
  fabrique des **plans entiers**, son compris, quand il n'y a pas de rush.

**Les images ne touchent jamais le disque.** Elles passent par un tube vers
ffmpeg. 402 images en 1080 × 1920 pèsent près d'un gigaoctet en PNG, et l'espace
disque d'une session est une allocation fixe, pas une machine : écrire la
séquence puis l'encoder, c'est demander ce gigaoctet pour rien. Le tube est là
par précaution, pas après un incident.

## Un récit, plusieurs montages

Les bornes, les cartons et la fenêtre de défilement vivent dans un JSON, pas
dans le dessin :

```bash
python3 montage-auto/rendre_scene.py \
    --scene montage-auto/scenes/portail.html \
    --recit montage-auto/scenes/recits/artisan-court.json \
    --site capture.png --sortie rushes/court.mp4
```

| récit | durée | le pari |
| --- | --- | --- |
| `artisan-long.json` | 13,4 s | le portail s'installe 3,4 s avant le site ; le message parle du soin apporté |
| `artisan-court.json` | 12,0 s | le portail tient en 1,3 s, le texte est là dès l'image zéro, chaque carton nomme ce qui est à l'écran |

**Le court n'est pas une coupe du long, c'est un pari inverse**, et il vient
d'une critique juste : trois secondes de spectacle muet, sur un fil où l'on
décide en une seconde, c'est trois secondes offertes au pouce. La réponse n'a
pas été de jeter le portail — il est la seule chose qui distingue ces vidéos de
toutes les autres du même service — mais de le **comprimer** et de faire jouer
le spectacle et la promesse **ensemble**. C'était un réglage, pas une
réécriture, et c'est précisément pour ça que le récit est un fichier.

Les deux existent pour être comparés sur les vues. Personne ici ne sait
d'avance lequel tient.

**Le récit par défaut est aussi écrit en dur dans la scène** (`DEFAUT`), pour
qu'ouvrir `portail.html` dans un navigateur montre quelque chose sans rien
passer. Un test tient les deux copies d'accord — deux copies dérivent toujours.

## `portail.html` — le portail d'Artisan Express

L'ouverture d'Aznaroth, mais ce qui sort du portail est le **site d'un artisan**,
et la vidéo se termine sur une promesse de sérieux plutôt que sur un cri. La
capture passée en `--site` est photographiée sur la vraie page de démonstration :
rien n'y est maquetté, c'est le site qu'on vend qui apparaît.

**Il se réutilise tel quel pour n'importe quel prospect** — une capture, une
commande, une vidéo. C'est là qu'est la valeur : pas dans un montage, dans une
fabrique.

## Quatre défauts mesurés sur les images, et ce qu'ils enseignent

Chacun était invisible dans le code et évident sur une planche de vignettes.
**Regarder le rendu, pas l'intention.**

**1. L'image zéro était noire.** La comète partait de `[L+240, -280]` avec une
accélération cubique : relevé sur les vignettes, elle n'entrait dans le cadre
qu'à **0,24 s**. Sept images de noir en tête de fil, exactement ce que
l'ouverture devait empêcher. Une accélération n'est pas un retard : si l'objet
doit être vu tout de suite, il **commence** dans le cadre et sa traînée seule
vient du hors-champ.

**2. Le cœur du portail était un œuf blanc de 1,6 s.** Peint plein et opaque, il
occupait le milieu du cadre pendant que plus rien ne s'y passait. Un portail
n'est pas une lampe : c'est un **bord** lumineux autour d'un dedans qu'on
devine. Anneau net, intérieur voilé — et la dalle monte à travers.

**3. La porte ne se refermait qu'à 30 %.** Son anneau restait donc assez large
pour traverser la dalle *et* le texte de fin : un trait blanc en travers de
« ARTISAN EXPRESS ». Une porte qui s'est ouverte se referme sur ce qu'elle a
laissé passer, sinon elle reste un objet à l'écran.

**4. Les anneaux montaient en lumière pendant que l'éclat retombait.** Rayon et
intensité suivaient la même courbe de 0,42 s, et la vignette de **0,45 s** était
presque noire. Ils sont désormais séparés — le rebond du rayon dure
0,42 s, la lumière arrive en 0,16 s. **Ce qui apparaît et ce qui s'allume ne
sont pas la même horloge.**

**5. Le son sifflait et soufflait, et une seule des deux causes venait de la
scène.** Première écoute d'Erwann : « le son est fiii, chut chut chut ». Deux
défauts, pas un.

Le **souffle** tenait à trois sons, tous dans les deux premières secondes —
là où le spectateur décide. Mesurés source par source, part de l'énergie
au-dessus de 2 kHz et part tenue par les vingt raies les plus fortes :

| son | > 2 kHz | tonal | centroïde |
| --- | --- | --- | --- |
| `whoosh_tournant_long` | **65,6 %** | 0,9 % | 2878 Hz |
| `grondement_braises` | **56,9 %** | 2,3 % | 2887 Hz |
| `impact_debris` | **56,8 %** | 39,6 % | 4073 Hz |

Une part tonale de 1 % avec les deux tiers de l'énergie dans l'aigu, c'est la
définition du bruit blanc. Ces trois-là sont descendus de 8 à 10 dB.

Le **sifflement**, lui, était une bavure de la correction du son précédente :
en comblant quatre secondes de creux sous le message, le lit avait été monté de
+11 dB **en bloc**. `drone_grave` et `nappe_sombre` le portent sans percer —
90 % tonal, rien au-dessus de 2 kHz — mais `riser_long`, un balayage de
centroïde 944 Hz, s'est retrouvé à +16 dB sous le texte. **Un lit se monte son
par son, jamais d'un seul geste sur un groupe.** Le lit tient d'ailleurs à
−25 dB sans lui : le riser n'y était pour rien.

`tests/test_scene_portail.py` interdit désormais qu'un son passé au-dessus de
+12 dB ait un centroïde au-dessus de 200 Hz.

**6. La page ne défilait qu'au tiers.** La course était écrite en dur — 1020 px
sur les 3143 disponibles. Elle se déduit maintenant de la capture
(`img.height - visible`), donc n'importe quelle page d'artisan arrive à son
pied, quelle que soit sa longueur. Le montage y gagne un raccord : le pied de
page dit « Site réalisé par Artisan Express » une seconde avant que le carton
ne le dise à son tour.

## La zone sûre est câblée

`ZONE = { haut: 230, bas: 865 }`, soit 12 % à 45 % de 1920 — l'intersection des
trois plateformes, jamais la plus permissive (`CLAUDE.md §2`). Aucun texte de
`portail.html` n'en sort. Le site, lui, a le droit de descendre plus bas : il
est le décor, pas le message.
