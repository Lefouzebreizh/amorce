# INDEX — idées et projets

Tableau de bord unique. Toute idée entre par `/inbox/`, ressort en
`/projets-actifs/` (validée, fiche d'exécution écrite) ou en
`/archives-backlog/` (bonne, mais pas maintenant).

## Statuts

| Statut | Sens |
| --- | --- |
| **En cours** | Fiche écrite, exécution commencée. |
| **Faisable** | Score ≥ 6/10, fiche écrite, pas encore démarrée. |
| **En pause** | Score correct mais bloquée (temps, budget, dépendance). |
| **À trier** | Idée brute dans `/inbox/`, pas encore notée. |

## Idées

| Idée | Statut | Score | Fiche | Prochain pas |
| --- | --- | --- | --- | --- |
| Producteur de formats courts IA | **En pause** | 7/10 | [fiche](archives-backlog/producteur-formats-courts-ia.md) | Reprendre si un prospect demande spontanément |
| Audit & reprise de code généré par IA | **Faisable** | 8/10 | [fiche](projets-actifs/audit-reprise-code-genere-ia.md) | 1 audit gratuit d'une page, envoyé non sollicité (< 48 h) |
| Amorce Atelier — chaîne complète du rush au film | **Cousu** | — | [fiche](projets-actifs/amorce-atelier.md) | Les dix outils se lancent d'une seule recette — reste l'interface |
| Studio audio (Streamlit) | **En pause** | — | [fiche](archives-backlog/studio-audio.md) | Reprendre si Amorce bute sur la voix off |
| Conseiller Patrimoine | **En cours** | — | [fiche](archives-backlog/assistant-patrimoine.md) | Absorbe l'assistant d'allocation — reste à brancher un accès bancaire AISP |
| Reconnaissance de couleurs | **Faisable** | 9/10 | [fiche](projets-actifs/reconnaissance-de-couleurs.md) | Noyau livré — brique partagée, la suite vit dans Accord |
| Notice, dangerosité et ingrédients | **Faisable** | 8/10 | [fiche](projets-actifs/notice-et-dangerosite-produit.md) | Coller 3 réponses OpenFoodFacts réelles (mandataire bloqué ici) |
| Où a mal mon animal | **En pause** | 5/10 | [fiche](archives-backlog/ou-a-mal-mon-animal.md) | Version sans diagnostic (7/10), ou trouver un vétérinaire relecteur |
| Accord — l'éveil des couleurs | **En cours** | 8/10 | [fiche](projets-actifs/accord.md) | 3 photos de mur cadrées exprès, puis l'écran |
| Ordre de mise en vente | **En cours** | — | [fiche](projets-actifs/ordre-de-mise-en-vente.md) | Questionnaire fiscal KDP : les redevances passent-elles sans SIRET ? |
| Tout seul — tutos pour enfants | **En cours** | 8/10 | [fiche](projets-actifs/tout-seul-tutos-enfants.md) | Couche domaine et corpus de 17 gestes, puis l'écran et la voix |
| Notice d'un appareil ménager | **Faisable** | 7/10 | [fiche](projets-actifs/notice-appareil-menager.md) | Relever les adresses de PDF chez cinq constructeurs — décide de l'issue |
| Mécano — pièce en photo | **En pause** | 5/10 | [fiche](archives-backlog/mecano-photo-piece.md) | Photographier dix pièces réellement déposées et compter les références lisibles |

## Terrain existant (base du critère « Alignement »)

Ce dépôt héberge dix-sept chantiers actifs sans code commun, plus deux en sommeil,
et cinq ressources transverses qui ne sont pas des projets mais servent à tous.
Une idée nouvelle s'évalue aussi à sa capacité à s'y greffer plutôt qu'à ouvrir
un front de plus. La liste vieillit vite — recompter avant de noter.

| Chantier | Ce que c'est | Pile | État |
| --- | --- | --- | --- |
| **Amorce** (racine) | Studio de montage vertical pour rushes IA, 100 % navigateur. | Next.js 15, React 19, Tailwind v4 | actif |
| **Look & Find** (`look_and_find/`) | Application mobile de scan / recherche. | Flutter, Riverpod 3 | actif |
| **Chaîne KDP** (`kdp/`) | Pré-presse de couvertures et validation de niches. | Python | actif |
| **Socle Agence** (`agence/`) | Socle de production livré aux clients. | Next.js 16, Supabase | actif |
| **Artisan Express** (`artisan-express/`) | Page de vente du site vitrine artisan à 300 €. | Next.js 16, Tailwind v4 | actif |
| **Paper-Manager** (`paper-manager/`) | Assistant administratif : scan, échéances, résiliations. | Python | actif |
| **Life-Organizer** (`life-organizer/`) | Rangement de fichiers personnels. | Python | actif |
| **Répondeur Facebook** (`repondeur-facebook/`) | Réponses aux commentaires via l'API Graph. | Python | actif |
| **Chaîne de montage** (`montage-auto/`) | Montage automatisé. | Python | actif |
| **Habillages animés** (`motion/`) | Titres, cartons et logos verticaux, rendus puis posés dans CapCut. | Remotion 4, React 19 | actif |
| **Volet TikTok** (`tiktok/`) | Concepts et scripts, sans code. | — | actif |
| **Annuaire IA** (`annuaire-ia/`) | Annuaire et comparateur d'outils IA, affiliation. | HTML, Tailwind CDN, JS natif | actif |
| **IPTV / VOD** (`iptv/`) | Gestion et lecture de listes IPTV : direct, films, séries. | TypeScript, sans dépendance | actif |
| **Hypersensible & Bienveillance** (`hypersensible-bienveillance/`) | Deux outils gratuits pour hypersensibles, plus un radar des prix. | Astro, Cloudflare Workers, Tailwind | actif |
| **NexusCrypto** (`nexuscrypto/`) | Moteur d'investissement crypto autonome à DCA dynamique. | Python | actif |
| **Pépites** (`pepites/`) | Radar multi-chaînes de jetons en phase d'accumulation. | Python | actif |
| **Traducteur de chat** (`chat-traducteur/`) | Miaulement enregistré → intention probable, habillée pour le partage. | Python, YAMNet TFLite | actif |
| **Titan Builder** (`titan-builder/`) | Plateforme où le client configure son site en cinq étapes. | Web | actif |
| _Studio audio_ (`archives-backlog/mon-app-audio/`) | Outil audio. | Python, Streamlit | en sommeil |
| **Conseiller Patrimoine** (`conseiller-patrimoine/`) | Vue d'ensemble du patrimoine et rééquilibrage, en lecture seule stricte. | Python | actif |

## Ressources transverses

Ce ne sont pas des chantiers : rien ne s'y « termine ». Ce sont des réserves
dans lesquelles les chantiers puisent.

| Dossier | Ce que c'est |
| --- | --- |
| `second-brain/` | Les leçons payées une fois et réutilisables partout. Voir [`map.md`](second-brain/map.md) pour la règle de tri. |
| `kits/` | Ce qui a marché quelque part et se recopie ailleurs sans réfléchir : gabarits, composants, prompts. |
| `visual_library/` | LUTs, recettes d'étalonnage et catalogues visuels, avec les bins Premiere / DaVinci. |
| `licence-serveur/` | Serveur de licence d'Amorce : trois routes, zéro dépendance. Rattaché à Amorce, pas autonome. |
| `scripts/` | Scripts de vérification et de fixtures pour Amorce à la racine. |

## À faire sur le dépôt lui-même

- `inbox/` est vide (seul un `.gitkeep`) — normal si tout a été trié, à surveiller.
- Le tableau ci-dessus ne se recompte pas tout seul : `motion/` y a manqué le
  temps de plusieurs sessions alors que `CLAUDE.md` le documentait déjà.
  `/coherence-depot` ne le voit pas non plus — il vérifie les compétences
  citées, pas les chantiers listés. Confronter la liste à
  `/etat-du-depot` avant de s'y fier.
