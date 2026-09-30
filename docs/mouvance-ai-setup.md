# Configuration des outils IA Mouvance Studio

Les outils de montage continuent de traiter les médias importés dans le navigateur. Le chat envoie le texte de la conversation à Gemini. La génération d’image envoie son prompt à Gemini. La génération vidéo envoie son prompt à Runway ; l’éditeur ne transmet pas les rushes importés.

## Variables serveur

Configurer ces trois variables dans l’environnement du déploiement, sans le préfixe `NEXT_PUBLIC_` :

- `GEMINI_API_KEY` : clé Gemini utilisée pour le chat et les images.
- `RUNWAYML_API_SECRET` : clé Runway utilisée pour la génération vidéo.
- `MOUVANCE_AI_ACCESS_CODE` : code secret partagé pour protéger les routes de génération.

Le code d’accès est conservé dans `sessionStorage` du navigateur pour la session. Il n’est jamais ajouté à l’URL. Si le code n’est pas défini côté serveur, les routes renvoient une erreur de configuration et ne contactent aucun fournisseur.

## Générations vidéo

L’interface demande confirmation avant chaque appel Runway. Le prototype demande une vidéo de 5 secondes au modèle Gen-4.5. L’utilisation consomme les crédits du compte Runway selon sa grille tarifaire. Les liens de sortie sont temporaires : télécharger la vidéo dès qu’elle est prête, puis l’importer dans la timeline.

## Limites connues de ce premier lot

Les images et vidéos générées sont téléchargeables depuis le panneau IA, puis importables dans la timeline. Elles ne sont pas encore ajoutées automatiquement au projet de montage. Les appels réels nécessitent les clés fournisseur et n’ont pas été exécutés pendant le développement afin d’éviter toute consommation de crédits.

## Références fournisseur

- Gemini, API Interactions et génération d’images : https://ai.google.dev/gemini-api/docs/image-generation
- Runway, démarrage API et génération vidéo : https://docs.dev.runwayml.com/guides/using-the-api/
- Runway, sorties temporaires : https://docs.dev.runwayml.com/assets/outputs/
