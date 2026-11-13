# Maison Phare — carte des espaces et capacités

**Statut : cadrage produit et architecture.** Ce document décrit des espaces souhaités ; il ne signifie pas qu’ils sont déjà disponibles dans l’application.

## Principe d’architecture

Les douze espaces sont des vues de travail spécialisées au-dessus d’un même socle, pas douze applications ni douze mémoires indépendantes.

Le socle commun gère les projets, documents, notes, tâches, versions, provenance, préférences confirmées, permissions, recherche et historique des opérations. Un espace déclare ses objectifs, les types de données qu’il peut lire, les capacités qu’il peut demander, les sorties attendues et les confirmations nécessaires.

L’orchestrateur prépare et suit les tâches. Les agents spécialisés ne reçoivent que les sources et permissions explicitement accordées pour la tâche. Un plan proposé n’est pas une exécution. Les transferts externes, dépenses, publications, suppressions et modifications importantes exigent le consentement approprié. Aucun basculement silencieux vers un service cloud.

### Contrat futur d’un espace

Chaque espace devrait déclarer au minimum :

- identifiant stable et nom affiché ;
- intention de l’utilisateur et cas d’usage ;
- données accessibles : références explicites, projet courant ou tâche seulement ;
- capacités demandées : texte, recherche, transcription, vision/OCR, audio, image, vidéo, localisation ou connecteur ;
- mode d’exécution de chaque capacité : déterministe local, modèle local, API distante ou site externe ;
- données transmises, fournisseur et coût connu avant un appel externe ;
- niveau de risque et confirmations requises ;
- formes de résultat, provenance, vérification, export et suppression.

## Les douze espaces

| Espace | Rôle principal | Capacités envisagées | Précautions spécifiques |
|---|---|---|---|
| **Atelier des Rêves** | Faire mûrir textes, chansons, images et montages | Écriture, références créatives, audio, image, vidéo, versions | Garder les originaux intacts ; séparer créations de l’utilisateur et propositions ; apprentissage de préférences ou LoRA uniquement sur opt-in révocable. |
| **Salon des Proches** | Activités partagées et souvenirs de groupe | Jeux, histoires, album, recherche de médias | Espaces séparés par personne ; accord avant d’indexer les médias ou voix d’autrui ; collecte minimale pour les enfants. |
| **Bibliothèque** | Apprendre, explorer et retrouver des connaissances | Recherche documentaire, sources, cours, schémas et quiz | Montrer sources, dates et incertitudes ; distinguer information générale et avis professionnel. |
| **Quartier Général** | Piloter projets, démarches, documents et tâches | Dossiers, formulaires pris en charge, planification, agents métier | Validation avant envoi ou modification ; journal des actions ; aucune promesse d’issue administrative ou juridique. |
| **Vigie** | Prendre du recul et ajuster ses objectifs | Bilans, jalons, rétrospective et rappels | Bilans réglables, sans surveillance cachée ni notifications culpabilisantes. |
| **Sanctuaire** | Faire une pause et retrouver son calme | Exercices guidés, respiration visuelle, ambiance audio facultative | Ne pas présenter comme un soin médical ; désactivation facile du son et des animations. |
| **Laboratoire Loufoque** | Jouer, apprendre et créer des défis | Mini-jeux vocaux, quiz, scénarios et progression | Distinguer faits et fiction ; les scores ne deviennent pas des diagnostics de compétence ou de personnalité. |
| **Arène d’Entraînement** | Répéter une situation avant de la vivre | Simulation d’entretien, négociation, discours et débrief | Le débrief porte seulement sur ce qui a été observé ou entendu ; aucune conclusion psychologique ou prédiction de résultat. |
| **Jardin Secret** | Consigner rêves et pensées intimes | Dictée, journal privé, motifs récurrents, illustration facultative | Capture activée explicitement ; hypothèses de réflexion, jamais « décodage » clinique de l’inconscient ; consultation, correction et suppression. |
| **Établi du Quotidien** | Être guidé pendant cuisine, réparation ou jardinage | Caméra temporaire, vision, instructions vocales étape par étape | Caméra coupée hors session et état visible ; face à un risque de produit, outil ou électricité, demander une vérification fiable au lieu d’improviser sur image incertaine. |
| **Comptoir des Explorateurs** | Préparer et accompagner sorties et voyages | Cartes, traduction, recherche de lieux et itinéraires | Localisation facultative et temporaire ; cartes/traductions hors ligne indiquent téléchargement, date et limites ; pas de réservation ni d’information actuelle sans réseau. |
| **Forge des Héritages** | Conserver des récits de vie à transmettre | Entretiens guidés, archives, biographie, médias | Consentement explicite pour voix, photos et partage ; accès révocable ; toute reconstitution est présentée comme une simulation, pas comme la personne réelle. |

