# Audit de sécurité — IPTV / VOD

**Date** : 02/09/2026 · **Périmètre** : `iptv/` (12 509 lignes TypeScript)
**Posture** : lecture seule. Aucun fichier de code modifié.

C'est le projet le plus exposé des quatre de ce lot, et le seul à porter un
constat grave.

**État au 05/09/2026 : ce constat grave est corrigé.** Le détail est dans le
bloc I-1 ci-dessous, qui reste écrit au présent de l'époque avec sa correction
en tête. Rien d'autre n'a été trouvé, et rien n'a été rouvert depuis.

## ✅ CORRIGÉ — ce qui était le seul constat critique

### I-1 · Le mandataire de flux accepte n'importe quelle adresse interne (SSRF)

> **Fermé le 03/09/2026**, commit `4d2c6e5` (PR #577). Vérifié sur `main` le
> 05/09 : `adresseRelayable()` vit dans `src/serveur/flux.ts`, elle est appelée
> **après** la résolution de la cible, et **revérifiée à chaque saut** de
> redirection, plafonnés à cinq. Cinq tests la tiennent dans les deux sens —
> `tests/adresse-relayable.test.ts`.
>
> Le constat est conservé tel qu'il a été écrit, avec ses numéros de ligne
> d'alors. Un rapport nettoyé se relit comme s'il n'avait jamais eu tort, et
> la prochaine session qui touche à ce mandataire a besoin de savoir **pourquoi**
> ce filtre existe.

**Où, à la date de l'audit** — `src/app/api/flux/route.ts:32-51` (résolution) et
`:78` (la requête). Les lignes ont bougé depuis le correctif.

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
