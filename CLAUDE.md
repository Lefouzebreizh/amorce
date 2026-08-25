# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Langue du projet

Le projet est francophone : commentaires, noms de commits, README et échanges
avec l'utilisateur sont en français. Les identifiants de code restent en
anglais (`clips`, `transitionId`, `computeSegments`).

Les chaînes visibles dans l'application ne sont jamais écrites en dur : elles
passent par `src/i18n/strings.ts` et existent **obligatoirement** en FR et EN.

## Commandes

```bash
npm install
npm run dev        # serveur de dev, http://localhost:5173
npm run build      # typecheck (tsc -b) puis build de production
npm run typecheck  # typecheck seul
npm run preview    # sert le build de dist/
```

`predev` et `prebuild` exécutent `scripts/copy-ffmpeg.mjs`, qui copie le core
ffmpeg.wasm de `node_modules` vers `public/ffmpeg/`. Ce dossier est hors dépôt
(32 Mo) : sans `npm install`, l'app démarre mais l'export échoue sur
`failed to import ffmpeg-core.js`.

Il n'y a pas de suite de tests. La vérification se fait dans un navigateur, sur
le parcours réel : import → score → découpe → transition → bruitage → lecture →
export → rechargement.

## Architecture

Web app d'édition vidéo courte 9:16, **entièrement côté client** : aucun
backend, aucun envoi de média. Vite + React 19 + TypeScript, état dans zustand
(`src/state/store.ts`), encodage final par `ffmpeg.wasm`.

### La géométrie de timeline est partagée

`computeSegments()` (`src/state/store.ts`) est la seule source de vérité pour la
position des clips, recouvrement des transitions compris. Quatre consommateurs
en dépendent : `PreviewStage`, `Timeline`, `HookScorePanel` et `lib/export.ts`
— ce dernier s'en sert pour calculer les `offset` du filtre `xfade`. Toute
modification de ce calcul se répercute sur les quatre, et un aperçu qui ne
correspond plus à l'export vient presque toujours de là.

### Une transition décrit le même effet à trois endroits

Chaque entrée de `src/data/transitions.ts` porte :
- `xfade` — le nom du filtre ffmpeg utilisé à l'export ;
- `preview` — la clé d'animation CSS résolue par `src/lib/transitionStyles.ts`,
  utilisée à la fois par la vignette de la bibliothèque et par l'aperçu 9:16.

Ajouter une transition suppose donc d'ajouter aussi son cas dans
`transitionFrame()`, sinon elle retombe silencieusement sur un fondu.

### Les bruitages sont synthétisés, jamais importés

`src/lib/sfxSynth.ts` construit un graphe WebAudio unique (`build()`) rendu de
deux façons : en direct via l'`AudioContext` partagé pour la préécoute, et hors
ligne via `OfflineAudioContext` → WAV → système de fichiers ffmpeg pour
l'export. Le bruit est produit par un générateur pseudo-aléatoire déterministe
pour que les deux rendus soient identiques. N'ajoutez pas de fichiers audio
binaires : ajoutez une recette dans `src/data/sfx.ts` et, si besoin, un cas dans
`build()`.

### Le score d'accroche est mesuré, pas simulé

`src/lib/hookScore.ts` échantillonne les 2 premières secondes (12 img/s sur un
canvas 108×192) et décode la piste audio. Six signaux pondérés — les poids de
`WEIGHTS` doivent sommer à 1. Si l'audio est illisible, le poids de
`audioOnset` est redistribué sur les cinq signaux visuels et l'interface le
signale. Les conseils sont dérivés du déficit pondéré de chaque signal, ils ne
sont pas rédigés à l'avance.

Les scores 91 / 78 / 52 des styles d'ouverture (`openingPresets`) viennent de la
maquette validée et sont affichés comme **références**, distincts de la mesure.

### Export

`src/lib/export.ts` assemble un `filter_complex` unique. Le montage vidéo est un
repli à gauche : `xfade` quand le clip porte une transition, `concat` sinon —
les deux se chaînent dans le même graphe. L'audio est positionné par `adelay`
au `start` de chaque segment, puis `amix` avec les bruitages et la musique.

**Piège du core ffmpeg** : c'est la variante **ESM** de `@ffmpeg/core` qui doit
être servie. Le worker de `@ffmpeg/ffmpeg` est toujours créé en module ES, donc
`importScripts()` y est indisponible et le core UMD ne peut pas être chargé. Ne
passez pas `classWorkerURL` en pointant vers le worker UMD : son `import()` a
été remplacé par un faux résolveur webpack et échoue sur
`Cannot find module`.

### Persistance

IndexedDB (`src/lib/storage.ts`), deux stores : `assets` (blobs des médias) et
`project` (clips, bruitages, niveaux). Pas de comptes utilisateurs.

`MediaAsset` transporte `peaks` et `hasAudio`, calculés **une seule fois à
l'import** (`extractAudioProfile`) : la forme d'onde de la timeline et la
décision d'inclure une piste audio à l'export en dépendent. Ajouter un champ à
`MediaAsset` implique que les enregistrements déjà stockés ne l'auront pas —
`hydrate()` doit rester tolérant.

## Contraintes produit

Elles viennent du cahier des charges et ne sont pas négociables sans arbitrage :

- durée d'import maximale **1 minute** (`MAX_VIDEO_DURATION`), MP4 et MOV
  uniquement ;
- sortie **1080×1920, 9:16, MP4** ;
- palette et polices figées dans `src/styles/tokens.css` — la DA est validée ;
- l'interface ne promet jamais la viralité (`disclaimer.virality`) : AMORCE
  mesure des signaux de montage.

## Environnement de test

Le Chromium fourni par Playwright est un build open source **sans H.264/AAC** :
`canPlayType('video/mp4; codecs="avc1..."')` y renvoie une chaîne vide et
l'import d'un MP4 échoue au décodage. Pour valider le parcours de bout en bout
dans cet environnement, générer une source WebM (VP8/Opus) et élargir
temporairement `VIDEO_MIME` / `VIDEO_EXT` dans `src/lib/media.ts` — puis
rétablir. Le chemin ffmpeg.wasm, lui, décode le H.264 sans dépendre du
navigateur.
