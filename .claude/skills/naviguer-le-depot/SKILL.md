---
name: naviguer-le-depot
description: Trouver vite le bon fichier dans ce dépôt à onze projets sans noyer le contexte — quel projet répond à quelle demande, quels dossiers ne jamais parcourir (les deux arborescences node_modules, le SDK Flutter, les fixtures, les chantiers en sommeil), et par quel fichier commencer selon la question. À utiliser au début d'une tâche dont on ne sait pas encore où elle atterrit, quand une recherche renvoie des centaines de résultats, quand on hésite entre deux projets, ou dès qu'une demande dit « où est », « trouve », « cherche dans le code », « c'est où que », sans nommer de fichier.
---

# Onze projets, aucun code commun

```
/                 studio Amorce (Next.js, TypeScript) — src/, scripts/, racine
agence/           socle de production client (Next.js + Supabase) — projet à part entière
look_and_find/    application Flutter Look & Find
kdp/              chaîne pré-presse Amazon KDP (Python)
life-organizer/   assistant de rangement de fichiers personnels (Python)
paper-manager/    assistant administratif : formulaires, échéances, résiliations
montage-auto/     chaîne de montage vidéo automatisée (Python)
repondeur-facebook/  répondeur de commentaires (Python)
pepites/          radar de pépites crypto multi-chaînes (Python)
tiktok/           volet sans code : concepts et scripts
archives-backlog/ chantiers en sommeil — mon-app-audio/, patrimoine/
```

`agence/` n'est pas un dossier d'Amorce : ses propres `package.json`,
`node_modules` et `eslint.config.mjs`, et son alias `@/…` pointe vers
`agence/src/`. Tout s'y fait depuis son dossier.

Une demande touche **un** projet. Le premier travail est de savoir lequel — s'y
tromper coûte plus qu'une recherche lente, parce qu'on trouve alors des choses
vraies dans le mauvais endroit.

| La demande parle de… | Le projet | Par où commencer |
| --- | --- | --- |
| montage, rushes, sous-titres, export, transitions, viralité, étalonnage | Amorce | `src/lib/types.ts`, puis la table de `/CLAUDE.md` |
| écran, panneau, couleur, mobile, tactile | Amorce | `/custom-frontend-designer`, `/tailwind-mobile-ux`, `/usine-a-themes` |
| client, devis, Supabase, RLS, Server Action, tableau de bord | socle agence | `agence/README.md`, `/stack-agence-supabase` |
| scan, caméra, réalité augmentée, Riverpod, APK | Look & Find | `look_and_find/CLAUDE.md` |
| couverture, vignette, PDF, imprimeur, Amazon, niche | KDP | `kdp/README.md`, `/kdp-thumbnail-validator` |
| ranger, trier, dédoublonner, photos, abonnements | Life-Organizer | `/module-life-organizer` |
| Cerfa, formulaire, échéance, résiliation, préavis | Paper-Manager | `/paper-manager`, `/formulaire-pdf` |
| commentaire Facebook, API Graph, modération | répondeur | `/repondeur-facebook` |
| accroche, script, concept, format court, Reels | volet TikTok | `/tiktok` |
| jeton, blockchain, DexScreener, rugpull, liquidité, alerte Telegram | radar crypto | `pepites/README.md`, `/radar-crypto` |
| voix, bruitage, mixage, Whisper, Streamlit | **en sommeil** | `archives-backlog/mon-app-audio/` — lire sa condition de reprise avant d'y toucher |

## Ne jamais parcourir

Ces dossiers représentent l'écrasante majorité des fichiers du dépôt et
**aucune** ligne écrite ici :

- `node_modules/` — **les deux**, celui de la racine et celui d'`agence/`.
  Des dizaines de milliers de fichiers chacun.
- `look_and_find/` **quand on cherche du JavaScript** : le SDK Flutter y dépose
  des milliers de fichiers générés. C'est exactement la raison pour laquelle
  `eslint.config.mjs` l'ignore ; une recherche qui ne l'ignore pas rapporte des
  centaines de faux résultats et coûte le contexte qu'on voulait économiser.
- `*.g.dart` — généré par `build_runner`. Ce qu'on y trouve est le reflet d'une
  annotation ailleurs ; c'est la source qu'il faut modifier.
- `.fixtures/`, `.travail/`, `pepites/donnees/` — rushes de test, plans de
  travail, base SQLite. Non versionnés, sans intérêt pour comprendre le code.
- `archives-backlog/` — **sauf si la demande porte dessus**. Deux chantiers mis
  de côté, avec leurs tests verts : les fouiller par défaut fait trouver des
  réponses vraies pour du code qu'on ne touche plus.

En pratique : restreindre la recherche au dossier du projet visé (`src/`,
`pepites/`, `kdp/`…) plutôt que de filtrer après coup. Un `glob` bien posé
remplace dix résultats à écarter.

## Par où entrer selon la question

- **« Comment ça marche ? »** → le `README.md` du projet, puis son `CLAUDE.md`
  s'il en a un. Ils sont écrits pour ça et coûtent moins qu'un parcours de
  fichiers.
- **« Où se décide X ? »** → dans Amorce, la table de `src/lib` dans
  `/CLAUDE.md` nomme le rôle de chaque module. Dans le radar crypto, la table
  de `/radar-crypto` fait la même chose.
- **« Pourquoi c'est écrit comme ça ? »** → le bloc de commentaire en tête du
  fichier. C'est la convention du dépôt et c'est ce qu'il a de plus précieux :
  la justification y est, pas dans l'historique git.
- **« Ça casse quoi si je change ça ? »** → la liste d'invariants du projet, et
  l'agent `revue-invariants` pour la confronter à un diff.
- **Un symptôme plutôt qu'une tâche** → `/debogage-systematique`, qui dit
  d'abord quelle commande reproduit vraiment le défaut selon le projet.

## Économiser sans s'aveugler

Lire un extrait suffit pour localiser ; il ne suffit pas pour juger. Deux cas
demandent le fichier entier, et les sauter fait perdre bien plus que le contexte
gagné :

- **Avant de modifier** un fichier dont le bloc de tête porte une décision — la
  modification peut invalider la justification, et un commentaire devenu faux
  coûte plus cher qu'un commentaire absent.
- **Quand un invariant est en jeu**, parce qu'il se casse souvent par ce qui a
  été **retiré**, et qu'un diff ne montre pas ce qui manque autour.

Pour une recherche large dont on ne veut que la conclusion — « quels fichiers
touchent au mixage audio ? » — déléguer à un sous-agent d'exploration rend la
réponse sans ramener les fichiers dans la conversation.
