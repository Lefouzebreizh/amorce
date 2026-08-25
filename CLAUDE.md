@AGENTS.md

# Amorce — guide du dépôt

Studio de montage vertical pour rushes générés par IA. **Tout s'exécute dans le
navigateur** : aucun fichier n'est envoyé sur un serveur, il n'y a ni base de
données, ni API, ni route serveur. Next.js ne sert qu'à livrer une page unique.

Le `README.md` s'adresse à l'utilisateur (parcours, note de viralité, choix
techniques justifiés). Ce fichier-ci s'adresse à qui modifie le code.

## Commandes

```bash
npm run dev         # serveur de développement, http://localhost:3000
npm run build       # build de production
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (config plate, eslint-config-next)
npm test            # tests unitaires (node --test, --experimental-strip-types)
npm run fixtures    # fabrique quatre rushes de test dans .fixtures/rushes/
npm run verify      # parcours complet dans un vrai Chromium (dev doit tourner)
```

Avant de pousser : `npm run typecheck && npm run lint && npm test`. Si le
changement touche au rendu, à l'audio, à l'export ou à la mise en page mobile,
`npm run verify` est le seul filet réel — voir « Vérifier » plus bas.

## Carte du code

```
src/app/          layout.tsx (polices, thème, viewport), page.tsx (monte <Studio/>), globals.css (@theme Tailwind v4)
src/lib/          toute la logique métier — c'est là que vit le studio
src/hooks/        usePlayback (la boucle de rendu), useMediaQuery
src/components/   coques et panneaux, presque sans logique
scripts/          make-fixtures.mjs, verify.mjs (Playwright, hors bundle)
```

### `src/lib` — cœur du studio

