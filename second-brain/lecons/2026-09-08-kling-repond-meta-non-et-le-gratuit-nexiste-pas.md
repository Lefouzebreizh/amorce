# Kling répond, Meta non, et le plan gratuit n'existe pas

08/09/2026 — sondé avant d'écrire la première ligne d'une intégration, sur un
brief qui annonçait deux fournisseurs et un quota gratuit.

## Ce qui répond depuis une session distante

| hôte | code | ce que ça veut dire |
| --- | --- | --- |
| `api.klingai.com` | **200** | joignable |
| `api-singapore.klingai.com` | **200** | joignable |
| `developer.meta.com` | `000` | tunnel refusé |
| `llama.developer.meta.com` | `000` | tunnel refusé |
| `api.meta.com` | `000` | tunnel refusé |
| `api.minimax.chat`, `api.minimaxi.chat` | `000` | tunnel refusé — Hailuo hors d'atteinte |

**Kling est le premier fournisseur de génération dont l'API directe répond
d'ici.** Sans clé, il rend une vraie erreur applicative, ce qui suffit à lire sa
surface :

```
POST /v1/videos/text2video       401 {"code":1001,"message":"Authorization is empty"}
POST /v1/images/generations      401 {"code":1001,"message":"Authorization is empty"}
GET  /v1/videos/text2video/{id}  401  → c'est la route de sondage
GET  /v1/tasks/{id}              404  → cette route n'existe pas
POST /text-to-video/kling-3.0-turbo
                                 401 {"code":1002,"message":"...does not support AK/SK..."}
```

Trois choses s'en déduisent sans dépenser un centime : la route de sondage n'est
pas `/v1/tasks/{id}` ; le passage de la signature AK/SK à une simple clé porteuse
est réel, l'API le dit elle-même ; et **Kling fait aussi de l'image**, ce qu'un
brief à deux fournisseurs ne suppose pas.

## Ce qu'une mesure d'ici ne dit pas

`000` sur Meta mesure **cette session**, pas la production. Une passerelle de
génération vit dans un Worker Cloudflare, et le `fetch` d'un Worker ne passe pas
par le mandataire de la session. Meta reste donc **constructible et non
éprouvable ici** — même partage que higgsfield et que les pages GitHub : on peut
agir, on ne peut pas regarder. Confondre les deux ferait rejeter un fournisseur
pour une raison qui n'est pas la sienne.

## Le chiffre qui renverse l'arithmétique

Le brief annonçait « un vrai plan gratuit avec crédits quotidiens généreux
(environ 60/jour) ». Le guide opérateur que **le brief lui-même recommande**
(`stuinfla/kling-skill`) décrit une facturation **à la seconde**, sans palier
gratuit :

| ce qu'on génère | prix |
| --- | --- |
| 5 s Turbo 1080p avec audio | **0,70 $** |
| 5 s silencieux (2.5-turbo) | **0,35 $** |
| un film de six plans × 5 s | **≈ 4,20 $** |
| une image | « une fraction de la vidéo » |

Un plan de comblement vidéo coûte donc **35 à 70 fois** une image à 0,01 $. Quand
la consigne de projet est « toujours l'option la moins chère à qualité égale »,
ce rapport ne règle pas un détail de budget : il décide **l'ordre dans lequel les
briques se construisent**.

## La leçon, au-delà de Kling

**Un brief qui cite sa propre source ne l'a pas forcément lue.** Celui-ci
recommandait d'installer le guide *avant de coder* — et le guide contredit le
paragraphe qui le recommande. Le geste qui l'a trouvé coûte deux minutes : cloner
le dépôt cité et chercher `credit|free|pricing|\$` dedans, avant d'accepter le
modèle économique annoncé.

Et le guide porte lui-même la règle qui vaut ici : *« latent knowledge is not
knowledge »* — son auteur a écrit le guide, puis généré six clips sans
l'appliquer.
