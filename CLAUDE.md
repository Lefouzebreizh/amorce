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
3. **Un élément `<video>` par clip, pas par média — et six au plus à la fois.**
   Deux clips peuvent découper le même rush et se chevaucher ; un élément
   partagé ne peut pas être à deux positions de lecture à la fois. Mais leur
   nombre est borné à `DECODEURS_MAX`, un navigateur Android n'accordant que six
   à huit décodeurs : au-delà, les plans en trop ne produisent aucune image et
   l'export sort noir sans erreur. `ClipVideoPool.sync` ne garde donc chargés
   que les plans proches de la tête de lecture, et rend les identifiants
   retenus — que la boucle de rendu répercute sur le graphe audio, faute de quoi
   un plan dont l'élément a été recréé reviendrait muet.
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

## Rythme de travail

Le propriétaire du dépôt travaille depuis un téléphone, souvent par messages
courts. Trois règles en découlent, et elles priment sur la prudence par défaut :

- **Décider plutôt que demander.** Devant deux options techniques défendables,
  prendre la meilleure, l'appliquer, et **dire laquelle et pourquoi** en une
  ligne. Une question posée coûte un aller-retour ; une décision annoncée se
  corrige d'un mot. Ne s'arrêter que si les deux lectures mènent à deux travaux
  entièrement différents.
- **Mener les PR de bout en bout.** Ouvrir la pull request, la vérifier, la
  faire passer au vert et la fusionner sans attendre qu'on le demande. Les
  branches de ce dépôt touchent presque toutes au hook de démarrage et à ce
  fichier : chaque jour d'attente ajoute un conflit à résoudre.
- **Passer le relais avant que le fil ne pèse.** Une conversation longue est
  relue en entier à chaque message, captures d'écran comprises : elle finit par
  coûter plus cher que le travail qu'elle porte. Dès qu'un fil change de sujet
  ou s'alourdit, créer la session suivante avec un résumé de reprise, archiver
  la précédente, et donner son nom. La mémoire du projet est dans ce fichier et
  dans les compétences, pas dans la discussion — on ne perd rien.

Ce qui reste à demander, et qu'aucune de ces trois règles ne couvre : ce qui
part **en public au nom de quelqu'un** (un commentaire publié, un message à la
communauté), ce qui **détruit** sans retour, et ce qui **engage de l'argent**.
Là, l'aller-retour vaut son prix.

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

Ce dépôt héberge **dix projets sans code commun** : le studio Amorce décrit
ici, l'application Flutter Look & Find dans `look_and_find/` (qui a son propre
`CLAUDE.md`), la chaîne pré-presse KDP en Python dans `kdp/`, la chaîne de
montage automatisée dans `montage-auto/`, le
répondeur de commentaires Facebook dans `repondeur-facebook/`, l'assistant de
rangement Life-Organizer dans `life-organizer/`, l'assistant administratif
Paper-Manager dans `paper-manager/`, l'annuaire d'outils IA dans `annuaire-ia/`
et le socle de production livré aux clients dans `agence/` (qui ont chacun leur propre `README.md`) — plus un volet sans
code, `tiktok/`, où se travaillent les concepts et les scripts avant tout
montage. Deux chantiers sont **en sommeil** sous `archives-backlog/` : le studio
audio Streamlit (`mon-app-audio/`) et l'assistant d'allocation d'actifs
(`patrimoine/`), avec leur code, leurs tests verts et leur condition de reprise
— mis de côté, pas abandonnés. L'outillage ci-dessous existe parce que rien de
générique ne connaît cette particularité.

`agence/` est un projet Next.js complet — Supabase, authentification, RLS — et
non un dossier d'Amorce : ses propres `package.json`, `tsconfig.json` et
`eslint.config.mjs`, ses propres `node_modules`, et l'alias `@/…` pointe vers
`agence/src/`. Il se vérifie depuis son dossier (`npm run lint`,
`npm run typecheck`, `npm test`, `npm run build`, plus `npm run test:rls` pour
les politiques de sécurité), jamais depuis la racine — d'où son exclusion de
l'ESLint et du `tsconfig.json` de la racine. Son intégration continue vit dans
`.github/workflows/agence.yml`.

