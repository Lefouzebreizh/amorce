# Sur cet environnement, la navigation générale vers l'internet public est bloquée — pas seulement les hôtes déjà connus

*11/09/2026 — mesuré en préparant `audit-landing/capturer_page.py`.*

## Ce qui a été mesuré

`CLAUDE.md` §7 documente des hôtes précis refusés (réseaux sociaux, données
de marché, YouTube…) pendant que GitHub, PyPI et npm passent. Ça a fait
lire ce mandataire comme une **liste noire ciblée**. Sur *cette* session
précise, ce n'en est pas une : c'est une **liste blanche**, et tout ce qui
n'y figure pas est refusé, y compris des domaines neutres sans aucun rapport
avec un cas déjà connu.

Quatre clients différents, même verdict sur `qonto.com` :

| Client | Résultat |
| --- | --- |
| `curl` | `CONNECT tunnel failed, 403` |
| `WebFetch` (service distinct d'Anthropic) | `EGRESS_BLOCKED` |
| `curl` sur `example.com`, `en.wikipedia.org`, `stripe.com` | même refus |
| Chromium/Playwright (l'outil réellement livré) | `net::ERR_TUNNEL_CONNECTION_FAILED` |

Le fait que `example.com` et `wikipedia.org` — deux domaines sans rapport
avec un quelconque cas déjà documenté — soient refusés au même titre que
`qonto.com` est ce qui tranche : ce n'est pas une politique par hôte connu,
c'est une politique par défaut fermé. `curl -sS
http://127.0.0.1:44153/__agentproxy/status` le confirme : `noProxy` ne liste
que des hôtes techniques (npm, PyPI, GitHub, Anthropic, réseaux privés) — rien
n'indique une liste noire, tout indique une liste blanche.

## Pourquoi ça compte

`WebFetch` échouant aussi est la partie utile : jusqu'ici, la parade
« changer de client » (le cœur du §7) avait toujours fini par trouver un
chemin — un connecteur MCP, PyPI, un objet de release GitHub. Ici, quatre
clients dont un service tiers d'Anthropic donnent le même refus : ce n'est
plus « ce client-ci est bloqué », c'est une politique d'environnement qui ne
laisse littéralement aucune porte pour un domaine arbitraire.

## Ce que ça ne dit pas

Ceci est propre à **cet environnement précis** (« Claude Code sur le web »,
créé avec une politique réseau donnée à la création) — pas une propriété
générale de toute session distante. Un autre environnement, une autre
politique réseau choisie à la création, peut très bien autoriser la
navigation générale. Avant de conclure à un mur, vérifier
`http://127.0.0.1:44153/__agentproxy/status` (si ce mandataire existe) et
tenter un domaine témoin neutre plutôt que de généraliser depuis un seul
domaine refusé.
