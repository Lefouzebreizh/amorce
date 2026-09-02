# Audit de sécurité — IPTV / VOD

**Date** : 02/09/2026 · **Périmètre** : `iptv/` (12 509 lignes TypeScript)
**Posture** : lecture seule. Aucun fichier de code modifié.

C'est le projet le plus exposé des quatre de ce lot, et le seul à porter un
constat grave.

## 🔴 CRITIQUE

### I-1 · Le mandataire de flux accepte n'importe quelle adresse interne (SSRF)

**Où** — `src/app/api/flux/route.ts:32-51` (résolution) et `:78` (la requête).

La signature est **bien faite** : HMAC-SHA256 sur l'URL, comparaison en temps
constant, longueurs vérifiées d'abord (`src/serveur/flux.ts:38-47`). Elle empêche
un inconnu de faire relayer une adresse de son choix, ce qui était l'objectif
écrit dans `CLAUDE.md`.

**Mais elle ne dit rien de la destination.** Après le contrôle :

```ts
amont = await fetch(cible.url, { headers: entetes, redirect: 'follow', signal: arret.signal })
```

Aucun contrôle de schéma, aucun contrôle d'hôte — `grep` sur `127.0.0.1`,
`localhost`, `169.254`, `hostname`, `protocol` dans ce fichier : **zéro
résultat**. Et les redirections sont **suivies**.

**Deux chemins y mènent, et le second n'exige aucune signature :**

| Paramètre | Contrôle | Origine de l'URL |
| --- | --- | --- |
| `?u=…&s=…` | signature vérifiée | signée par le serveur lui-même |
| `?e=<id>` | **aucun** | `depot().element(id)` — le catalogue importé |

**Pourquoi c'est dangereux** — Les URL du catalogue viennent d'une **liste M3U
fournie par un tiers**, c'est-à-dire précisément d'un abonnement IPTV dont on ne
maîtrise rien. Une entrée pointant sur `http://127.0.0.1:…`, sur un service du
réseau local, ou sur l'adresse de métadonnées d'un hébergeur devient une requête
émise par le serveur, dont la réponse est renvoyée au client.

`redirect: 'follow'` aggrave le cas : même une adresse externe d'apparence
banale peut rediriger vers une adresse interne, ce qui contournerait une liste
blanche appliquée à la seule URL de départ.

**Ce que je n'ai pas mesuré, et qui décide de la portée** : l'adresse d'écoute
réelle du serveur. En développement Next écoute en local ; `next start` écoute
sur toutes les interfaces. Sur un poste isolé, la surface est le réseau local de
l'utilisateur ; sur une machine exposée, c'est un pivot complet.

**Piste de correction** — Refuser, avant `fetch`, tout schéma autre que
`http`/`https` et toute adresse résolvant vers une plage privée, locale ou de
lien-local. Et parce que `redirect: 'follow'` défait ce contrôle, passer en
`redirect: 'manual'` et revalider chaque saut, ou plafonner les redirections en
revérifiant la cible à chaque fois.

## Ce qui est sain

- **La signature elle-même** : HMAC-SHA256, `timingSafeEqual`, comparaison de
  longueur avant — pas de fuite par le temps de réponse.
- **`spawn('ffmpeg', arguments_)` en forme tableau**, jamais de shell
  (`src/serveur/remux.ts:180`) : aucune injection de commande.
- **Un délai est posé sur la requête amont**, avec la raison écrite : un panneau
  saturé accepte la connexion sans répondre, et sans borne le lecteur reste muet
  plusieurs minutes.
- **Le refus est muet** (`403 Adresse refusée`, sans détail) : dire pourquoi une
  signature est invalide aide qui essaie d'en fabriquer une, et le code le dit.

## Non couvert

L'adresse d'écoute réelle · le schéma SQLite et ses requêtes · le testeur de
flux · la confrontation des dépendances à une base de vulnérabilités (aucun hôte
joignable d'ici).