| Élément | Ce qu'il fait |
| --- | --- |
| `hooks/session-start.sh` | Installe, au démarrage d'une session distante : les `node_modules` d'Amorce et d'`agence/`, le SDK Flutter épinglé, les bibliothèques Python de `kdp/`, `montage-auto/`, `repondeur-facebook/`, `life-organizer/`, `tiktok/`, de l'extraction multiformat et des deux chantiers en sommeil sous `archives-backlog/`, plus le Chromium du parcours de vérification. Le script fait foi — cette liste-ci a déjà pris trois projets de retard. Sans lui, chaque session recommence une heure d'installation. |
| `hooks/ligne-etat.sh` | Affiche en permanence la consommation de l'abonnement — fenêtre de cinq heures et fenêtre de sept jours. Les deux, parce que la seconde décide de la fin de semaine et qu'on ne la voit pas venir en ne regardant que la première. |
| `/jauge` | Ce qu'il reste avant d'être bloqué, et ce que ça autorise à lancer maintenant. Relit le dépôt de `hooks/ligne-etat.sh`, seul endroit où Claude Code transmet ces chiffres. |
| `/verifier` | La séquence de vérification du projet touché, et ce qu'elle ne couvre pas. |
| `/capacites-session` | Ce que cette session-ci sait faire — binaires, bibliothèques, hôtes joignables, modèles — et le repli de ce qui manque. Sondé en une seconde, affiché au démarrage. |
| `/branche-partagee` | De combien la branche a pris du retard, quels commits sont déjà passés dans `main` par une autre session, et quoi faire ensuite. |
| `/custom-frontend-designer` | Où atterrit un écran d'Amorce, quelles briques existent, et les cinq règles de style qui font l'identité de l'interface. |
| `/tailwind-mobile-ux` | Le terrain mobile réel — barre de gestes, hauteur utile, zone du pouce — et les sept parades déjà en place à ne pas défaire. |
| `/kdp-niche-validator` | Décider si un mot-clé KDP mérite un livre, avec `kdp/kdp_niche_validator.py`. |
| `/kdp-thumbnail-validator` | Contrôler qu'une couverture reste lisible en vignette de boutique, avec `kdp/vignette.py`. |
| `/fonctionnalite-flutter` | Où poser chaque fichier dans Look & Find, et les quatre pièges qui coûtent une heure. |
| `/idee-faisabilite` | La grille de notation d'une idée sur 10, le dossier où atterrit sa fiche, et le script qui tient `INDEX.md` à jour. |
| `/audit-code-ia` | Auditer une base de code générée par IA : le relevé mécanique de `scan.py`, les trois défauts qu'aucune expression régulière ne trouve, et le classement par ce qui cassera en premier. |
| `/paper-manager` | Où poser chaque fichier dans l'assistant administratif, la frontière entre ce que l'humain décide et ce que la machine calcule, et les huit pièges qui coûtent un bogue. |
| `/formulaire-pdf` | Remplir un Cerfa avec `paper-manager` : repérer les champs une fois, écrire un plan rejouable, et les cinq pièges du format PDF. |
| `/resilier-un-contrat` | Jusqu'à quand on peut encore partir sans frais, quel texte invoquer, et le courrier prêt à signer. |
| `/charte-editoriale` | La voix de l'auteur pour tout texte destiné à son public, les tournures qui trahissent une écriture automatique, et ce qu'on ne rédige jamais à sa place. |
| `/tiktok` | La ligne éditoriale du volet TikTok, ses huit concepts répétables, les deux seuls dispositifs de tournage et la façon dont un script s'écrit ici. |
| `/repondeur-facebook` | Ce que le répondeur publie en public au nom de quelqu'un : les huit invariants, les pièges de l'API Graph, le rythme humain et les contraintes du téléphone. |
| `/module-life-organizer` | L'ordre d'écriture d'un module Life-Organizer et les quatre pièges du domaine. Amaigrie après banc d'essai : ce que le `README` du projet dit déjà en a été retiré. |
| `/bande-son` | Monter la bande-son d'une vidéo et la sortir à la loudness de la plateforme visée. Outillé par `sonometre.py` et `monter.py`. |
| `/cadrage-brief-client` | Transformer le brief d'un client en périmètre écrit : questionnaire, lecture des réponses, schéma, lots, estimation. S'arrête avant le code. |
| `/stack-agence-supabase` | Où partir pour un projet client — le socle `agence/`, déjà écrit — et les deux règles qu'il ne fait pas respecter seul. Amaigrie : ce que son `README` dit déjà en a été retiré. Hors Amorce. |
| `/dependance-indisponible` | Livrer quand la clé, le GPU, le logiciel ou le réseau manquent : l'échelle de repli, les quatre choses qui transforment une absence visible en défaut invisible, et ce qu'on écrit en rendant le travail. |
| `/api-tierce-verifiee` | Lire la surface réelle d'une bibliothèque avant d'écrire contre elle, et provoquer l'erreur pour connaître sa vraie classe — ce qui a attrapé un `except` qui n'attrapait rien. |
| `/relais` | Clore un fil devenu lourd sans rien perdre : l'état se rassemble depuis le dépôt, jamais de mémoire. |
| `/steward` | Conventions pour mener une PR : style des commits, barrière de vérification, diagnostic des échecs d'intégration continue. |
| `/debogage-systematique` | La cause avant le correctif : quelle commande reproduit vraiment le défaut selon le projet, et les pièges déjà consignés à relire d'abord. |
| `/debloquer` | Ce qui arrête une session distante et comment repartir : permission refusée par le classificateur, mandataire réseau qui rend 403, `main` fusionné sous les pieds, suite de tests sortie du champ de la CI. Dit aussi quand s'arrêter et demander. |
| `/extraction-multiformat` | Lire un fichier non textuel — image et EXIF, EPUB, archive, binaire inconnu — en sondant d'abord ses octets de tête, parce que l'extension ment. |
| `/transcription-media` | Ouvrir une vidéo ou un audio : fiche technique, piste sonore, images clés, transcription locale de la parole. |
| `/voir-le-son` | Dessiner un média pour pouvoir le juger : spectrogramme, courbe de sonie, planche de vignettes. Né d'un montage mesuré conforme et pourtant muet sur téléphone — une moyenne dit qu'un son est fort, jamais qu'il est bon. |
| `/prepresse-kdp` | Préparer un livre illustré pour l'impression à la demande : résolution, fond perdu, zone de sécurité, calcul de tranche, boucle de validation. |
| `/retouche-planche` | Corriger au pixel une illustration dont le texte est incrusté, avec la matière de la planche — sans police importée ni régénération. |
| `/roussy-zephy` | La charte du recueil illustré : personnages, palette, mécanique des histoires en quatre temps, gabarit de planche. |
| `/typographie-francaise` | Les règles typographiques françaises pour tout texte qui partira en image ou en impression. |
| `/etat-du-depot` | Qui travaille déjà sur le sujet, et si ce que le dépôt dit de lui-même est encore vrai. Deux scripts qui mesurent au lieu de supposer. |
| Agent `revue-invariants` | Relit un diff contre les invariants **écrits** — pas les bugs génériques. |
| Agent `verificateur` | Lance la vérification et ne rend qu'un verdict, sans déverser la sortie des tests. |