## Mémoire et capture

La capture vocale ou visuelle démarre à la demande ou après activation explicite, jamais en écoute continue par défaut. Une information intime n’est pas conservée durablement ni ajoutée à un jeu d’entraînement sans consentement distinct. Les éléments de mémoire doivent pouvoir être consultés, corrigés, exportés et supprimés. Les propositions de préférences restent à confirmer par la personne.

## Architecture en arborescence

L’arborescence décrit la délégation, pas une multiplication de modèles :

1. **Orchestrateur** : comprend la demande, prépare un plan, choisit l’espace et suit l’état de la tâche.
2. **Coordinateur d’espace** : borne le contexte et demande uniquement les capacités utiles.
3. **Agents de capacité** : par exemple documentaliste, coach de simulation, assistant créatif, guide d’apprentissage, analyste visuel ou assistant voyage.
4. **Vérificateur** : contrôle les sources, permissions, coûts et résultats avant de déclarer la tâche terminée.

Ces rôles sont des rôles à construire, pas des agents déjà actifs. Le contrat typé de tâches de la PR #1047 est une première base : il valide plans, permissions, coûts et transitions, mais ne démarre ni ne persiste encore de tâches.

## Ordre de réalisation proposé

1. Stabiliser le contrat d’orchestration, puis ajouter persistance et présentation honnête des états de tâche.
2. Livrer un premier parcours utile et mesurable dans le Quartier Général ou la Bibliothèque, avec sources et résultat vérifiable.
3. Ajouter des ateliers à faible risque : Arène textuelle, apprentissage et organisation.
4. Ajouter capture multimodale, caméra, cartes et création audio/vidéo après raccordement et vérification des capacités réelles.
5. Ouvrir progressivement les espaces sensibles — Jardin Secret, Sanctuaire, Salon des Proches et Forge — avec consentements séparés, contrôles d’accès et tests de suppression/export.

## État vérifié dans le dépôt au 13 novembre 2026

- La PR #1047 contient un contrat typé d’orchestration en brouillon ; elle ne lance pas de vrais agents ni ne persiste les tâches.
- Le studio possède déjà des briques locales de montage : import de médias dans un projet avec URL objet et vignettes (`src/lib/media.ts`), mixage audio hors ligne (`src/lib/audioHorsLigne.ts`) et encodage vidéo image par image (`src/lib/exportHorsLigne.ts`). Ce n’est pas encore une banque générale indexant tout un disque.
- Le registre `src/lib/phare-capabilities.ts` décrit la voix via Web Speech et speechSynthesis comme dépendante du navigateur/de la connexion ; ce n’est donc pas une voix locale garantie. Il décrit aussi la production générative complète comme « à connecter » : le plan/devis ne lance pas une génération.
- Le détecteur de visage (`src/lib/detection.ts`) utilise un modèle facultatif téléchargé au premier usage puis mis en cache ; ce n’est pas une preuve que tous les modèles sont installés ou disponibles hors réseau dès l’installation.
- La génération locale de musique, d’images et de vidéo, l’indexation sémantique multimédia, la séparation de pistes, la voix locale et l’entraînement LoRA ne sont pas établis comme capacités complètes dans le registre.
- Les douze espaces restent une organisation produit ; la présence d’une brique de studio ne rend pas à elle seule un espace entier opérationnel.
- À la dernière vérification de la PR #1047, les contrôles « Amorce », « Tests Python » et « Cohérence du dépôt » étaient réussis ; le parcours navigateur tournait encore.
- Les données d’un espace ne sont jamais supposées accessibles aux autres sans règle explicite.

## Concordance avec le Prompt Maître intégral

Le Hall du Phare est la couche d’accueil et de navigation : il ouvre l’une des **douze pièces** listées dans le tableau. Il ne constitue pas une treizième pièce. Les ateliers sont des contextes d’usage ; ils n’impliquent pas à eux seuls qu’un moteur, un agent ou une capacité soit installé.

