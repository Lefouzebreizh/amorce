# AMORCE

> Web app d'édition vidéo courte (9:16) avec bibliothèque de transitions et de
> bruitages, score d'accroche mesuré sur les 2 premières secondes, et
> bibliothèque d'accroches virales. Interface bilingue FR / EN.

Tout se passe dans le navigateur : import, montage, analyse et encodage final.
Aucune vidéo n'est envoyée sur un serveur.

## Démarrage

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # build de production dans dist/
npm run preview  # sert le build
npm run typecheck
```

`npm run dev` et `npm run build` copient automatiquement le moteur
`ffmpeg.wasm` depuis `node_modules` vers `public/ffmpeg/` (script
`scripts/copy-ffmpeg.mjs`). Le dossier est ignoré par git : il est régénéré à
chaque installation.

## Ce qui est implémenté (MVP, cahier des charges §3)

| Fonctionnalité | État |
| --- | --- |
| Import MP4 / MOV, glisser-déposer et sélecteur | ✅ |
| Durée maximale 1 minute, avec message d'erreur explicite | ✅ |
| Aperçu 9:16, lecture / pause, scrubbing | ✅ |
| Bibliothèque de 16 transitions et 12 bruitages, onglets FR/EN | ✅ |
| Prévisualisation des transitions et préécoute des bruitages | ✅ |
| Timeline : formes d'onde, marqueurs de transition, découpe, glisser-déposer | ✅ |
| Niveaux audio indépendants : voix / musique / bruitages | ✅ |
| Score d'accroche mesuré + conseils contextuels | ✅ |
| Styles d'ouverture (Choc direct, Teasing, Narratif lent) | ✅ |
| Bibliothèque de 8 accroches virales, application en un clic | ✅ |
| Export MP4 1080×1920 | ✅ |
| Sauvegarde locale du projet (rechargement de page sans perte) | ✅ |

Les fonctionnalités de la v2 (§4 : suggestions de titres et hashtags, analyse de
niches et de tendances) ne sont **pas** implémentées — elles supposent des
données de tendance à jour, donc une brique serveur qui interroge le web
périodiquement, hors périmètre de ce MVP entièrement client.

## Décisions techniques (réponses au §5)

### Stack

**Vite + React 19 + TypeScript**, traitement vidéo **côté client** avec
`ffmpeg.wasm`. Pas de backend : le MVP n'a besoin ni de comptes ni de stockage
distant, et l'encodage d'une vidéo d'une minute reste largement à la portée
d'un navigateur récent. Next.js n'apporterait ici que du poids — il redeviendra
pertinent le jour où la v2 aura besoin de routes serveur pour interroger les
tendances.

Le core `ffmpeg.wasm` est servi **depuis l'application** et non depuis un CDN
(`public/ffmpeg/`), ce qui évite une dépendance externe au runtime.

### Algorithme du score d'accroche

Le score n'est pas une valeur de démonstration : il est calculé sur le média,
dans `src/lib/hookScore.ts`. Les 2 premières secondes sont échantillonnées à
12 images/s (canvas 108×192) et la piste audio est décodée via l'API WebAudio.
Six signaux sont mesurés, normalisés entre 0 et 1, puis pondérés :

| Signal | Poids | Mesure |
| --- | --- | --- |
| Rythme de coupe | 0,26 | Coupes de la timeline + changements de plan détectés (saut de luminance > 0,22). Courbe en cloche centrée sur 3 coupes / 2 s. |
| Attaque sonore | 0,20 | Crête RMS de la fenêtre rapportée au niveau moyen du clip, plus densité des fronts montants nets. |
| Mouvement | 0,20 | Différence moyenne de luminance entre images successives. |
| Contraste visuel | 0,14 | Écart-type de la luminance, moyenné sur les images échantillonnées. |
| Entrée en action | 0,12 | Délai avant le premier pic de mouvement — plus il est court, meilleur c'est. |
| Densité colorée | 0,08 | Saturation moyenne. |

Le score final est la somme pondérée ramenée sur 100, avec le code couleur
demandé : rouge en dessous de 50, ambre jusqu'à 74, cyan au-delà. Si la piste
audio est illisible (codec non supporté par le navigateur), le poids de
l'attaque sonore est redistribué sur les signaux visuels et l'interface le
signale.

Les **conseils** sont dérivés des signaux : chaque signal en dessous de 0,72 est
classé par déficit pondéré, et les trois premiers deviennent un conseil dont le
gain annoncé correspond au nombre de points réellement récupérables sur ce
signal.

Les scores des trois styles d'ouverture (91 / 78 / 52) sont conservés tels
qu'ils figurent dans la maquette validée, mais **affichés comme des
références** : le score mesuré sur la vidéo est calculé et affiché séparément.

### Stockage

**IndexedDB**, côté navigateur : les médias importés (`assets`) et l'état du
projet (`project`) sont persistés, le projet est restauré au rechargement.
Passer au cloud n'aura de sens qu'avec des comptes utilisateurs.

### Comptes utilisateurs

**Plus tard.** Rien dans le MVP ne les exige, et les ajouter imposerait dès
maintenant un backend, un stockage distant et une politique de confidentialité
pour des vidéos personnelles.

### Bruitages

Les bruitages sont **synthétisés** par l'API WebAudio (`src/lib/sfxSynth.ts`)
plutôt que chargés depuis des fichiers : rien à héberger, rien à licencier, et
un rendu strictement identique entre la préécoute et l'export — le même graphe
est rendu hors ligne en WAV puis injecté dans ffmpeg.

### Transitions

Chaque transition porte le nom du filtre `xfade` correspondant. La vignette de
la bibliothèque, l'aperçu 9:16 et le rendu final décrivent donc le même effet,
au lieu d'une animation décorative sans rapport avec l'export.

## Architecture

```
src/
├── components/     Interface (barre du haut, rail, panneaux, aperçu, timeline)
├── data/           Catalogues : transitions, bruitages, accroches, styles
├── hooks/          Hooks React partagés (URL d'objets)
├── i18n/           Dictionnaire FR/EN et contexte de langue
├── lib/            Logique métier : import, score, synthèse audio, export, stockage
├── state/          Store zustand + modèle de timeline
├── styles/         Tokens de la direction artistique et feuilles de style
└── types.ts        Types partagés
```

Le modèle de timeline est dans `src/state/store.ts` : `computeSegments()` place
les clips en tenant compte du recouvrement des transitions, et cette même
géométrie sert à l'aperçu, à l'affichage de la timeline et aux décalages
`xfade` de l'export.

## Vérifications effectuées

Le parcours complet a été validé dans Chromium : import, calcul du score,
découpe, application d'une transition, pose d'un bruitage, lecture, bascule
FR/EN, export et restauration du projet après rechargement. L'export produit
bien un MP4 `h264 1080×1920 + aac 48 kHz`.

Deux réserves d'environnement de test, sans effet sur un navigateur grand
public :

- le Chromium de test est un build open source, sans H.264/AAC : la validation
  de bout en bout a été faite avec une source WebM, l'import MP4 restant
  vérifié sur les chemins de validation (format, durée) ;
- les polices Google n'étaient pas joignables depuis l'environnement de test,
  les substituts système sont donc utilisés sur les captures.

## Limites connues

- L'encodage est mono-thread : compter environ 1,5 à 2 fois la durée de la
  vidéo sur une machine de bureau récente.
- La musique de fond n'est pas bouclée si elle est plus courte que le montage.
- Le point d'honnêteté du cahier des charges est repris dans l'interface :
  AMORCE mesure des signaux de montage, aucun outil ne peut garantir la
  viralité d'une vidéo.