Le hook n'agit que sur une session distante (`CLAUDE_CODE_REMOTE`) : sur un
poste de développement, le SDK appartient à son propriétaire.

Un plugin extérieur est déclaré dans `.claude/settings.json` :
`frontend-design`, publié par Anthropic. Il recoupe `/custom-frontend-designer`
sans le remplacer — **sur `src/`, c'est celui du dépôt qui prime**, parce qu'il
porte les règles d'identité d'Amorce là où le plugin vise une esthétique
générique. Le plugin reste utile partout ailleurs.

Quatre règles qui découlent de la cohabitation :

- **Une modification ne touche qu'un seul projet**, sauf configuration à la
  racine qui doit connaître ses voisins — c'est le cas d'`eslint.config.mjs`,
  qui ignore `look_and_find/**`, faute de quoi ESLint analyse les milliers de
  fichiers JavaScript générés par le SDK Flutter.
- La version de Flutter est épinglée **au même numéro** dans le hook et dans
  `.github/workflows/look-and-find.yml`. Les faire diverger, c'est fabriquer un
  « ça passe chez moi ».
- Les bibliothèques de `.github/requirements-tests.txt` sont **volontairement
  plus courtes** que celles du hook, et il ne faut pas les aligner. Le hook
  prépare une session où l'on *exécute* les programmes, ce qui demande
  streamlit, PyTorch et Whisper ; le fichier de la CI n'installe que ce que les
  *tests* atteignent, mesuré dans un environnement vierge. Recopier la liste du
  hook ferait passer la vérification de quinze secondes à plusieurs minutes sans
  couvrir une assertion de plus. Quand un nouveau test importe une bibliothèque
  absente, la CI le dit en clair et c'est ce fichier-là qu'on complète.
