---
name: capacites-session
description: Savoir ce que cette session-ci peut réellement faire — binaires présents, bibliothèques installées, hôtes que le mandataire laisse joindre, modèles en cache — et par quoi remplacer ce qui manque. Sonde le terrain en une seconde avec `sonder.py`. À utiliser avant toute tâche qui dépend du réseau ou d'un outil externe : transcrire un média, fabriquer une voix, lancer un navigateur, appeler une API, télécharger un modèle, installer une dépendance — et dès qu'une commande échoue par « 403 », « connection refused », « command not found » ou « please run install ». À utiliser aussi avant d'annoncer un résultat qui dépend d'un de ces outils : une promesse tenue à moitié coûte plus cher qu'un « voici ce que je peux faire ici ».
---

# Ce que cette session peut faire

Une session distante n'a ni les binaires, ni le réseau, ni les modèles d'une
machine de développement. Elle ne le dit pas : on l'apprend en pleine tâche,
souvent après avoir annoncé un résultat.

```bash
python3 .claude/skills/capacites-session/scripts/sonder.py
python3 .claude/skills/capacites-session/scripts/sonder.py --court   # une ligne
```

Une seconde. Les binaires, les bibliothèques Python, les paquets Node, huit
hôtes et les modèles en cache, avec le repli de chacun.

## Quand le sonder change quelque chose

Trois moments, et ce sont les seuls :

1. **Avant de planifier** une tâche qui dépend du dehors — média, navigateur,
   API, dépendance à installer. Le plan tient compte du terrain au lieu de
   l'espérer.
2. **Après un échec inexpliqué.** Un `403`, un `command not found`, un
   « please run install » : la sonde dit en une ligne si c'est le terrain ou le
   code.
3. **Avant d'annoncer.** Une promesse tenue à moitié coûte plus cher qu'un
   « voici ce qui est possible ici, voici ce qui demandera votre machine ».

## Une sonde est un instantané, pas une vérité

Le terrain bouge pendant la session. Mesuré ici : `ffprobe` était réellement
absent au démarrage — le hook le disait, la sonde le confirmait — et il était là
vingt minutes plus tard, sans que rien dans le dépôt n'ait changé. L'image
continue de se garnir après le premier message.

Deux conséquences, et la seconde est celle qu'on oublie :

- **Après un échec inexpliqué**, re-sonder avant de conclure. Ce qui manquait
  peut être arrivé.
- **Après un succès inattendu** aussi. Une capacité qui réapparaît invalide une
  limite annoncée à l'utilisateur : lui avoir dit « impossible ici » et ne pas y
  revenir laisse une fausse contrainte en place, parfois pour des semaines.

La sonde ne se mémorise donc pas d'un tour de conversation à l'autre. Elle coûte
une seconde ; la relancer est toujours moins cher que raisonner sur un état
périmé.

## Ce qui manque a presque toujours un repli

Le script les affiche à côté du manque, au moment où on les lit. Les quatre qui
ont déjà coûté un détour dans ce dépôt :

| Ce qui manque | Ce qu'on fait à la place |
| --- | --- |
| `ffprobe` | `ffmpeg -i fichier` donne les mêmes informations sur sa sortie d'erreur. `imageio-ffmpeg` fournit ffmpeg, jamais ffprobe. |
| Modèle Whisper | Le téléchargement est refusé ici. Demander le texte, ou faire lancer la transcription sur la machine de l'utilisateur. **Ne pas réessayer** : ce n'est pas une panne passagère. |
| Voix edge-tts | Le service refuse les sessions distantes. Écrire le code, le couvrir par des tests unitaires, et le dire — plutôt que l'annoncer vérifié. |
| Cloudflare (`wrangler`) | `api.cloudflare.com` et `dash.cloudflare.com` rendent **000** — mesuré le 30/08/2026 avec témoins, `api.github.com` et `registry.npmjs.org` répondant 200. Un jeton n'y changerait rien : le mandataire refuse le tunnel, et `wrangler login` ouvre justement `dash.cloudflare.com`. **Le repli est GitHub Actions** : le workflow « Annuaire IA — mise en ligne » déploie depuis un runner, où Cloudflare est joignable. Il ne manque que deux secrets de dépôt. |
| Chromium de Playwright | Il est là, mais pas à la révision attendue : `AMORCE_CHROMIUM=/opt/pw-browsers/chromium`. Ne **jamais** lancer `playwright install`, le dépôt l'interdit. |
| Serveur MCP Hedra | **Les cinq hôtes rendent 000** — `mcp.hedra.com`, `api.hedra.com`, `hedra.com`, `docs.hedra.com`, `www.hedra.com`, mesuré le 01/09/2026. La passerelle répond **403 au CONNECT**, visible dans `recentRelayFailures` de `curl $HTTPS_PROXY/__agentproxy/status`. Une clé d'API n'y change rien, et la doc officielle n'est pas lisible d'ici non plus. **Ni npm ni GitHub n'ont d'équivalent officiel** : `hedra-mcp`, `@hedra/mcp`, `@hedra/mcp-server` rendent 404, et GitHub ne connaît que deux dépôts communautaires à 2 et 0 étoiles. Le repli est la machine du propriétaire, ou l'ouverture de l'hôte dans la politique réseau de l'environnement. |
| API ElevenLabs | **`api.elevenlabs.io`, `elevenlabs.io` et `api.us.elevenlabs.io` rendent 000** — `connect_rejected`, mesuré le 01/09/2026. Une clé n'y change rien, le tunnel étant refusé avant toute requête. **Le SDK, lui, est installé** (2.65.0, via PyPI qui est dans le `noProxy`) : sa surface se lit, le code s'écrit et s'éprouve hors réseau. `.claude/skills/bande-son/scripts/eleven_sfx.py` est écrit sur ce modèle et tourne sur la machine du propriétaire. |

## La règle qui fait gagner du temps

**Un hôte refusé par le mandataire ne se retente pas.** Le refus vient de la
politique réseau de la session, pas d'un incident : la deuxième tentative
échouera exactement comme la première, et la troisième aussi. Ce qui se gagne,
c'est ce qu'on fait ensuite — annoncer la limite, proposer le chemin local,
continuer sur ce qui marche.

Le corollaire vaut autant : **un outil absent ne s'installe pas par réflexe**.
Sur ce dépôt, `playwright install` est explicitement interdit et retéléchargerait
un navigateur déjà présent. Chercher le repli avant l'installation.

## Étendre la sonde

Les listes de `sonder.py` ne sont pas génériques : ce sont les besoins réels des
projets d'ici. En ajouter une entrée se justifie par un usage constaté, pas par
une intuition — une sonde qui grossit sans raison ralentit chaque démarrage et
finit par n'être plus lancée.

Quand une capacité manque **et** qu'un repli existe, l'écrire dans `REPLIS` :
c'est ce que la prochaine session lira au moment exact où elle en a besoin.
