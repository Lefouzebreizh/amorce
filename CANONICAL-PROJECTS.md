# Registre canonique des projets

Dernière mise à jour : 2026-10-20

Ce fichier sert de **source de vérité** pour éviter de reprendre une ancienne version par erreur.

## Règle générale

- Un seul emplacement canonique par projet.
- Les anciens dépôts restent éventuellement conservés comme archives, mais ne doivent plus servir au développement ni au déploiement.
- Avant tout nouveau travail, vérifier ce registre.
- Sur Vercel, éviter les déploiements successifs inutiles : corriger en lot, tester, puis déployer une seule version validée.
- Ne jamais supprimer un dépôt ou un projet Vercel tant que sa dernière version utile n'a pas été identifiée et comparée à la version canonique.

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

### Mon Tiroir Secret
- Source canonique actuelle dans `Lefouzebreizh/amorce`
- Dossier applicatif : `/le-coffre`
- Projet Vercel : `mon-tiroir-secret`
- Domaines actuels : `mon-tiroir-secret-erwann.vercel.app`, `coffre-puce.vercel.app`

### Ensemble pour rénover
- Source canonique actuelle dans `Lefouzebreizh/amorce`
- Dossier applicatif : `/renov-facile`
- Projet Vercel : `ensemble-pour-renover`
- Domaine principal actuel : `renov-facile.vercel.app`

### IPTV
- Source canonique actuelle dans `Lefouzebreizh/amorce`
- Dossier applicatif : `/iptv`
- Projet Vercel : `iptv`

### Psy IA / Respire
- Source canonique actuelle dans `Lefouzebreizh/amorce`
- Dossier applicatif : `/psy-ia`
- Projet Vercel : `psy-ia`
- Attention : le dernier déploiement Vercel observé est en erreur ; ne pas supprimer les déploiements READY antérieurs avant correction.

### Chat traducteur
- Source canonique actuelle dans `Lefouzebreizh/amorce`
- Dossier : `/chat-traducteur`
- Projet Vercel : `chat-traducteur`
- Projet atypique (Python + web) : ne pas modifier sa configuration Vercel sans audit dédié.

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

## Point important : monorepo amorce

Plusieurs projets Vercel sont reliés au même dépôt GitHub `Lefouzebreizh/amorce`. Un simple commit documentaire à la racine a déjà déclenché des builds de plusieurs projets en même temps.

Les dossiers applicatifs confirmés sont :
- `artisan-express/`
- `le-coffre/` → Mon Tiroir Secret
- `iptv/`
- `chat-traducteur/`
- `renov-facile/` → Ensemble pour rénover
- `psy-ia/`

Les projets suivants possèdent déjà un `vercel.json` avec une logique d'ignore liée à leur dossier :
- `artisan-express`
- `le-coffre`
- `iptv`
- `renov-facile`
- `psy-ia`

La configuration Vercel doit être auditée avant toute modification destructive afin de s'assurer que ces règles sont réellement appliquées côté projet.

## Dépôts autonomes conservés

### life-organizer
Ne pas archiver ni supprimer pour l'instant.

Comparaison effectuée avec `amorce/life-organizer` :
- le dépôt autonome contient encore des fichiers absents de la copie dans `amorce`, notamment des modules calendrier, OCR, documents et leurs tests ;
- de nombreux fichiers communs ont divergé entre les deux copies.

Conclusion : **ce n'est pas un doublon sûr à supprimer**. Une fusion de code est nécessaire avant toute suppression.

### Autres dépôts indépendants à conserver
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

Les README des trois premiers dépôts ont été marqués explicitement comme historiques pour éviter toute reprise accidentelle.

## À retenir

**Ne jamais choisir un projet parce que son nom “ressemble au bon”.**
Toujours vérifier ce registre puis le projet Vercel réellement relié avant de modifier ou déployer.
