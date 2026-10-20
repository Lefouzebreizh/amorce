# Registre canonique des projets

Dernière mise à jour : 2026-10-20

Ce fichier sert de **source de vérité** pour éviter de reprendre une ancienne version par erreur.

## Règle générale

- Un seul emplacement canonique par projet.
- Les anciens dépôts restent éventuellement conservés comme archives, mais ne doivent plus servir au développement ni au déploiement.
- Avant tout nouveau travail, vérifier ce registre.
- Sur Vercel, éviter les déploiements successifs inutiles : corriger en lot, tester, puis déployer une seule version validée.

## Projets canoniques principaux

### Artisan Express
- Source canonique : `Lefouzebreizh/amorce`
- Dossier : `/artisan-express`
- Projet Vercel : `artisan-express`
- Domaine public : `https://artisan-express-ashy.vercel.app`
- Ancien dépôt à ignorer : `Lefouzebreizh/artisan-express-v2`

### Audit IA / Déclic
- Source canonique : `Lefouzebreizh/amorce`
- Landing / produit : `/audit-landing`
- Radar / prospection : `/audit-radar`
- Ancien dépôt à ignorer : `Lefouzebreizh/audit-ia`
- Orientation décidée : intégrer l’offre Audit IA / Déclic dans l’écosystème commercial Artisan Express sans repartir d’un ancien repo.

### Ensemble face aux démarches
- Source canonique : `Lefouzebreizh/ensemble-face-aux-demarches`
- Projet Vercel : `ensemble-face-aux-demarches`
- Domaine public : `https://ensemble-face-aux-demarches.vercel.app`
- Le parcours Orientation / Reconversion est intégré dans ce projet.
- Ancien dépôt autonome à ignorer : `Lefouzebreizh/ensemble-pour-sorienter`
- Ancien projet Entreprendre autonome déjà archivé : `Lefouzebreizh/ensemble-pour-entreprendre`

## Projets Vercel actuellement présents

Les projets Vercel actuellement visibles dans l’équipe sont :
- `ensemble-face-aux-demarches`
- `amorce`
- `mon-tiroir-secret`
- `artisan-express`
- `iptv`
- `chat-traducteur`
- `ensemble-pour-renover`
- `psy-ia`

Aucun doublon évident d’Artisan Express ou d’Ensemble face aux démarches n’est présent dans cette liste.

## Dépôts autonomes conservés

Ces dépôts ne sont pas considérés comme des doublons à supprimer sans audit complémentaire :
- `Lefouzebreizh/life-organizer`
- `Lefouzebreizh/lefouzebreizh.github.io`
- `Lefouzebreizh/roussy_et_zephy`
- `Lefouzebreizh/tpchiffrage`
- `Lefouzebreizh/atelier-ia`

Ils restent indépendants tant qu’un audit dédié n’a pas conclu qu’ils sont remplacés par une version dans `amorce`.

## Dépôts historiques identifiés

- `Lefouzebreizh/artisan-express-v2` → remplacé par `amorce/artisan-express`
- `Lefouzebreizh/audit-ia` → remplacé par `amorce/audit-landing` + `amorce/audit-radar`
- `Lefouzebreizh/ensemble-pour-sorienter` → remplacé par le parcours Orientation dans `ensemble-face-aux-demarches`
- `Lefouzebreizh/ensemble-pour-entreprendre` → déjà archivé

## À retenir

**Ne jamais choisir un projet parce que son nom “ressemble au bon”.**
Toujours vérifier ce registre puis le projet Vercel réellement relié avant de modifier ou déployer.
