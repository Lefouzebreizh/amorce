# Le Phare — Studio de matière personnelle, 12 novembre 2026

## Cette tranche

Le chat unique et les projets de la PR #1045 sont conservés. « Prépare mon clip » ouvre maintenant un Studio d’assemblage local, et non seulement un devis. La vitrine publique n’est pas modifiée. Ce lot ne constitue pas la livraison de toute la vision Le Phare.

Parcours réel : importer un master audio et des images/vidéos personnelles, écouter, garder les paroles exactes, marquer leur début à l’écoute, ajuster les intervalles, choisir le rythme des coupes, assembler un MP4 720p horizontal ou vertical, le lire et le télécharger. Le manifeste joint garde les sources, leurs empreintes SHA-256 et les décisions de montage.

Les originaux ne sont pas réécrits. Le master est réencodé en AAC, sans remplacement de voix, composition ni mastering. Les paroles s’affichent par ligne, sans promesse de karaoké mot à mot. Les images ont un zoom lent ; des fondus de 0,4 seconde sont proposés par défaut, avec des coupes en option. Le fondu prolonge la dernière image du plan précédent pendant la transition, sans raccourcir le master. Les visuels sont réutilisés quand la durée l’exige ; les pistes sonores des vidéos ne sont pas mixées dans le master.

## Démarrer

Prérequis : Node 22.18 ou 24, dépendances npm installées, `ffmpeg` et `ffprobe` disponibles dans le PATH. À la racine du dépôt :

```
npm ci
npm run phare:local
```

Ouvrir l’adresse affichée (par défaut `http://localhost:3010/phare/atelier`), ouvrir « Studio · ma matière, mon clip » et saisir le code du terminal. Celui-ci reste dans `.phare-local/access-code`, jamais dans Git. Le lanceur ouvre le navigateur et déverrouille le Studio via un fragment éphémère retiré de l’adresse après lecture ; le code n’est pas envoyé dans une URL HTTP. Un cookie HttpOnly le remplace. Un second lancement retrouve le serveur personnel existant. Le lanceur force la conversation fournisseur désactivée. Il n’affiche aucune clé API.

Le dossier `.phare-local/` (ou `%LOCALAPPDATA%\LePhare\MaMatiere` sous Windows) contient les originaux importés, `state.json`, le code d’accès et les rendus/manifeste sous `jobs/`. **Le sauvegarder** : ce n’est pas un stockage cloud redondant. Un dossier externe peut être choisi avec `PHARE_LOCAL_DATA_DIR`. Ne pas choisir un dossier web public ni le partager. La déconnexion/rotation du code s’effectue en arrêtant le lanceur, supprimant `access-code` et le redémarrant.

Le serveur écoute exclusivement la boucle locale. Ce lot n’ouvre pas le PC sur Internet ou le réseau Wi-Fi et n’offre pas encore le pilotage depuis le téléphone. La vitrine Vercel refuse explicitement ces routes, même si une variable locale y est ajoutée.

Pour un démarrage plus léger, préparer une fois `npm run build` : le lanceur utilise ensuite `next start` et ne recompilera plus les pages à chaque ouverture. Sur un petit Windows, `PHARE_LOW_MEMORY=true` limite la préparation à un worker ; `NODE_OPTIONS=--max-old-space-size=1024` et `RAYON_NUM_THREADS=2` permettent de borner les ressources de compilation. Après une mise à jour, reconstruire avant de relancer.

Sous Windows, `npm run phare:raccourci` crée « Le Phare - Studio local » sur le Bureau, avec lancement réduit et ouverture du navigateur. Aucun service automatique ni règle de pare-feu n’est ajouté.

## Limites explicites

