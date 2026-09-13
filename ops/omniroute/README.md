# OmniRoute — pilote privé

État au 13 septembre 2026 : pilote Docker préparé, pas encore déployé sur VPS.
L'accès SSH au VPS présente une empreinte différente de celle déjà connue ;
vérifier son identité depuis la console officielle de l'hébergeur avant connexion.
Ne pas effacer known_hosts ni désactiver StrictHostKeyChecking pour avancer.

## Pilote Windows local

OmniRoute 3.8.50 est installé dans `%LOCALAPPDATA%\OmniRoutePilot` sur le PC.
Le tableau de bord écoute sur `127.0.0.1:20128`, l'API sur `127.0.0.1:20129`.
Contrôles réussis : tableau de bord `/healthz` HTTP 200, connexion administrateur
HTTP 200, paramètres authentifiés HTTP 200, accès API anonyme
`/v1/models` HTTP 401. Le pont API n'expose pas `/healthz` : son contrôle de
disponibilité vérifie le refus 401 de `/v1/models`, sans lancer de génération.
L'authentification et la base restent dans `.runtime`, hors git.

Le client officiel Codex 0.154.0 est installé séparément dans
`%LOCALAPPDATA%\OmniRouteCodex`. Son app-server écoute sur `127.0.0.1:1456`,
protégé par un jeton de capacité local. Il utilise sa connexion ChatGPT existante ;
aucun jeton ChatGPT n'est copié dans OmniRoute. Une requête directe sur
`gpt-5.3-codex-spark` a répondu `OK`. Après correction du transport WebSocket
dans les 14 copies compilées du client de la version 3.8.50, la route
`/v1/messages` a répondu HTTP 200 avec `OK` en mode non streaming, puis HTTP 200
avec `OK` et l'événement terminal `message_stop` en streaming.
Un test minimal de Claude Code 2.1.270 a également réussi via OmniRoute :
`--print`, outils désactivés, modèle `cxa/gpt-5.3-codex-spark`, réponse
`OMNIROUTE_OK`, `is_error:false`, code de sortie 0 et durée API de 10,65 secondes.
Ce test valide une requête texte de bout en bout. La boucle `Read` a également
été validée après le second correctif décrit ci-dessous ; les autres outils
Claude Code et l'intégration OpenClaw restent à vérifier séparément.

Un essai réel avec l'outil `Read` a ensuite confirmé un second défaut : le
client exécute la lecture, mais `extractPromptText` ignore le résultat
`function_call_output` lors de la requête suivante. Le client répète alors
l'appel jusqu'à la limite de tours. `repair-cxa-tools.mjs` conserve l'appel,
ses arguments, son `call_id` et le résultat dans l'historique textuel du nouveau
thread. Les résultats sont sérialisés comme données JSON, sans exécution par
le routeur. Correction appliquée à la source et aux deux copies compilées de
l'exécuteur présentes sur ce PC. Le 13 septembre 2026 à 06:23 UTC, l'essai réel
a réussi : un appel `Read`, un résultat d'outil, deux tours, contenu aléatoire
restitué exactement, `is_error:false`, sortie 0. Les deux modes `/v1/messages`
ont également été revérifiés avec succès après ce correctif.

La validation a été répétée après l'arrêt contrôlé puis le redémarrage des deux
processus du pilote. Les trois écouteurs sont restés limités à `127.0.0.1` :
Codex sur `1456`, tableau de bord sur `20128` et API sur `20129`. Après reprise,
la clé absente et une clé volontairement incorrecte ont toutes deux été refusées
en HTTP 401 ; les requêtes authentifiées non streaming et streaming ont de
nouveau répondu HTTP 200 avec `OK`. La synchronisation cloud est restée
désactivée dans `/api/settings` et `/api/sync/cloud`.

Au moment du diagnostic, le quota Codex principal était épuisé et le quota
Spark était encore disponible. Cet état est daté ; il ne garantit pas la
disponibilité future et ne constitue pas une jauge des crédits en direct.

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

### Lancer Claude Code depuis le bureau