- **Un nouveau projet Python est gardé sans rien déclarer.**
  `.github/workflows/tests-python.yml` découvre les dossiers `tests` contenant
  des `test_*.py`, jusqu'au troisième niveau, au lieu de les énumérer. Sa
  première version en listait cinq et deux projets sont passés au travers le
  jour même ; la deuxième ne regardait que `*/tests` et a cessé de couvrir les
  deux chantiers le jour où ils sont passés sous `archives-backlog/`. Les deux
  fois, la couverture a baissé sans qu'une ligne rouge n'apparaisse : dans ce
  dépôt, ce qui énumère est faux le lendemain, et faux en silence.

## Connecteurs

Les connecteurs ne se déclarent pas dans le dépôt : ils vivent dans le compte
claude.ai et se coupent **par conversation**. Ce qui suit est donc un tri, pas
une configuration — mais un tri qui, faute d'être écrit, se refait à chaque
session.

| Connecteur | Ce qu'il sert |
| --- | --- |
| Adobe | `media_enhance_speech` pour une voix off, `video_metadata` et `video_render_frame` pour la fiche technique d'un rush, les outils de police pour les couvertures KDP, `image_vectorize`. Le plus sous-employé de tous. |
| Gmail | Les factures, les avis d'échéance et les accusés de résiliation de `paper-manager` arrivent là. |
| Google Agenda | Les échéances que calcule le module `calendrier` de Life-Organizer doivent atterrir quelque part. |
| Google Drive | Source de fichiers pour `nettoyer` et `ranger`. |
| Supabase | Le geste le plus répété du socle `agence/` : `apply_migration` pose `schema.sql`, `execute_sql` rejoue `verifier-rls.sql`. Essayé de bout en bout sur un projet neuf — ce qui passe, ce qui ne passe pas et ce que `get_advisors` se trompe à signaler est écrit dans `/stack-agence-supabase`. |

Ce qui ne sert pas — écrit plutôt que simplement éteint, parce qu'un connecteur
se rallume tout seul dans la conversation suivante :

- **Canva** recoupe Adobe sur presque tout et n'apporte rien qu'il n'ait. Deux
  outils pour le même geste, c'est un choix à refaire à chaque fois.
- **Indeed** n'a de rapport avec aucun des projets.
- **Notion** et **Airtable** feraient un second endroit où vit la mémoire du
  projet. Elle est dans ce fichier, dans `INDEX.md`, dans `inbox/` et dans les
  compétences ; en ouvrir un deuxième, c'est garantir que dans trois mois
  personne ne saura plus lequel fait foi.
- **Vercel** attendra un déploiement réel : `agence/README.md` dit « n'importe
  quel hébergeur Node ou Vercel », et rien n'y est déployé.

Un cas à part, qui n'est ni un connecteur ni un manque :

