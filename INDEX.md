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
| Audit & reprise de code généré par IA | **En cours** | 8/10 | [fiche](projets-actifs/audit-reprise-code-genere-ia.md) | Outillé et éprouvé — reste 20 cibles filtrées sur leur page de tarifs, puis 3 rapports envoyés |
| Amorce Atelier — chaîne complète du rush au film | **Cousu** | — | [fiche](projets-actifs/amorce-atelier.md) | Les dix outils se lancent d'une seule recette — reste l'interface |
| Studio audio (Streamlit) | **En pause** | — | [fiche](archives-backlog/studio-audio.md) | Reprendre si Amorce bute sur la voix off |
| Conseiller Patrimoine | **En cours** | — | [fiche](archives-backlog/assistant-patrimoine.md) | Absorbe l'assistant d'allocation — reste à brancher un accès bancaire AISP |
| Bilan Patrimoine — produit grand public | **En cours** | — | — | Lot 1 livré (calcul + barèmes + texte) — reste le site, les comptes, le suivi |
| Reconnaissance de couleurs | **Faisable** | 9/10 | [fiche](projets-actifs/reconnaissance-de-couleurs.md) | Noyau livré — brique partagée, la suite vit dans Accord |
| Notice, dangerosité et ingrédients | **Faisable** | 8/10 | [fiche](projets-actifs/notice-et-dangerosite-produit.md) | Coller 3 réponses OpenFoodFacts réelles (mandataire bloqué ici) |
| Où a mal mon animal | **En pause** | 5/10 | [fiche](archives-backlog/ou-a-mal-mon-animal.md) | Version sans diagnostic (7/10), ou trouver un vétérinaire relecteur |
| Accord — l'éveil des couleurs | **En cours** | 8/10 | [fiche](projets-actifs/accord.md) | 3 photos de mur cadrées exprès, puis l'écran |
| Ordre de mise en vente | **En cours** | — | [fiche](projets-actifs/ordre-de-mise-en-vente.md) | Questionnaire fiscal KDP : les redevances passent-elles sans SIRET ? |
| Tout seul — tutos pour enfants | **En cours** | 8/10 | [fiche](projets-actifs/tout-seul-tutos-enfants.md) | Couche domaine et corpus de 17 gestes, puis l'écran et la voix |
| Notice d'un appareil ménager | **Faisable** | 7/10 | [fiche](projets-actifs/notice-appareil-menager.md) | Relever les adresses de PDF chez cinq constructeurs — décide de l'issue |
| Mécano — pièce en photo | **En pause** | 5/10 | [fiche](archives-backlog/mecano-photo-piece.md) | Photographier dix pièces réellement déposées et compter les références lisibles |

## Terrain existant (base du critère « Alignement »)

Ce dépôt héberge vingt et un chantiers actifs, plus un en sommeil, et cinq
ressources transverses qui ne sont pas des projets mais servent à tous. Une
idée nouvelle s'évalue aussi à sa capacité à s'y greffer plutôt qu'à ouvrir un
front de plus. La liste vieillit vite — recompter avant de noter.

**« Sans code commun » a été retiré de cette phrase le 06/09/2026 : c'est
faux.** Voir la section « Moteurs techniques partagés » juste en dessous —
deux chantiers au moins portent du code explicitement porté ou copié d'un
autre, et deux paires ont **ré-implémenté la même chose sans le savoir**.

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
| **Conseiller Patrimoine** (`conseiller-patrimoine/`) | Vue d'ensemble du patrimoine et rééquilibrage, en lecture seule stricte. | Python | actif |
| **Bilan Patrimoine** (`bilan-patrimoine/`) | Le produit grand public : diagnostic gratuit puis suivi payant. Lot 1 — calcul, barèmes et texte. | TypeScript | actif |
| **Le Coffre** (`le-coffre/`) | Coffre-fort de documents chiffré côté navigateur, multi-utilisateurs. Productisation du coffre de Life-Organizer. | Next.js 16, Supabase | actif |
| _Studio audio_ (`archives-backlog/mon-app-audio/`) | Outil audio. | Python, Streamlit | en sommeil |

## Moteurs techniques partagés