| Fichier | Rôle |
| --- | --- |
| `types.ts` | Modèle de données (`Project`, `Clip`, `Caption`, `SoundCue`…) et constantes de sortie. Point de départ pour comprendre le reste. |
| `timeline.ts` | Placement des clips, chevauchements de transitions, `sliceAt` (que dessiner à l'instant t). Pur, testé. |
| `renderer.ts` | `renderFrame` : **le** compositeur. Plus `ClipVideoPool` et `syncPlayback`. |
| `transitions.ts` | Une transition = composer deux fonctions de dessin. Ajouter un effet ne touche pas au moteur. |
| `grade.ts` | Étalonnage cinéma : filtres, teintes, vignettage, grain, halo. |
| `captions.ts` | Styles de sous-titres et tracé canvas ; renvoie les boîtes pour la manipulation au doigt. |
| `sfx.ts` | Bruitages **synthétisés** en Web Audio. Aucun fichier son n'est embarqué. |
| `audio.ts` | Mixage des trois bus (clips / bruitages / musique) et sortie enregistrable. |
| `export.ts` | `MediaRecorder` sur le canvas + le bus audio. Négocie MP4 puis WebM. |
| `quality.ts` | Paliers de prévisualisation, `QualityGovernor` (ajustement) et `PanicDetector` (filet). |
| `analysis.ts` | Note de viralité sur 100 : hook 30, rythme 20, tension 20, sous-titres 15, son 10, format 5. |
| `guide.ts` | Une seule consigne à la fois, ordonnée par ce qui bloque le plus. |
| `autoEdit.ts` | Montage express : un projet complet à partir des seuls rushes. |
| `store.ts` | Store Zustand, avec historique annuler/rétablir. |
| `steps.ts` | Le parcours en 7 étapes, en données pures (séparé des composants pour rester testable). |
| `media.ts`, `hooks.ts`, `id.ts` | Import de fichiers, modèles d'accroches, identifiants. |

### Composants

`Studio.tsx` tient le moteur de lecture, les polices et l'étape courante, puis
choisit entre `StudioDesktop` (trois colonnes) et `StudioMobile` (une colonne,
barre d'onglets). **Les panneaux d'étape sont rigoureusement les mêmes des deux
côtés** — `steps.tsx` aiguille vers `panels/*`, seule la coque change. Ne pas
dupliquer un panneau pour le mobile.

`ui.tsx` fournit les briques (`Panel`, `Field`, `Button`…). `Field` **impose**
un texte d'aide à côté de chaque réglage : un curseur sans phrase qui dit ce
qu'il fait est un curseur qu'on ne touchera pas.

## Invariants à ne pas casser

Ces règles sont la raison pour laquelle l'application fonctionne. Chacune est
justifiée en tête du fichier concerné ; relire ce commentaire avant d'y toucher.

1. **Un seul chemin de rendu.** `renderFrame` est le seul endroit qui sait à
   quoi ressemble une image. Prévisualisation et export l'appellent tous les
   deux. Ne jamais ajouter un tracé « juste pour l'aperçu » ou « juste pour
   l'export » : l'écart entre les deux réapparaîtrait aussitôt.
2. **Au plus deux couches vidéo.** `timeline.ts` borne toute transition à 45 %
   du plus court des deux clips. Le moteur s'appuie dessus pour ne jamais
   composer plus de deux couches. Relever cette limite casse le rendu.
3. **Un élément `<video>` par clip, pas par média.** Deux clips peuvent
   découper le même rush et se chevaucher ; un élément partagé ne peut pas être
   à deux positions de lecture à la fois.
4. **La composition s'écrit toujours en coordonnées 1080 × 1920.** La qualité
   d'aperçu n'agit que par une transformation d'échelle posée sur le contexte
   (`RenderOptions.scale`). Aucune position, aucun corps de police ne doit être
   calculé à partir de la taille réelle du canvas.
5. **Le son passe par Web Audio, jamais par le volume des éléments média.**
   Les `<video>` sont `muted` ; c'est le graphe audio qui alimente à la fois les
   haut-parleurs et `MediaRecorder`.
6. **Le temps écoulé est borné hors export, jamais pendant.** La borne absorbe
   une mise en veille ; pendant un export elle désynchronise l'image et le son
   et allonge le fichier. Voir la boucle de `usePlayback.ts`.
7. **Les sous-titres sont tracés après l'étalonnage.** Jamais grainés ni
   assombris : en format court, la lisibilité prime sur l'esthétique.
8. **Aucun binaire versionné.** Rushes de test, captures et exports vont dans
   `.fixtures/` (ignoré). Les bruitages sont synthétisés, les polices viennent
   de `next/font`.

## Store et historique

Toutes les modifications du **projet** passent par `mutate(label, producer)`
dans `store.ts`, qui empile un instantané annulable. Ce qui ne touche pas au
projet — sélection, tête de lecture, réglages d'affichage — passe par `set`
directement : l'inscrire dans l'historique obligerait à annuler plusieurs fois
pour défaire une seule action.

Les libellés listés dans `COALESCING` fondent deux modifications successives
en une (600 ms). N'y ajouter **que** des commandes continues — jauge qu'on fait
glisser, texte qu'on saisit. Un geste discret (découper, dupliquer) doit
toujours s'annuler séparément.

Après toute opération qui raccourcit le montage, passer par `reclamp` : sinon
la tête de lecture se retrouve au-delà de la fin.

## Modifier ce dépôt

- **Chirurgical.** Chaque ligne changée doit se rattacher à la demande. Ne pas
  « améliorer » au passage le code voisin, sa mise en forme, ni ses commentaires
  — surtout pas ses commentaires : les blocs de tête portent la justification
  des décisions, et c'est ce que ce dépôt a de plus précieux. Du code mort sans
  rapport se signale, il ne se supprime pas.
- **Ne nettoyer que ses propres restes** : un import ou une fonction rendus
  inutiles par le changement en cours, rien d'autre.
- **Le minimum qui résout le problème.** Pas d'abstraction pour un seul appel,
  pas de configurabilité qu'on n'a pas demandée, pas de garde contre un cas
  impossible.
- **Dire ses hypothèses**, et s'arrêter pour demander quand deux lectures de la
  demande mènent à deux travaux différents.
- **Nommer la vérification avant d'écrire** : quelle commande dira que c'est
  bon. `npm test` pour ce qui est calculable, `npm run verify` pour le rendu,
  l'audio, l'export et le mobile.

## Conventions de code

- **Français partout** : commentaires, noms d'affichage, messages d'erreur,
  intitulés de tests, messages de commit. Les identifiants de code restent en
  anglais (`clipDuration`, `PlacedClip`), les libellés métier en français
  (`'ajout-plan'`, `'reglage'`).
- **Les commentaires disent pourquoi, pas quoi.** La convention du dépôt est un
  bloc en tête de fichier qui explique la décision de conception, et des
  commentaires ponctuels qui justifient un choix contre-intuitif, souvent avec
  la mesure qui l'a motivé. Ne pas paraphraser le code.
- **Extensions `.ts` explicites dans `src/lib`** pour tout module atteignable
  depuis un test : `npm test` exécute les fichiers directement avec la
  résolution ESM de Node, qui n'invente pas d'extension. Les composants
  utilisent l'alias `@/…` sans extension (résolution du bundler).
- `'use client'` sur les modules qui touchent au navigateur (`audio`, `export`,
  `media`, `renderer`, `store`) et sur tous les composants. Seuls
  `app/layout.tsx` et `app/page.tsx` sont des composants serveur.
- **Tailwind v4** : les couleurs sont des jetons déclarés dans `@theme`
  (`ink`, `slab`, `panel`, `raised`, `edge`, `mist`, `muted`, `accent`…). Pas de
  valeur hexadécimale en dur dans une classe. Le design se fait par **surfaces**
  empilées, pas par contours : une bordure est réservée à ce qui sépare vraiment
  ou à ce qui est sélectionné. L'accent ne désigne qu'une chose : l'action à
  faire, et ce qui va bien.
- **Mobile de plein droit** : cibles tactiles d'au moins 44 px (`min-h-11`),
  `100dvh` et non `100vh`, `env(safe-area-inset-*)` sur les bandeaux, rien de
  superposé à l'aperçu — un panneau flottant masque précisément ce qu'on règle.
- Lire une source extérieure à React avec `useSyncExternalStore`
  (`useMediaQuery.ts`), pas avec un effet + `setState` : la première image
  sortirait dans la mauvaise disposition.
- Les valeurs de l'état initial doivent être identiques côté serveur et côté
  navigateur (voir `effectiveQuality` dans `store.ts`), sinon l'hydratation
  diverge.

## Vérifier

Les tests unitaires (`src/lib/__tests__/`) couvrent ce qui est calculable hors
navigateur : timeline, notation, guidage, étalonnage, sous-titres, paliers de
qualité, store. Ils utilisent `node:test` + `node:assert/strict`, sans
dépendance ajoutée. Les intitulés sont des phrases françaises qui décrivent le
comportement attendu.

L'essentiel du studio — décodage vidéo, mixage, tracé canvas, enregistrement —
ne peut pas être testé ainsi. `scripts/verify.mjs` pilote donc l'application
pour de vrai et contrôle le résultat **sur les pixels et sur le signal sonore**,
pas sur la présence d'éléments dans le DOM :

```bash
npm run fixtures    # une fois : fabrique .fixtures/rushes/
npm run dev         # dans un autre terminal
npm run verify      # profil ordinateur, puis profil téléphone bridé ×4
AMORCE_PROFILE=mobile npm run verify   # un seul profil, pour isoler un défaut
```

Le bridage du processeur sur le profil téléphone n'est pas décoratif : sans
lui, la dégradation automatique de qualité ne se déclencherait jamais sur une
machine de développement. Captures et fichiers exportés atterrissent dans
`.fixtures/captures/`.

Chromium est déjà installé dans cet environnement (`PLAYWRIGHT_BROWSERS_PATH`),
ne pas lancer `playwright install`.

## Pièges connus

- Modifier un poids dans `analysis.ts` change ce que `guide.ts` propose et ce
  que `verify.mjs` attend. Les trois se tiennent.
- `renderFrame` s'arrête au fond noir quand il n'y a aucun clip : poursuivre
  appliquerait le halo à un cadre vide, ce qui étranglait l'import sur
  téléphone.
- Un `<canvas>` redimensionné est vidé et son contexte réinitialisé — d'où le
  cache de `resolveContext`, qui ne redimensionne qu'au changement d'échelle.
- Le canvas ne déclenche pas le chargement d'une police : passer par
  `preloadCaptionFonts` avant tout tracé, sinon le navigateur substitue
  silencieusement une police système.
- `URL.revokeObjectURL` doit accompagner toute suppression de média ou de
  musique (`removeAsset`, `setMusic`).
- L'export MP4 n'existe que sous Chrome et Edge ; ailleurs le fichier sort en
  WebM. Ne pas supposer l'extension.

## Git

Branche de travail : `claude/claude-md-docs-q02dr7`. Messages de commit en
français, à l'infinitif, décrivant l'intention plutôt que le fichier touché —
par exemple « Séparer les trois sources sonores en une table de mixage ».

`AGENTS.md` est réécrit par `next dev` : le committer avec le reste plutôt que
de chercher à le retirer d'un diff.
