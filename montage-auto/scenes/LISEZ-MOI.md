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

## La zone sûre est câblée

`ZONE = { haut: 230, bas: 865 }`, soit 12 % à 45 % de 1920 — l'intersection des
trois plateformes, jamais la plus permissive (`CLAUDE.md §2`). Aucun texte de
`portail.html` n'en sort. Le site, lui, a le droit de descendre plus bas : il
est le décor, pas le message.
