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

## État vérifié au 13 novembre 2026

- La PR #1047 est un contrat d’orchestration en brouillon, empilé sur la PR #1045.
- À la dernière vérification, les contrôles « Amorce », « Tests Python » et « Cohérence du dépôt » étaient réussis ; le parcours navigateur tournait encore.
- Aucun des douze espaces n’est déclaré opérationnel par ce document.
- Les données d’un espace ne sont jamais supposées accessibles aux autres sans règle explicite.
