# Audit Landing — Gemini (22 septembre 2026)

Mise à jour à 20:50 UTC : après remplacement local de la clé par le propriétaire,
l’accès Gemini est confirmé. Une analyse réelle d’Artisan Express a réussi sur
10 segments capturés le 22 septembre 2026, modèle gemini-3.5-flash-lite.
Rapports Markdown, JSON et HTML générés. Usage retourné : 11 625 jetons
entrants et 1 138 sortants. Aucun prix ni gratuité n’est déduit de ces compteurs.
La relecture a écarté une recommandation sur le téléphone, déjà cliquable.
L’audit visuel ne valide pas les parcours. Le reste de ce guide documente aussi
le diagnostic initial (401), désormais résolu. Aucun secret n’a été publié.

## Utilisation
Depuis une copie à jour de cette branche, avec Python et Pillow installés :
```powershell
python audit-landing/analyser_captures_gemini.py --env-file CHEMIN_SECRET_LOCAL --verifier-acces
python audit-landing/capturer_page.py URL_CONFIRMEE --sortie audit-landing/captures/nouveau-lot
python audit-landing/analyser_captures_gemini.py audit-landing/captures/nouveau-lot/DOSSIER_PAGE --env-file CHEMIN_SECRET_LOCAL
```

Le fichier secret contient GEMINI_API_KEY. Ne jamais le committer.
GEMINI_API_KEY ou GOOGLE_API_KEY dans l'environnement a priorité.
Modèle configurable par --modele ou GEMINI_MODEL ; défaut gemini-3.5-flash-lite,
documenté par Google, mais accès de ce compte non confirmé (401).
La vérification d'accès ne génère aucun contenu. La génération peut consommer
le quota gratuit ou être facturée selon le compte Google : aucun budget n'est
déductible d'une simple clé. Aucun repli ni réessai automatique.

Chaque analyse réussie écrit un nouveau dossier analyses/gemini-DATE-ID :
rapport.json, rapport.md, rapport.html avec vignettes et execution.json avec
modèle, consommation retournée et empreintes des captures. Les anciens rapports
restent intacts. Une erreur renvoie un code non nul, sans rapport de réussite.
Tous les segments sont analysés, sauf la pleine page de référence ; aucun
échantillonnage silencieux à quatre images. Limites : 32 images, requête 18 Mio.
L'audit visuel ne prouve ni le fonctionnement des formulaires ni la sécurité.

## Constats de reprise
La copie locale historique C:\Users\erwan\amorce diffère de GitHub :
capturer_page.py a été remplacé par une capture du premier écran ; la V6 ignore
son code retour et peut analyser des fichiers anciens ; l'ancien analyseur
Gemini ne traite que quatre images, vise gemini-1.5-flash et renvoie 0 sur erreur.
Ces fichiers locaux n'ont été ni écrasés ni supprimés.
Utiliser le moteur de capture versionné et un nouveau dossier de lot.
La V6 contient dix URLs seulement, dont plusieurs différentes des Sites
recensés : ne pas la relancer en supposant qu'elle couvre tout le portefeuille.

La PR #953 modifie d'autres parties d'Audit Landing : ce lot ajoute uniquement
l'adaptateur, ses tests et ce guide, sans toucher à ses fichiers.
Le workflow de paiement historique n'est pas basculé : activation Gemini en
production à traiter après rétablissement de la clé et analyse réelle réussie.
Aucun audit Gemini de site n'a encore été réalisé dans cette intervention.

## Validation
Huit tests sans réseau : format de requête, plus de quatre images, exclusion
de la référence, réponses tronquées, citations inexistantes, clé absente,
quota sans réessai, absence de faux succès et rendu HTML avec captures.
Ces tests utilisent des réponses synthétiques, jamais des audits présentés
comme réels. Vérification réelle de la clé : HTTP 401, deux requêtes GET
(liste des modèles puis contrôle du modèle), aucune génération.

Documentation primaire :
- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/models