Le prompt maître exprime une direction produit. Il ne peut pas, à lui seul, garantir la confidentialité, autoriser une caméra, imposer un délai d’annulation ou rendre un moteur local disponible. Ces garanties doivent être appliquées par le code, les permissions du système, le stockage, les connecteurs et des contrôles vérifiés.

### Résoudre les règles de routage et de création

- **Local d’abord, si disponible et adapté.** Le Phare ne prétend pas exécuter localement une capacité sans moteur installé et vérifié.
- **Pas de changement silencieux de fournisseur ni de mode.** Si le moteur local est absent ou échoue, expliquer les options disponibles. Un passage vers le cloud exige l’accord préalable requis, avec fournisseur, données envoyées et coût connu lorsqu’il peut être estimé.
- **Pas de fallback silencieux inverse.** Si un service distant échoue, proposer un moteur local seulement s’il existe ; signaler le changement et les différences possibles de capacité ou de résultat. Si aucun chemin fiable n’existe, afficher une erreur explicite.
- **Aucune analyse permanente par défaut.** Capture, transcription, vision et enregistrement demandent une activation claire. Les données retenues pour personnaliser un modèle sont montrées à la personne et peuvent être retirées ; le profil créatif ne s’entraîne pas automatiquement sur chaque interaction.
- **Le modèle local est une option vérifiée, pas une promesse générique.** L’installation peut demander un téléchargement initial. Avant de recommander ou distribuer un pack, vérifier licences, taille, matériel requis, conditions d’usage, mises à jour et fonctionnement réel sans réseau.
- **Les confirmations critiques sont des contrôles applicatifs.** Une phrase dans le prompt ne suffit pas à garantir les dix secondes d’annulation, la corbeille de trente jours ou la validation d’une opération. Ces règles doivent être implémentées et vérifiées dans les chemins d’exécution.
- **Biométrie et voix ne sont pas interchangeables.** L’accès sensible doit s’appuyer sur l’authentification de la plateforme ou un mécanisme sécurisé. Une phrase vocale ne doit pas être traitée seule comme une preuve d’identité ou un mot de passe inviolable.
- **La sécurité ne dépend pas du secret du prompt.** Les clés, données et permissions sont protégées par l’architecture et le contrôle d’accès. L’assistant peut expliquer les capacités et limites du produit sans divulguer secrets, identifiants ou configurations sensibles.

Les affirmations « 100 % local », « zéro fuite », « toujours disponible », « qualité professionnelle » et « entraînement LoRA automatique » ne peuvent être affichées qu’après tests et mesures qui les définissent précisément. L’interface doit décrire le mode réellement utilisé pour chaque tâche.

## Atelier multimédia local : matière, analyse et recomposition

L’objectif est que l’utilisateur puisse créer et monter localement à partir de ses propres images, vidéos, enregistrements, prises de voix et pistes instrumentales. Cette capacité se construit comme un pipeline de production, pas comme un entraînement unique qui rendrait l’application capable de « tout faire ».

### Distinguer quatre opérations

1. **Inventorier et indexer la matière.** Lire les fichiers depuis l’espace local choisi, calculer empreintes et métadonnées, créer des vignettes, formes d’onde, transcriptions ou descriptions lorsque les outils locaux disponibles le permettent. L’index conserve le chemin, la provenance, la date, les droits déclarés et le lien avec l’original. Les analyses sont des suggestions révisables.
2. **Découper et caractériser.** Repérer scènes, plans, silences, tempo, sections, voix et éléments sonores. La séparation de sources audio produit des estimations avec artefacts possibles ; une piste séparée ne doit pas être présentée comme la prise isolée originale si elle ne l’est pas.
3. **Réutiliser et transformer.** Composer une banque de médias, boucles, prises, instruments et plans recherchables. L’utilisateur peut demander de retrouver, comparer, recadrer, nettoyer, assembler ou remixer les éléments sélectionnés. L’édition doit préserver les originaux et enregistrer les modifications comme des versions ou opérations non destructives.
4. **Générer et monter.** Utiliser les moteurs locaux installés pour les transformations ou générations réellement prises en charge, puis assembler sur une timeline avec aperçu et export local. La génération d’image, de musique ou de vidéo est une capacité distincte de l’indexation et du montage ; chaque moteur a ses propres limites, coûts matériels, droits et niveaux de qualité.

