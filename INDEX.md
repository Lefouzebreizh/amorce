# INDEX — idées et projets

Tableau de bord unique. Toute idée entre par `/inbox/`, ressort en
`/projets-actifs/` (validée, fiche d'exécution écrite) ou en
`/archives-backlog/` (bonne, mais pas maintenant).

**`/inbox/` sert aussi de boîte aux lettres entre sessions depuis le
06/09/2026** — voir `inbox/README.md`, qui fait foi pour cet usage-là. Les deux
contenus se distinguent à l'œil et sans convention de nom : **un message porte
un en-tête `## [AAAA-MM-JJ HH:MM] De : …`, une idée non.** Un message se vide
quand le projet destinataire l'a lu ; une idée se note sur dix puis ressort.
Une session de tri qui rencontre un en-tête `De :` passe son chemin.

## Une session qui démarre : trois lectures, dans cet ordre

Posé le 11/09/2026, à la demande du propriétaire, après un audit de processus.
Plusieurs sessions travaillent ce dépôt en parallèle et ne se voient pas : la
première cause de travail perdu n'est pas une erreur de code, c'est une session
qui **devine** dans quel dossier elle est et ce qui s'y est déjà passé.

1. **`inbox/<projet>.md`** — ce qu'une autre session a laissé pour celle-ci.
   Chaque chantier du tableau « Terrain existant » plus bas a désormais le
   sien ; un fichier qui dit « aucun message en attente » est une réponse, pas
   un trou. Format et règles dans [`inbox/README.md`](inbox/README.md).
2. **Le tableau « Terrain existant »** de cette page — le dossier exact, la
   pile réelle, le moteur partagé s'il y en a un. La colonne « Moteur partagé »
   dit **avant** d'écrire si la brique qu'on s'apprête à coder existe déjà
   ailleurs ; le tableau « Moteurs techniques partagés » en donne le détail.
3. **Le `CLAUDE.md` du projet**, puis celui de la racine. Chaque chantier porte
   le sien depuis le 11/09/2026 : il rappelle la barre de qualité, la ligne
   `Projet : nom` et le rebase avant PR, puis renvoie à la racine pour tout le
   reste plutôt que de le recopier — une règle écrite à deux endroits diverge au
   premier changement.

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

Ce dépôt héberge vingt-trois chantiers actifs, plus un en sommeil, et dix
ressources transverses qui ne sont pas des projets mais servent à tous. Une
idée nouvelle s'évalue aussi à sa capacité à s'y greffer plutôt qu'à ouvrir un
front de plus. La liste vieillit vite — recompter avant de noter.

**« Sans code commun » a été retiré de cette phrase le 06/09/2026 : c'est
faux.** Voir la section « Moteurs techniques partagés » juste en dessous —
deux chantiers au moins portent du code explicitement porté ou copié d'un
autre, et deux paires ont **ré-implémenté la même chose sans le savoir**.

| Chantier | Ce que c'est | Pile | Moteur partagé | État |
| --- | --- | --- | --- | --- |
| **Amorce** (racine) | Studio de montage vertical pour rushes IA, 100 % navigateur. | Next.js 16.3.2, React 19, Tailwind v4 | `licence-serveur/`, `comptes-serveur/`, `generation-serveur/` | actif |
| **Look & Find** (`look_and_find/`) | Application mobile de scan / recherche. | Flutter, Riverpod 3 | — | actif |
| **Chaîne KDP** (`kdp/`) | Pré-presse de couvertures et validation de niches. | Python | — | actif |
| **Socle Agence** (`agence/`) | Socle de production livré aux clients. | Next.js 16, Supabase | — | actif |
| **Artisan Express** (`artisan-express/`) | Page de vente du site vitrine artisan à 300 €. | Next.js 16, Tailwind v4 | charte de `titan-builder/src/lib/charte.ts`, copiée et tenue par un test | actif |
| **Paper-Manager** (`paper-manager/`) | Assistant administratif : scan, échéances, résiliations. | Python | source de la lettre de résiliation et de la détection d’échéance | actif |
| **Life-Organizer** (`life-organizer/`) | Rangement de fichiers personnels. | Python | source du coffre chiffré et du classement par vision | actif |
| **Moteur administratif** (`moteur-administratif/`) | Moteur partagé de cinq produits personnels : lecture, délais, rédaction, rappels. Aucune règle métier. | Python | **est** le moteur de Le Coffre, Le Dossier, Le Recours, Le Classeur, La Relève | actif |
| **Répondeur Facebook** (`repondeur-facebook/`) | Réponses aux commentaires via l'API Graph. | Python | — | actif |
| **Chaîne de montage** (`montage-auto/`) | Montage automatisé. | Python | — | actif |
| **Habillages animés** (`motion/`) | Titres, cartons et logos verticaux, rendus puis posés dans CapCut. | Remotion 4, React 19 | — | actif |
| **Volet TikTok** (`tiktok/`) | Concepts et scripts, sans code. | — | — | actif |
| **Annuaire IA** (`annuaire-ia/`) | Annuaire et comparateur d'outils IA, affiliation. | HTML, Tailwind CDN, JS natif | gabarit partagé par les onze sites | actif |
| **IPTV / VOD** (`iptv/`) | Gestion et lecture de listes IPTV : direct, films, séries. | TypeScript, sans dépendance | — | actif |
| **Hypersensible & Bienveillance** (`hypersensible-bienveillance/`) | Deux outils gratuits pour hypersensibles, plus un radar des prix. | Astro, Cloudflare Workers, Tailwind | — | actif |
| **NexusCrypto** (`nexuscrypto/`) | Moteur d'investissement crypto autonome à DCA dynamique. | Python | — | actif |
| **Pépites** (`pepites/`) | Radar multi-chaînes de jetons en phase d'accumulation. | Python | — | actif |
| **Traducteur de chat** (`chat-traducteur/`) | Miaulement enregistré → intention probable, habillée pour le partage. | Python, YAMNet TFLite | noyau Python porté en TypeScript dans `web/`, tenu par des témoins | actif |
| **Titan Builder** (`titan-builder/`) | Plateforme où le client configure son site en cinq étapes. | Web | source de la charte artisan | actif |
| **Conseiller Patrimoine** (`conseiller-patrimoine/`) | Vue d'ensemble du patrimoine et rééquilibrage, en lecture seule stricte. | Python | lit NexusCrypto et Pépites, **sans jamais y écrire** | actif |
| **Bilan Patrimoine** (`bilan-patrimoine/`) | Le produit grand public : diagnostic gratuit puis suivi payant. Lot 1 — calcul, barèmes et texte. | TypeScript | produit grand public de `conseiller-patrimoine/` | actif |
| **Le Coffre** (`le-coffre/`) | Coffre-fort de documents chiffré côté navigateur, multi-utilisateurs. Productisation du coffre de Life-Organizer. | Next.js 16, Supabase | coffre chiffré de `life-organizer/` ; échéance et vision **ré-implémentées** | actif |
| **Psy IA** (`psy-ia/`) | Accompagnement conversationnel de bien-être psychologique — détection de crise déterministe hors LLM. Squelette architectural, pas encore validé pour un vrai utilisateur (voir `psy-ia/TODO.md`). | Next.js 16, Supabase | — | actif |
| _Studio audio_ (`archives-backlog/mon-app-audio/`) | Outil audio. | Python, Streamlit | — | en sommeil |

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
| `generation-serveur/` | La passerelle de génération d'Amorce — MiniMax, plafond de 20 $/mois en veto. Rattachée à Amorce, pas autonome. |
| `scripts/` | Scripts de vérification et de fixtures pour Amorce à la racine. |
| `inbox/` | La boîte aux lettres entre sessions — un fichier par chantier — **et** la porte d'entrée des idées non triées. Les deux se distinguent à l'en-tête `De :`. |
| `projets-actifs/` | Les fiches d'exécution des idées validées. |
| `archives-backlog/` | Les fiches des idées bonnes mais pas maintenant, et `mon-app-audio/`, en sommeil. |

## À faire sur le dépôt lui-même

- `inbox/` porte depuis le 06/09/2026 des **messages de coordination**, un par
  projet destinataire — pas des idées à noter. Une session de tri les reconnaît
  à leur en-tête `De : Session de coordination` et les laisse : elles se
  suppriment quand le projet destinataire les a lues, pas quand elles sont
  notées sur dix. Hors ces messages, le dossier est vide, et c'est normal si
  tout a été trié.
- **La décision du 06/09 est déployée depuis le 11/09/2026** : les vingt-trois
  chantiers du tableau ci-dessus ont leur `inbox/<projet>.md`, plus les trois
  serveurs rattachés à Amorce et `visual_library/`. Elle ne l'était pas — sept
  fichiers existaient sur vingt-sept, et un message déposé pour un projet sans
  fichier n'était lu par personne. Un fichier qui dit « aucun message en
  attente » **est** la réponse attendue : son absence, elle, ne se distingue pas
  d'un silence.
- **`inbox/amorce-video-pipeline.md` a trouvé son destinataire, et c'est
  `inbox/amorce.md`.** Ce message portait les trois décisions du propriétaire
  sur la génération intégrée — fournisseur MiniMax, plafond de 20 $/mois, clé à
  venir — et aucune session ne le lisait au démarrage, faute d'un dossier de ce
  nom. Le chantier qu'il concerne est Amorce elle-même, à la racine : il y a
  déménagé le 11/09/2026, sans une ligne de changée.
- Les deux copies pour Aznaroth — `inbox/montage-auto.md` et `inbox/tiktok.md` —
  portent le même texte à dessein : le projet vit dans les deux dossiers. Chacune
  renvoie à l'autre pour qu'on ne les prenne pas pour un doublon accidentel.
- Le tableau ci-dessus **se recompte désormais tout seul**. Il ne le faisait
  pas, et ça s'est vu deux fois le même jour : `motion/` absent pendant
  plusieurs sessions alors que `CLAUDE.md` le documentait, puis un décompte
  resté à « dix-sept » quand deux chantiers de plus avaient atterri.
  `/coherence-depot` ne lisait que `CLAUDE.md` — il lit maintenant ce tableau
  aussi, et démontre l'écart entre la phrase et les lignes, entre les dossiers
  cités et le disque. Une ligne à ajouter reste un geste humain ; la fausseté,
  elle, ne peut plus passer.
