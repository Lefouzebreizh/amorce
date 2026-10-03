# Tableau de contrôle — lot du 23 septembre 2026

Objectif : obtenir le maximum de projets au statut **Prêt à tester** ou
**Prêt à publier** avant 21 h, sans sacrifier la sécurité ni perturber les
déploiements verts. « Prêt à publier » exige QA, parcours critique et revue
humaine. Le tableau ne constitue pas à lui seul une preuve de conformité.

| # | Projet canonique | Voie | Statut | Preuve disponible | Prochaine action |
| ---: | --- | --- | --- | --- | --- |
| 1 | Artisan Express V2 | commerce | En cours | URL Vercel et audit Gemini Artisan disponibles ; aperçu iframe à diagnostiquer | Corriger isolément, puis QA et revue |
| 2 | Annuaire IA | commerce | En cours | Source présente ; URL publique non confirmée | Confirmer URL, tester le parcours d’affiliation |
| 3 | Audit Landing | audit | En cours | Site privé et adaptateur Gemini testés sur branche dédiée | Vérifier parcours réel et intégrer sans conflit |
| 4 | Look and Find | mobile | En cours | Source présente ; URL/version distribuable absente | Build, test appareil et confidentialité photo |
| 5 | Amorce | studio-core | En cours | URL Vercel connue ; parcours complet non contrôlé | QA `/` et `/studio`, puis scénario de création |
| 6 | Respire | sensitive | En cours | Périmètre et URL à confirmer | Inventaire, sécurité bien-être, parcours |
| 7 | Ensemble pour rénover | ensemble | Prêt à tester | Déploiement accessible ; revue finale manquante | Tester formulaire, mobile, mentions |
| 8 | Ensemble pour les démarches | ensemble | Prêt à tester | Déploiement accessible ; revue sensible manquante | Tester erreurs, données et limites de conseil |
| 9 | Ensemble au quotidien | ensemble | En cours | URL exacte non confirmée | Identifier la version canonique |
| 10 | Ensemble pour s’orienter | ensemble | Prêt à tester | Ancienne URL connue ; renommage à vérifier | Contrôler marque, parcours et public jeune |
| 11 | ImmoDéclic | sites-rapides | Prêt à tester | Dernier déploiement Sites réussi ; parcours non vérifié | QA, clics, formulaire, revue commerciale |
| 12 | Mémoire en voix | sites-rapides | Prêt à tester | Dernier déploiement Sites réussi ; parcours non vérifié | QA, consentement et parcours audio |
| 13 | RecruteClair | sites-rapides | Prêt à tester | Dernier déploiement Sites réussi ; parcours non vérifié | QA et cas réel de candidature |
| 14 | AvisLocal | sites-rapides | Prêt à tester | Dernier déploiement Sites réussi ; parcours non vérifié | QA et vérification des affirmations |
| 15 | ReelMinute | sites-rapides | Prêt à tester | Dernier déploiement Sites réussi ; parcours non vérifié | QA et scénario de génération |
| 16 | Portrait Pro | sites-rapides | Prêt à tester | Dernier déploiement Sites réussi ; parcours non vérifié | QA, données photo et export |
| 17 | Les Mots Justes | sites-rapides | Prêt à tester | Dernier déploiement Sites réussi ; parcours non vérifié | QA et messages sensibles |
| 18 | Mots & Merveilles | sites-rapides | Prêt à tester | Dernier déploiement Sites réussi ; parcours non vérifié | QA et cohérence éditoriale |
| 19 | Roussy & Zéphy | creation | Prêt à tester | Dernier déploiement Sites réussi ; parcours non vérifié | QA jeunesse et vérification des liens/affirmations |
| 20 | L’Éveil des couleurs | creation | En cours | URL exacte non confirmée | Inventaire et définition du parcours critique |
| 21 | Accord | creation | En cours | Produit et URL à préciser | Inventaire avant tout correctif |
| 22 | Bio Résonante | creation | En cours | Déploiement Sites réussi ; IA non activée | Décider le parcours sans faux bouton |
| 23 | Résonance | creation | En cours | Déploiement Sites réussi ; génération/export à vérifier | Tester audio, vidéo et export |
| 24 | Lefouzèbreizh Studio | studio-last | En cours | Vitrine accessible ; dépend des preuves des projets | Traiter après le portefeuille |

## Règles de promotion

- **En cours → Prêt à tester** : version fonctionnelle, URL/version exacte, aucun blocage connu.
- **Prêt à tester → Prêt à publier** : parcours critique, mobile et bureau, liens/formulaires, visuel, sécurité et offre vérifiés.
- Tout bug ou preuve manquante maintient le statut ou le ramène à **En cours**.
- Un risque empêchant la publication donne **Bloqué**, avec responsable et prochaine action.