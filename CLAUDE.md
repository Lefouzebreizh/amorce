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
npm run verify:reprise  # le montage survit-il à un rechargement (dev doit tourner)
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
| `sfx.ts` | Bruitages **synthétisés** en Web Audio, réverbération comprise. Aucun fichier son n'est embarqué. |
| `voice.ts` | Voix off : découpe du signal aux silences, répartition du texte sur les passages parlés, baisse du fond. Pur, testé. |
| `audio.ts` | Mixage des quatre bus (clips / bruitages / musique / voix) et sortie enregistrable. |
| `export.ts` | `MediaRecorder` sur le canvas + le bus audio. Négocie MP4 puis WebM. |
| `quality.ts` | Paliers de prévisualisation, `QualityGovernor` (ajustement) et `PanicDetector` (filet). |
| `analysis.ts` | Note de viralité sur 100 : hook 30, rythme 20, tension 20, sous-titres 15, son 10, format 5. |
| `guide.ts` | Une seule consigne à la fois, ordonnée par ce qui bloque le plus. |
| `autoEdit.ts` | Montage express : un projet complet à partir des seuls rushes. |
| `autoFinish.ts` | Réglages recommandés posés sur un montage **existant** : trames de textes, bruitages, découpe. Ne remplace jamais ce qui est là. |
| `store.ts` | Store Zustand, avec historique annuler/rétablir. |
| `persistence.ts` | Reprise du montage : projet et fichiers rangés dans IndexedDB. Les fonctions de mise en forme sont pures et testées. |
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
   haut-parleurs et `MediaRecorder`. La baisse automatique sous la voix a ses
   propres nœuds, sous les plans et la musique : l'écrire sur le gain des bus
   effacerait le réglage de la table de mixage, et inversement.
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

## Outillage du dépôt (`.claude/`)

Ce dépôt héberge **sept projets sans code commun** : le studio Amorce décrit
ici, l'application Flutter Look & Find dans `look_and_find/` (qui a son propre
`CLAUDE.md`), la chaîne pré-presse KDP en Python dans `kdp/`, le studio audio
Streamlit dans `mon-app-audio/`, l'assistant d'allocation d'actifs dans
`patrimoine/`, la chaîne de montage automatisée dans `montage-auto/` et le
répondeur de commentaires Facebook dans `repondeur-facebook/` (qui ont chacun
leur propre `README.md`). L'outillage ci-dessous existe parce que rien de
générique ne connaît cette particularité.

| Élément | Ce qu'il fait |
| --- | --- |
| `hooks/session-start.sh` | Installe `node_modules`, le SDK Flutter épinglé et les bibliothèques Python de `kdp/`, de `mon-app-audio/`, de `patrimoine/` et de `montage-auto/` au démarrage d'une session distante. Sans lui, chaque session recommence une heure d'installation. |
| `hooks/ligne-etat.sh` | Affiche en permanence la consommation de l'abonnement — fenêtre de cinq heures et fenêtre de sept jours. Les deux, parce que la seconde décide de la fin de semaine et qu'on ne la voit pas venir en ne regardant que la première. |
| `/verifier` | La séquence de vérification du projet touché, et ce qu'elle ne couvre pas. |
| `/custom-frontend-designer` | Où atterrit un écran d'Amorce, quelles briques existent, et les cinq règles de style qui font l'identité de l'interface. |
| `/tailwind-mobile-ux` | Le terrain mobile réel — barre de gestes, hauteur utile, zone du pouce — et les sept parades déjà en place à ne pas défaire. |
| `/kdp-niche-validator` | Décider si un mot-clé KDP mérite un livre, avec `kdp/kdp_niche_validator.py`. |
| `/kdp-thumbnail-validator` | Contrôler qu'une couverture reste lisible en vignette de boutique, avec `kdp/vignette.py`. |
| `/fonctionnalite-flutter` | Où poser chaque fichier dans Look & Find, et les quatre pièges qui coûtent une heure. |
| `/charte-editoriale` | La voix de l'auteur pour tout texte destiné à son public, les tournures qui trahissent une écriture automatique, et ce qu'on ne rédige jamais à sa place. |
| `/repondeur-facebook` | Ce que le répondeur publie en public au nom de quelqu'un : les huit invariants, les pièges de l'API Graph, le rythme humain et les contraintes du téléphone. |
| `/steward` | Conventions pour mener une PR : style des commits, barrière de vérification, diagnostic des échecs d'intégration continue. |
| `/debogage-systematique` | La cause avant le correctif : quelle commande reproduit vraiment le défaut selon le projet, et les pièges déjà consignés à relire d'abord. |
| `/extraction-multiformat` | Lire un fichier non textuel — image et EXIF, EPUB, archive, binaire inconnu — en sondant d'abord ses octets de tête, parce que l'extension ment. |
| `/transcription-media` | Ouvrir une vidéo ou un audio : fiche technique, piste sonore, images clés, transcription locale de la parole. |
| Agent `revue-invariants` | Relit un diff contre les invariants **écrits** — pas les bugs génériques. |
| Agent `verificateur` | Lance la vérification et ne rend qu'un verdict, sans déverser la sortie des tests. |

Le hook n'agit que sur une session distante (`CLAUDE_CODE_REMOTE`) : sur un
poste de développement, le SDK appartient à son propriétaire.