### Rôle de l’apprentissage personnalisé

L’application peut apprendre le profil créatif à partir de préférences confirmées, de productions choisies et de corrections explicites. Cela ne nécessite pas automatiquement un LoRA. Un adaptateur ou LoRA n’est entraîné qu’après opt-in, sélection/aperçu des données, contrôle de licence, mesure du matériel et possibilité de supprimer ou reconstruire le profil. Les modèles de base restent distincts des données et adaptations personnelles.

### Chaîne locale attendue

- Import depuis les dossiers choisis ; aucune exploration globale du disque par défaut.
- Analyse en arrière-plan contrôlable, avec progression, pause, reprise et annulation.
- Bibliothèque locale consultable par type, projet, personne, instrument, ambiance, date et texte transcrit lorsque disponible.
- Sélection explicite de la matière source ; aucune réutilisation automatique de médias privés dans un nouveau projet.
- Projet de montage non destructif, historique des opérations et versions ; originaux conservés.
- Export sur l’appareil avec format, résolution, durée, espace disque estimé et limites annoncés.
- Mode hors ligne vérifié après téléchargement des moteurs ; les modèles doivent être présents localement, licenciés pour l’usage prévu et compatibles avec la machine.

### Réalisme matériel et ordre de construction

Le montage classique, l’organisation des assets, les métadonnées, les timelines et certains traitements déterministes peuvent tourner localement avec des besoins modestes à moyens. L’analyse multimodale est plus coûteuse ; la génération vidéo et l’entraînement de modèles peuvent demander beaucoup de mémoire, de stockage, de temps et de puissance graphique. Le Phare doit mesurer les capacités disponibles et proposer une qualité ou une résolution réaliste, plutôt que promettre une fluidité identique sur toutes les machines.

Ordre conseillé :

1. Consolider l’import média par projet, la timeline et l’export hors ligne déjà présents ; étendre ensuite vers une bibliothèque locale indexable, sans modèle génératif.
2. Ajouter l’analyse locale des médias, la recherche et des transformations réversibles ; vérifier chaque outil sur des fichiers de référence.
3. Ajouter séparation audio et générations locales ciblées, avec rendu, licences et limites documentés.
4. Ajouter génération vidéo locale et adaptations personnelles après tests de compatibilité, de qualité, de temps et d’espace disque.
5. Vérifier le mode avion sur une installation complète : bloquer le réseau, effectuer une création, sauvegarder et exporter, puis confirmer qu’aucun appel distant n’a été requis.

**État actuel :** le dépôt contient déjà un studio de montage local et des imports médias par projet, mais pas le pipeline complet décrit ici. La PR #1048 ajoute uniquement le cadrage ; elle n’ajoute ni indexeur général, ni génération locale de musique/images/vidéo, ni séparation de pistes, ni voix locale, ni entraînement.

### Voix locale et extension connectée à la demande

La voix locale fait partie du socle visé : reconnaissance vocale hors ligne, transcription, commandes, synthèse vocale et interruption de la lecture. Le registre actuel indique que la voix Web Speech dépend du navigateur et de la connexion ; il faut donc intégrer et vérifier un chemin vocal local dédié avant de présenter cette fonction comme hors ligne. Une activation vocale permanente éventuelle doit être facultative, visible et conçue pour limiter les ressources ; l’enregistrement continu n’est pas activé par défaut.

La reproduction ou conversion de la voix personnelle est une fonction distincte. Elle demande un consentement spécifique, des références dont l’utilisateur détient les droits nécessaires, et une indication claire lorsqu’une voix synthétique est utilisée. Les enregistrements originaux restent séparés des rendus générés.

Si une machine ne peut pas exécuter une capacité localement, l’application peut proposer une extension connectée : l’utilisateur choisit le fournisseur ou le site, voit quelles données seront transmises et le coût connu avant l’envoi. Le média ne part qu’après accord. Le retour au local après échec est lui aussi annoncé ; le résultat peut différer ou la tâche peut être refusée si aucun moteur local adéquat n’est installé.

L’ambition « tout à portée de la main » signifie que les espaces, les projets, les outils disponibles et leurs limites sont présentés dans une même interface. Elle ne signifie pas que chaque modèle est préinstallé ou que chaque capacité est illimitée sur toute machine.