Écrit le 06/09/2026, à partir d'une recherche sur le code — pas sur la mémoire
de qui a écrit quoi. **Avant de coder un stockage chiffré, une détection
d'échéance, un classement de document par modèle de vision, ou toute autre
brique généraliste, relire ce tableau.** C'est le geste que `/nouveau-projet`
demande désormais, et l'endroit précis où deux sessions ont déjà recodé la
même chose sans se voir — les deux dernières lignes ci-dessous.

| Moteur | Où il vit | Qui s'en sert | État |
| --- | --- | --- | --- |
| Chiffrement + coffre de documents | `life-organizer/modules/coffre/stockage.py` | Porté **sans changement de logique** dans `le-coffre/src/lib/crypto.ts` (Web Crypto API) | Partagé, assumé — c'est la productisation documentée dans `le-coffre/README.md` |
| Charte visuelle des sites artisans | `titan-builder/src/lib/charte.ts` | Copiée dans `artisan-express/`, synchronisation **testée** par `artisan-express/tests/charte.test.ts` | Partagé, gardé par un test — l'écart casse la CI |
| Lettre de résiliation | `paper-manager/core/resiliation.py` (version complète) | `le-coffre/` en tire une version volontairement simplifiée — écart documenté dans son `SECURITY.md` | Divergence **assumée**, pas un doublon à corriger |
| Détection d'échéance | `paper-manager/core/calendrier.py` (CLI, dates lues dans un document scanné) | **Ré-implémentée indépendamment** dans `le-coffre/supabase/functions/classer-document/` (vision, Supabase) | **Deux moteurs, pas un.** Non unifié — voir `second-brain/lecons/` (05/09/2026) |
| Classement d'un document par modèle de vision | `life-organizer/modules/depot/traitement.py` (Python) | **Ré-implémenté indépendamment** dans `le-coffre/supabase/functions/classer-document/` (TypeScript) | **Deux moteurs, pas un** |
| Voix off synthétisée localement, sans réseau | `.claude/skills/bande-son/scripts/voix.py` | Outil de compétence, pas encore un moteur applicatif — réutilisable par tout projet vidéo (`motion/`, `montage-auto/`, Amorce) | Existe, sous-utilisé |

Les deux lignes en gras ne sont pas des fautes à corriger dans l'instant — les
unifier est une décision de produit, pas un geste de ménage — mais elles
doivent rester visibles ici tant que la décision n'est pas prise, pour qu'une
troisième implémentation n'apparaisse pas avant les deux premières d'être
réconciliées.

## Ressources transverses

Ce ne sont pas des chantiers : rien ne s'y « termine ». Ce sont des réserves
dans lesquelles les chantiers puisent.

| Dossier | Ce que c'est |
| --- | --- |
| `second-brain/` | Les leçons payées une fois et réutilisables partout. Voir [`map.md`](second-brain/map.md) pour la règle de tri. |
| `kits/` | Ce qui a marché quelque part et se recopie ailleurs sans réfléchir : gabarits, composants, prompts. |
| `visual_library/` | LUTs, recettes d'étalonnage et catalogues visuels, avec les bins Premiere / DaVinci. |
| `licence-serveur/` | Serveur de licence d'Amorce : trois routes, zéro dépendance. Rattaché à Amorce, pas autonome. |
| `comptes-serveur/` | Comptes et grand livre de crédits pour la génération intégrée d'Amorce. Rattaché à Amorce, pas autonome. |
| `scripts/` | Scripts de vérification et de fixtures pour Amorce à la racine. |

## À faire sur le dépôt lui-même

- `inbox/` est vide (seul un `.gitkeep`) — normal si tout a été trié, à surveiller.
- Le tableau ci-dessus **se recompte désormais tout seul**. Il ne le faisait
  pas, et ça s'est vu deux fois le même jour : `motion/` absent pendant
  plusieurs sessions alors que `CLAUDE.md` le documentait, puis un décompte
  resté à « dix-sept » quand deux chantiers de plus avaient atterri.
  `/coherence-depot` ne lisait que `CLAUDE.md` — il lit maintenant ce tableau
  aussi, et démontre l'écart entre la phrase et les lignes, entre les dossiers
  cités et le disque. Une ligne à ajouter reste un geste humain ; la fausseté,
  elle, ne peut plus passer.