Un plugin extérieur est déclaré dans `.claude/settings.json` :
`frontend-design`, publié par Anthropic. Il recoupe `/custom-frontend-designer`
sans le remplacer — **sur `src/`, c'est celui du dépôt qui prime**, parce qu'il
porte les règles d'identité d'Amorce là où le plugin vise une esthétique
générique. Le plugin reste utile partout ailleurs.

Deux règles qui découlent de la cohabitation :

- **Une modification ne touche qu'un seul projet**, sauf configuration à la
  racine qui doit connaître ses voisins — c'est le cas d'`eslint.config.mjs`,
  qui ignore `look_and_find/**`, faute de quoi ESLint analyse les milliers de
  fichiers JavaScript générés par le SDK Flutter.
- La version de Flutter est épinglée **au même numéro** dans le hook et dans
  `.github/workflows/look-and-find.yml`. Les faire diverger, c'est fabriquer un
  « ça passe chez moi ».

## Vérifier

Les tests unitaires (`src/lib/__tests__/`) couvrent ce qui est calculable hors
navigateur : timeline, notation, guidage, étalonnage, sous-titres, paliers de
qualité, store. Ils utilisent `node:test` + `node:assert/strict`, sans
dépendance ajoutée. Les intitulés sont des phrases françaises qui décrivent le
comportement attendu.

L'essentiel du studio — décodage vidéo, mixage, tracé canvas, enregistrement,
reprise après rechargement — ne peut pas être testé ainsi. `scripts/verify.mjs` pilote donc l'application
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

`npm run verify:reprise` couvre à part ce que le parcours principal ne peut pas
faire sans se réinitialiser : importer, recharger la page, et vérifier que le
montage revient — puis le **lire**, parce qu'un projet restauré dont les liens
pointent dans le vide s'affiche normalement et sort noir.

Chromium est déjà installé dans cet environnement (`PLAYWRIGHT_BROWSERS_PATH`),
ne pas lancer `playwright install`.

## Pièges connus

- Modifier un poids dans `analysis.ts` change ce que `guide.ts` propose et ce
  que `verify.mjs` attend. Les trois se tiennent — redistribuer la note « son »
  vers la voix off a déplacé la note de référence du parcours de 87 à 86.
- La note « son » compte les bruitages **de synthèse et importés ensemble** :
  l'oreille ne les distingue pas, et n'en retenir qu'une sorte notait à zéro un
  montage entièrement ponctué de fichiers déposés.
- `captionCoverage` écarte les sous-titres sans texte. Les emplacements vides
  posés par « Poser les réglages » disent **où** il reste à écrire ; les compter
  comme couverts noterait un écran resté vide.
- `autoFinish` ajoute, il ne remplace pas. Un sous-titre déjà calé sur une voix
  off représente un travail que personne n'accepterait de perdre en touchant un
  bouton nommé « recommandé ».
- `renderFrame` s'arrête au fond noir quand il n'y a aucun clip : poursuivre
  appliquerait le halo à un cadre vide, ce qui étranglait l'import sur
  téléphone.
- Un `<canvas>` redimensionné est vidé et son contexte réinitialisé — d'où le
  cache de `resolveContext`, qui ne redimensionne qu'au changement d'échelle.
- Le canvas ne déclenche pas le chargement d'une police : passer par
  `preloadCaptionFonts` avant tout tracé, sinon le navigateur substitue
  silencieusement une police système.
- `URL.revokeObjectURL` doit accompagner toute suppression de média, de musique
  ou de voix (`removeAsset`, `setMusic`, `removeVoice`, `removeSample`).
- La reprise se relit **après** le montage du composant, jamais dans l'état
  initial : le serveur et le navigateur doivent partir des mêmes valeurs, sinon
  la première image sort dans la mauvaise disposition. Elle s'abandonne aussi
  si l'utilisateur a importé quelque chose entre-temps.
- Un lien objet enregistré ne vaut rien à la relecture. `persistence.ts` les
  vide au rangement et les recrée au retour ; conserver l'ancien produirait une
  image noire sans le moindre message.
- La reprise n'est pas une sauvegarde : un navigateur efface ce qu'on lui a
  confié quand il manque de place. Ce qui perd son fichier est retiré du projet,
  et les plans qui en dépendaient avec — un plan orphelin donnerait un montage
  qui s'ouvre normalement et se révèle vide à la lecture.
- Un grave en sinus pur n'existe pas sur un téléphone : un haut-parleur ne
  restitue rien sous ~400 Hz. Tout bruitage qui descend plus bas doit être
  doublé de ses harmoniques (`impact` dans `sfx.ts`), sans quoi il est
  simplement absent de l'appareil où le format court est regardé.
- Les deux couches d'un impact se **partagent** le niveau demandé. Les faire
  s'additionner ferait grimper la crête, et le limiteur commun, en l'écrasant,
  ferait pomper tout le mixage à chaque frappe.
- L'export MP4 n'existe que sous Chrome et Edge ; ailleurs le fichier sort en
  WebM. Ne pas supposer l'extension.

## Git

Branche de travail : `claude/claude-md-docs-q02dr7`. Messages de commit en
français, à l'infinitif, décrivant l'intention plutôt que le fichier touché —
par exemple « Séparer les trois sources sonores en une table de mixage ».

`AGENTS.md` est réécrit par `next dev` : le committer avec le reste plutôt que
de chercher à le retirer d'un diff.
