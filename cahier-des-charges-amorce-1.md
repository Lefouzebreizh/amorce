# AMORCE — Cahier des charges technique

## 1. Contexte et objectif

AMORCE est une web app d'édition vidéo courte (format réseaux sociaux, type TikTok/Reels/Shorts) destinée aux créateurs de contenu. Elle combine une bibliothèque de transitions et bruitages prêts à l'emploi, un système de scoring d'accroche ("Hook Score") qui évalue la force des deux premières secondes d'une vidéo, et des outils d'aide à la création de contenu viral.

Une maquette visuelle (React, fichier `AmorceApp.jsx` fourni séparément) a déjà été validée pour la direction artistique. Ce document décrit ce qu'il reste à construire pour obtenir une version réellement fonctionnelle.

**Web app, pas d'application native** — accessible depuis un navigateur, desktop et mobile.

## 2. Direction artistique (déjà validée — à respecter)

- **Fond** : `#0A0C10` (base), `#07080B` (profond)
- **Panneaux** : `#12151C`, `#14171F`, éléments surélevés `#1B1F2A`
- **Bordures** : `#1F2430`, `#2C3140`
- **Accent principal** : cyan `#3DEBD8`
- **Accent secondaire** : violet `#8B5CF6`
- **Accent tertiaire** : ambre `#FFB74D`
- **Texte** : `#E8EAF0` (principal), `#8B92A6` (atténué), `#565D70` (discret)
- **Polices** : Space Grotesk (titres/UI), Inter (texte courant), JetBrains Mono (valeurs techniques, tags)
- Interface **bilingue FR/EN** avec sélecteur en haut à droite — tous les textes, y compris les noms d'effets et de transitions, doivent exister dans les deux langues.

## 3. Fonctionnalités MVP (première version fonctionnelle)

### 3.1 Import et lecture vidéo
- Import de fichiers vidéo depuis l'ordinateur (drag & drop + sélecteur classique)
- Formats acceptés en priorité : **MP4, MOV**
- **Durée maximale : 1 minute** par vidéo importée (contrainte produit confirmée)
- Aperçu en lecture directe, format **9:16** (vertical, réseaux sociaux)
- Lecture/pause, scrubbing sur la timeline

### 3.2 Bibliothèque de transitions et bruitages
- Grille de transitions et bruitages, organisée par onglets (déjà maquettée)
- Application en un clic sur la timeline, entre deux clips (transitions) ou à un point précis (bruitages)
- Chaque effet a un nom FR et EN, une durée (tag), et pour les transitions une "énergie" (Impact / Fluide / Doux)
- Prévisualisation de l'effet avant application

### 3.3 Timeline et montage basique
- Piste vidéo avec clips représentés par leur forme d'onde
- Marqueurs de transitions visibles sur la timeline
- Découpe de clips (split), réorganisation par glisser-déposer
- Réglage des niveaux audio : voix originale vs musique de fond (deux curseurs indépendants)

### 3.4 Score d'accroche ("Hook Score")
- Analyse automatique des 2 premières secondes de la vidéo importée
- Score sur 100, avec code couleur (rouge/ambre/cyan selon le niveau)
- Presets de style d'ouverture avec score associé : Choc direct (91), Teasing (78), Narratif lent (52) — ces valeurs sont indicatives dans la maquette, l'algorithme réel doit être défini (voir section 5)
- Conseil contextuel affiché (ex. "Ajoute une pause avant le twist pour gagner jusqu'à 15 points")

### 3.5 Bibliothèque de hooks viraux
- Bibliothèque de patterns d'ouverture éprouvés (ex. structures "et si...", "ils l'ont sous-estimé...", révélation différée, etc.)
- Chaque hook proposé associe : un patron de phrase/accroche, un rythme de montage recommandé (cuts rapides vs lents), et un score d'accroche estimé
- Application en un clic : pré-remplit le début de la timeline avec le rythme suggéré

### 3.6 Export
- Export calibré pour réseaux sociaux : 9:16, résolution adaptée (1080x1920 minimum)
- Fichier prêt à poster en sortie (MP4)

## 4. Fonctionnalités avancées (v2 — après le MVP)

### 4.1 Optimisation de publication
- Suggestions de titres et hashtags selon les tendances actuelles
- Recommandation de durée idéale selon le type de contenu
- Indicateur de rythme de montage comparé aux vidéos qui performent bien dans une niche donnée

### 4.2 Analyse de marché et de niches
- Identification de niches et tendances porteuses pour orienter les choix de contenu
- **Important** : cette fonctionnalité dépend de données à jour (tendances en temps réel), donc mieux adaptée à un système qui interroge le web régulièrement plutôt qu'un algorithme figé et entraîné une fois. Prévoir une architecture qui permette des recherches web périodiques plutôt qu'un modèle statique.
- **Point d'honnêteté à garder en tête dans la conception** : aucun outil ne peut garantir qu'un compte devienne viral rapidement. Cette fonctionnalité doit être présentée comme une aide à la décision basée sur des données, pas comme une promesse de résultat.

## 5. Points à clarifier / décisions techniques à prendre avec Claude Code

- **Algorithme du Hook Score** : sur quels signaux se base-t-il réellement ? (rythme de coupe détecté dans les 2 premières secondes, présence de mouvement/contraste visuel, autre ?) — à définir techniquement, la maquette actuelle utilise des valeurs fixes de démonstration.
- **Stack technique** : à choisir selon les capacités de Claude Code (ex. Next.js/React pour le front, traitement vidéo côté client avec ffmpeg.wasm pour un MVP léger, ou traitement serveur si le volume le justifie).
- **Stockage** : où sont stockées les vidéos importées et les projets (local navigateur pour un MVP, puis cloud si passage à un vrai produit avec comptes utilisateurs) ?
- **Comptes utilisateurs** : nécessaires dès le MVP ou plus tard ?

## 6. Référence visuelle

Le fichier `AmorceApp.jsx` (maquette React validée) sert de référence exacte pour :
- La structure de l'interface (barre du haut, rail d'icônes, panneau bibliothèque, aperçu central, panneau score d'accroche, timeline en bas)
- Les couleurs exactes (voir section 2)
- La structure de données bilingue (objets `fr`/`en` sur chaque élément traduisible)

Ce fichier peut être donné tel quel à Claude Code comme point de départ visuel, à connecter ensuite à de la vraie logique fonctionnelle.
