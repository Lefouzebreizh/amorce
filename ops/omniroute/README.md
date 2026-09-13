# OmniRoute — pilote privé

État au 13 septembre 2026 : pilote Docker préparé, pas encore déployé sur VPS.
L'accès SSH au VPS présente une empreinte différente de celle déjà connue ;
vérifier son identité depuis la console officielle de l'hébergeur avant connexion.
Ne pas effacer known_hosts ni désactiver StrictHostKeyChecking pour avancer.

## Pilote Windows local

OmniRoute 3.8.50 est installé dans `%LOCALAPPDATA%\OmniRoutePilot` sur le PC.
Le tableau de bord écoute sur `127.0.0.1:20128`, l'API sur `127.0.0.1:20129`.
Contrôles réussis : santé HTTP 200, connexion administrateur HTTP 200,
paramètres authentifiés HTTP 200, accès API anonyme refusé HTTP 401.
L'authentification et la base restent dans `.runtime`, hors git.

Le client officiel Codex 0.154.0 est installé séparément dans
`%LOCALAPPDATA%\OmniRouteCodex`. Son app-server écoute sur `127.0.0.1:1456`,
protégé par un jeton de capacité local. Il utilise sa connexion ChatGPT existante ;
aucun jeton ChatGPT n'est copié dans OmniRoute. Une requête directe sur
`gpt-5.3-codex-spark` a répondu `OK`. La route OmniRoute renvoie encore une erreur
de traduction ; son correctif est en cours de validation.

Les scripts prennent le répertoire d'installation OmniRoute comme premier
argument. `launch-codex.mjs` prend également le répertoire d'installation Codex
comme second argument. `launch-local.mjs` récupère la configuration app-server
si le fichier de capacité existe. Le fournisseur `cxa` est synthétique :
ne pas tenter de créer une connexion via `POST /api/providers` et ne pas
restreindre la clé par `allowedConnections`. `connect-codex.mjs` limite la clé
aux modèles Spark explicitement préfixés, sans résolution automatique.

La synchronisation cloud a été désactivée par `POST /api/sync/cloud`
avec `{"action":"disable"}` puis vérifiée par deux GET : `/api/settings`
(`cloudEnabled:false`) et `/api/sync/cloud` (`enabled:false`). Le PATCH général
des paramètres ignore ce champ dans cette version. Le POST dédié peut répondre
500 si aucune URL cloud n'est configurée, après avoir persisté la désactivation.

`probe-codex.mjs` lit les métadonnées du compte sans génération.
`probe-codex-turn.mjs` et `probe-route.mjs` effectuent des générations de test ;
leur exécution consomme éventuellement du quota ou des crédits. Le pilote
Windows n'a pas l'isolation réseau du pilote Docker décrit ci-dessous.

## Démarrage par l'opérateur

Sur le VPS authentifié, vérifier Docker Compose, les ressources libres et les
ports 20128/20129 avant de démarrer. Ce pilote crée son propre volume ; ne pas
y importer les identifiants ni bases des autres applications.

```sh
cd ops/omniroute
python3 prepare.py
docker compose --env-file .runtime/.env config --quiet
docker compose --env-file .runtime/.env pull
docker compose --env-file .runtime/.env up -d --wait --wait-timeout 120
curl --fail --max-time 10 http://127.0.0.1:20128/healthz
docker compose --env-file .runtime/.env ps
```

Le fichier `.runtime/.env` reste uniquement sur le serveur, permissions 600,
et doit être conservé avec le volume chiffré. Ne jamais afficher `compose config`
sans `--quiet` ni publier les variables ou journaux bruts. Aucun secret fournisseur
n'est importé. Le mot de passe initial est généré localement, jamais CHANGEME.

Le réseau `internal: true` interdit les sorties du conteneur. Ce premier palier
valide l'installation, l'authentification et la persistance ; il ne permet pas
encore l'inférence. Le contrôle `/healthz` ne contacte aucun modèle.
Les connexions aux modèles gratuits sans clé existent en amont : une base vide
ne suffit donc pas à garantir l'absence de sortie réseau.

Accès au tableau de bord : tunnel SSH authentifié vers 127.0.0.1:20128, de
préférence via Tailscale lorsque la connexion est rétablie. Les ports du pilote
écoutent uniquement sur loopback. Aucun domaine public ni tunnel public.

## Étape suivante : modèle réellement utilisable

Avant d'ouvrir les sorties réseau, choisir un fournisseur autorisé, vérifier
son mode d'authentification et son coût, désactiver les fournisseurs inutiles,
puis tester une requête explicite, l'authentification et le streaming.
Ne pas utiliser le modèle auto pour cette validation. ChatGPT et les crédits
API sont distincts ; cette configuration ne prouve pas que Claude Code et
OpenClaw peuvent être financés par le seul abonnement ChatGPT.

La voie Codex app-server proposée par OmniRoute doit être vérifiée séparément
avec le client officiel et les droits du compte. Aucun cookie navigateur,
contournement de quota ou rejeu de session OAuth n'est requis par ce pilote.

## Arrêt et reprise

```sh
docker compose --env-file .runtime/.env stop
docker compose --env-file .runtime/.env up -d --wait --wait-timeout 120
```

Le volume et les secrets sont conservés. Ne pas utiliser `down -v`. Avant toute
mise à niveau, sauvegarder à l'arrêt le volume et les secrets, tester la restauration,
puis sélectionner une nouvelle version. L'image est fixée à 3.8.50 ; son digest
reste à relever après téléchargement. Aucune mise à jour automatique.

## Sources contrôlées

- [Release v3.8.50](https://github.com/diegosouzapw/OmniRoute/releases/tag/v3.8.50)
- [Image et utilisateur non privilégié](https://github.com/diegosouzapw/OmniRoute/blob/v3.8.50/Dockerfile)
- [Variables officielles](https://github.com/diegosouzapw/OmniRoute/blob/v3.8.50/.env.example)
- [Healthcheck sans inférence](https://github.com/diegosouzapw/OmniRoute/blob/v3.8.50/scripts/dev/healthcheck.mjs)
- [Intégration Codex app-server](https://github.com/diegosouzapw/OmniRoute/blob/v3.8.50/docs/guides/CODEX-APP-SERVER-PROVIDER.md)
