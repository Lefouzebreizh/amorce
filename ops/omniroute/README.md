# OmniRoute — pilote privé

État au 13 septembre 2026 : configuration préparée, pas encore déployée.
L'accès SSH au VPS présente une empreinte différente de celle déjà connue ;
vérifier son identité depuis la console officielle de l'hébergeur avant connexion.
Ne pas effacer known_hosts ni désactiver StrictHostKeyChecking pour avancer.

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