- **GitHub passe par un serveur MCP**, et c'est par lui qu'une session distante
  ouvre ses PR : les outils `mcp__github__*` (`create_pull_request`,
  `merge_pull_request`, la lecture des contrôles d'intégration continue).
  Mesuré, pas supposé — la PR #69 a été ouverte, suivie et fusionnée sans jamais
  toucher l'interface de la session.

  Ce qui ne marche pas, et qui figurait ici comme un verrou général alors que
  ce n'en est pas un : appeler `api.github.com` **en direct**, au `curl` ou par
  la commande `gh`. `POST /repos/…/pulls` répond alors `403 GitHub access is not
  enabled for this session`, quand bien même l'application GitHub de Claude est
  installée sur le compte avec l'écriture sur les demandes d'extraction, et que
  `git push` passe. Le jeton n'est pas dans l'environnement, il est derrière le
  serveur MCP. Ne pas conclure de ce 403 que la voie est fermée, et ne pas
  repartir en chasse dans les réglages : c'est l'outil employé qu'il faut
  changer, pas la configuration.

Et une règle de permissions, écrite dans `.claude/settings.json` plutôt que
réaccordée à chaque session : les outils Supabase qui **lisent** y sont
autorisés d'office, `execute_sql` et `apply_migration` **non**. Ces deux-là
écrivent dans une vraie base, et sur le geste dont l'erreur est une faille
plutôt qu'un bogue, une demande de confirmation vaut son aller-retour. La liste
est écrite sur le nom `Supabase` ; ce connecteur est apparu sous deux noms dans
une même session, l'autre étant un identifiant opaque, et lequel des deux tient
d'une session à l'autre reste à mesurer.

## Les compétences, mesurées plutôt que supposées

Les compétences de `.claude/skills/` ne se marchent pas dessus : mesuré sur
leurs descriptions, le recoupement le plus fort est de 0,14, et les paires qui
se croisent négocient déjà leur frontière par écrit — `/extraction-multiformat`
renvoie explicitement à `/transcription-media` pour la parole, `/tiktok` renvoie
à `/charte-editoriale` pour le ton. Il n'y a rien à dédoublonner entre elles.

Restait un soupçon : les compétences **générales** que Claude apporte ont des
descriptions volontairement larges — la générale `pdf` annonce couvrir le
remplissage de formulaires, ce que `/formulaire-pdf` fait ici avec l'outillage
de `paper-manager`. Sur le papier, les deux répondent à « remplis ce Cerfa ».

**Essayé, et le soupçon est faux.** Deux phrases posées à un `claude -p` lancé
dans ce dépôt, avec la vraie liste de compétences :

| Ce qu'on tape | Ce qui se déclenche |
| --- | --- |
| « j'ai le cerfa 15646*01 […] tu peux me le remplir ? » | `/formulaire-pdf` |
| « regarde rush-03.mp4 […] dis-moi ce qui se dit dedans » | `/transcription-media` |

Celle du dépôt gagne dans les deux cas, sans qu'on ait rien à écrire. Une
description précise et ancrée sur des projets nommés l'emporte sur une
description large : c'est ce que fait déjà chaque description d'ici, et c'est la
raison de ne pas les raccourcir.

Cela ne rend pas la règle inutile, cela la remet à sa place — un départage pour
le jour où ce ne sera pas évident, pas la réparation d'un défaut constaté :
**sur un formulaire administratif, un média local ou un texte destiné à son
public, c'est celle du dépôt qui prime.** La générale connaît le format, celle
du dépôt connaît le projet.

Et une mise en garde qui vaut plus que la règle : **cette page-là se mesure, elle
ne se relit pas.** Le soupçon ci-dessus était solide à la lecture des deux
descriptions, et faux à l'essai. Deux minutes de `claude -p` ont tranché ce
qu'un après-midi de raisonnement aurait mal tranché.

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
ne pas lancer `playwright install`. Sa révision n'est pas celle que Playwright
attend, d'où `AMORCE_CHROMIUM=/opt/pw-browsers/chromium`, que `fixtures` et
`verify` acceptent tous les deux — le hook de démarrage la pose désormais dans
les sessions distantes, mais un `playwright install` réclamé signifie qu'elle
manque.

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

Une branche `claude/…` par sujet. Messages de commit en français, à
l'infinitif, décrivant l'intention plutôt que le fichier touché — par exemple
« Séparer les trois sources sonores en une table de mixage ».

Les PR se mènent de bout en bout (voir « Rythme de travail »), et se fusionnent
par commit de fusion, comme le reste de l'historique.

**Partir de `main` à jour, et le revérifier avant d'ouvrir.** Ce dépôt reçoit
plusieurs sessions en parallèle : deux branches y ont construit Life-Organizer
chacune de son côté, et la seconde a dû être refaite. Ce qui est fusionné gagne,
toujours — se couler dans la base commune coûte moins cher que réconcilier deux
architectures.

`AGENTS.md` est réécrit par `next dev` : le committer avec le reste plutôt que
de chercher à le retirer d'un diff.