- Import en flux, maximum 512 Mo par fichier ; médias jusqu’à une heure, master de rendu jusqu’à dix minutes. Le budget disque n’est pas encore géré automatiquement.
- Les choix et le calage sont enregistrés avec le bouton de sauvegarde, et avant le rendu. Quitter un projet sans enregistrer perd les changements non sauvegardés. Un conflit de révision est refusé ; une sauvegarde concurrente n’est pas écrasée silencieusement.
- Un rendu CPU à la fois ; processus séparé, deux threads, progression par plans réellement traités. L’encodage final reste affiché comme tel sans pourcentage inventé.
- Les choix et travaux sont persistants sur disque ; un processus mort apparaît interrompu. Il faut relancer le rendu ; pas de reprise exacte en cours de plan. Le bouton d’annulation arrête le FFmpeg actif et conserve les sources et la session.
- Si le serveur est tué brutalement pendant une écriture, `state.lock` peut subsister. Arrêter toutes les instances avant de supprimer ce seul verrou ; conserver `state.json`, les médias et les travaux.
- Pas encore de mastering audio ni de connexion IA active : le chat local exécute ses commandes internes, il ne simule pas une IA générative. Pas d’analyse Gemini des médias, de génération de voix/images/vidéo, de moissonnage de banques, d’encaissement, de télécommande TV, ni de mastering professionnel dans ce lot.

## Compléments IA reçus le 12 novembre

Les deux nouveaux textes proposent un pont universel et Gemini principal. Ils sont des éléments de conception, pas une autorisation de dépense ou d’envoi des originaux à un fournisseur. Ordre retenu : fichiers personnels → complément libre avec licence vérifiée → génération facultative, explicitement chiffrée et validée.

L’API conversation Gemini déjà préparée dans #1045 reste désactivée. Une clé API n’est jamais une clé de session ChatGPT ; un abonnement à un chat ne prouve ni l’accès API ni l’inclusion des appels. Pour un raccordement ultérieur, `GEMINI_API_KEY` doit être placée **côté serveur uniquement**, dans `.env.local`, jamais dans une variable `NEXT_PUBLIC_`, dans le chat ou dans le dépôt. `PHARE_CHAT_ENABLED` et le contrôle d’accès restent fermés tant que le coût et le périmètre ne sont pas validés. Aucun nom de modèle Pro/Flash ou droit de génération n’est déduit de la seule présence de cette clé.

Le futur catalogue d’outils devra distinguer lecture, préparation et exécution. Recherche locale et checkpoint ne donnent pas le droit d’envoyer une voix, générer un média, encaisser une prestation ou modifier un dossier sensible. Les exports MCP/webhook et les autres fournisseurs ne sont pas implémentés ; ne pas les afficher comme connectés.

## Références artistiques

Le premier essai payant est rejeté : voix et style non conformes. Il ne sert pas de référence artistique. L’audio parlé/chanté/slamé original a été retrouvé ; il n’est ni un consentement au clonage, ni envoyé par ce Studio à une IA. Les trois titres Suno précis et le master/paroles du Phare restent à identifier/valider. Aucun texte de remplacement ne doit combler ce manque.

## Vérification de cette tranche

- 368 tests Node passent, dont un import en flux, contrôle d’accès, refus d’origine étrangère, lecture HTTP Range, conflit de révision, rendu FFmpeg réel et contrôle de l’empreinte originale.
- Typage valide. Lint : aucune erreur, 43 avertissements préexistants. Compilation Next valide.
- Chromium local : import d’un son sinusoïdal de test de trois secondes et d’une image unie (aucune prétention artistique), calage, sauvegarde, création et décodage du MP4 jusqu’à sa fin, paroles retrouvées après rechargement. Aucune exception JavaScript ; pas de débordement horizontal à 390 px. Captures ordinateur/mobile examinées dans la session.
- Corrigés pendant la QA : origine HTTP réécrite par Next, course au démarrage du worker, identifiants de projets initialement non persistés avant le premier message.
- Installation et dictée sur le PC/téléphone d’Erwann : voir le statut de reprise ci-dessous. Qualité artistique sur ses sources : à valider avec le vrai master et les bons visuels.

**Verdict produit complet : À CORRIGER AVANT LANCEMENT.** Ce lot est une tranche locale vérifiée, en PR brouillon ; ni publication en production, ni promesse de studio professionnel complet.


## Reprise : fondus et installation

Les fondus sont contrôlés dans les pixels du MP4 entre deux images rouge et bleue (présence simultanée des deux composantes), avec durée finale inchangée. Le test d’annulation lance et arrête un vrai worker ; il vérifie la conservation des sources. L’interface permet de prévisualiser et réordonner les visuels. La compilation pour petit ordinateur a été exercée avec un worker.