Le point d'entrée est `Claude-Code-OmniRoute.cmd` sur le bureau. Il appelle
`ensure-pilot.mjs`, qui vérifie Codex (`127.0.0.1:1456/readyz`, HTTP 200) et
OmniRoute (`127.0.0.1:20129/v1/models`, HTTP 401 anonyme), puis démarre les
services absents et attend leur disponibilité. Il ouvre ensuite Claude Code
dans `%USERPROFILE%\Documents\OmniRoute-Projets` via `claude-via-omniroute.mjs`.

Le raccourci `OmniRoute.url` ouvre le tableau de bord local. Au besoin,
`OmniRoute-Mot-de-passe.cmd` copie son mot de passe administrateur dans le
presse-papiers lorsque l'utilisateur le lance ; le secret n'est pas affiché.

Le lanceur utilise la clé locale dédiée et le modèle `cxa/gpt-5.3-codex-spark`,
avec une configuration Claude séparée dans `.runtime/claude-config`. Il ne
modifie pas la configuration Claude existante. Selon l'installation npm de
Claude Code, le point d'entrée peut être `bin/claude.exe` plutôt que `cli.js` ;
les deux sont pris en charge. Les essais texte et `Read` ne valident pas encore
l'ensemble des autres outils et fonctions interactives de Claude Code.

### Réparer le transport Codex de la version 3.8.50

`repair-cxa-client.mjs` ajoute le transport `wreq-js` existant lorsque le client
n'en reçoit aucun. L'authentification et les politiques d'approbation restent
inchangées. Sans liste de fichiers explicite, le script découvre toutes les
copies du client dans les chunks `open-sse*.js` et `[root-of-the-server]*.js`
de `dist/.build/next/server/chunks`, puis répare aussi la source TypeScript.
Le succès constaté sur ce PC a nécessité la correction des 14 copies compilées.

Arrêter les processus OmniRoute avant toute application ou restauration :

```powershell
$pilot = Join-Path $env:LOCALAPPDATA 'OmniRoutePilot'
$package = Join-Path $pilot 'node_modules\omniroute'
node "$pilot\repair-cxa-client.mjs" "$package" --check
node "$pilot\repair-cxa-client.mjs" "$package" --apply
```

Redémarrer avec le lanceur, puis vérifier `/v1/messages` en mode non streaming
et streaming. Pour revenir aux fichiers d'origine, arrêter OmniRoute puis :

```powershell
node "$pilot\repair-cxa-client.mjs" "$package" --restore
```

Conserver le dossier `.omniroute-repairs` du package : il contient les originaux.
Le script est limité à `omniroute@3.8.50`, vérifie les empreintes SHA-256,
préserve les sauvegardes existantes et peut être relancé sans répéter la mutation.
Il refuse les liens symboliques, les fichiers inattendus et les changements
concurrents détectés avant écriture. En cas de refus, examiner le fichier
concerné ; ne pas supprimer sa sauvegarde pour forcer l'application.

### Réparer le retour des outils

Appliquer le correctif client avant le correctif outils, à l'arrêt :

```powershell
node "$pilot\repair-cxa-tools.mjs" "$package" --check
node "$pilot\repair-cxa-tools.mjs" "$package" --apply
```

Après application des deux correctifs, utiliser `repair-cxa-tools.mjs --check`
pour contrôler les chunks. Leur sauvegarde outils inclut le correctif client.
Le contrôle client seul refuse ces fichiers modifiés : ne pas supprimer ses
sauvegardes ni affaiblir cette vérification. Pour tout restaurer, arrêter le
serveur, restaurer d'abord les outils (`repair-cxa-tools.mjs --restore`), puis
le client (`repair-cxa-client.mjs --restore`).

`probe-claude-tools.mjs <pilot-root>` effectue une vraie génération avec un
fichier dédié et un contenu aléatoire. Le succès exige exactement un appel
`Read`, un résultat d'outil et la restitution exacte de ce contenu. Il consomme
du quota et conserve uniquement le bilan du contrôle dans `.runtime`.

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

## Étape suivante sur le VPS : modèle réellement utilisable

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