Installation Windows isolée : `%LOCALAPPDATA%\LePhare\app`, bibliothèque séparée `%LOCALAPPDATA%\LePhare\MaMatiere`. L’ancien Centre de contrôle n’est pas modifié. Installation Windows et raccourci vérifiés le 12 novembre 2026. Le raccourci a ouvert le serveur personnel sur `http://localhost:3010/phare/atelier` ; le Studio déverrouillé et la bibliothèque personnelle distincte des essais ont été contrôlés. Le serveur reste accessible uniquement sur ce PC.


Contrôle Windows dans Chrome : import, master, paroles, deux visuels avec fondu contrôlé dans les pixels, rendu, décodage complet, téléchargement MP4, annulation et restauration réussis, sans exception JavaScript ni débordement à 390 px. Un clip **technique synthétique** de six secondes a été assemblé en 6,621 secondes (ceci ne mesure pas un morceau artistique complet). Détection de l’API de dictée positive ; microphone physique non testé. Gemini et les générations payantes sont désactivés.

Rapports privés sur le PC : `%LOCALAPPDATA%\LePhare\ControleTechnique\controle-windows.json` et `%LOCALAPPDATA%\LePhare\controle-installation.json`. Les fichiers techniques restent dans `ControleTechnique`, séparés de `MaMatiere`. Le serveur de contrôle a été arrêté après validation ; le raccourci ouvre le serveur personnel.

## Pilotage depuis Android sur le même Wi-Fi

Le smartphone est le poste de commande. Le PC héberge la bibliothèque et FFmpeg ; il doit rester allumé, avec Le Phare ouvert. Aucun calcul lourd ni abonnement n’est demandé au téléphone.

Le lanceur accepte un mode Wi-Fi explicite : `PHARE_LAN_IP` pour une adresse privée, ou un fichier `wifi.json` dans la bibliothèque contenant `{"interface":"Wi-Fi"}`. Dans ce dernier cas l’adresse est retrouvée sur cette interface au démarrage. La boucle locale reste disponible ; les mutations par le réseau sont limitées à l’hôte Wi-Fi exact et à son origine, avec le même cookie HttpOnly personnel. Aucun transfert de port du routeur ni tunnel public n’est créé. Une éventuelle autorisation du pare-feu doit être limitée au besoin ; sur le PC contrôlé, Node disposait déjà d’une autorisation entrante.

Le lien personnel utilise un fragment pour déverrouiller puis retire le code de l’adresse. Ne pas publier ce lien. Sur le téléphone : ouvrir dans Chrome, puis ajouter à l’écran d’accueil si souhaité. Les imports du téléphone sont copiés sur le PC ; les rendus se téléchargent dans le téléphone.

Le carnet commun est stocké sur le PC dans `workspace.json`, avec contrôle de révision. Les appareils connectés le retrouvent et rafraîchissent les changements ; une sauvegarde concurrente périmée est refusée. L’ancienne sauvegarde locale d’un navigateur contenant des notes est conservée avant sa première liaison et reste téléchargeable. Le changement d’onglet/projet ne doit pas être confondu avec une autorisation de réécrire un original.

Sur un lien Wi-Fi HTTP, Android ne permet pas le micro Web Speech de la page. La dictée du clavier Android reste utilisable dans la saisie ; elle dépend du clavier installé. Ne pas prétendre avoir vérifié le microphone physique ou une conversation vocale Gemini. L’accès hors de ce Wi-Fi et le micro intégré à la page demandent un raccordement HTTPS ultérieur.

Contrôles du mode mobile : 369 tests passent. Deux sessions navigateur indépendantes ont échangé leurs notes dans les deux sens via le carnet commun, puis l’interface Android simulée a importé ses fichiers, lancé le montage et lu le MP4 jusqu’à sa fin. HTTP privé non sécurisé : UUID de repli cryptographique vérifié, micro Web Speech désactivé et consigne de dictée clavier visible. Aucun débordement ni exception JavaScript.

Sur le PC Windows, l’accès par son adresse Wi-Fi privée, le déverrouillage et le carnet commun ont été contrôlés dans Chrome en format mobile. Aucune règle de pare-feu n’a été ajoutée ; les autorisations Node existantes ont suffi. Rapport et capture privés : `%LOCALAPPDATA%\\LePhare\\controle-mobile-wifi.json` et `controle-mobile-wifi.png`. Le lien personnel a été transmis au propriétaire pour un essai sur son Redmi ; le résultat sur le téléphone physique reste à confirmer. Ne jamais consigner le fragment d’accès dans Git.
