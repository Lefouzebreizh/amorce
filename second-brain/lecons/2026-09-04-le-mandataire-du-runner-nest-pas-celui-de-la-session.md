# Le mandataire d'une session distante n'est pas celui d'un runner GitHub

**04/09/2026, 11 h 17 → 11 h 18.** Premier tour du radar de pépites planifié.

## Ce qui a été mesuré

Depuis une session distante, les neuf hôtes de marché rendent `000` — mesuré le
28/08/2026 et toujours vrai. `api.dexscreener.com` en fait partie.

Le même code, lancé par un workflow GitHub Actions sur `ubuntu-latest`, rend :

```
828 paires → 182 jetons → 7 candidats en 17 s
```

La sonde du radar a répondu en **4 secondes** — pas de délai d'attente, donc pas
de tunnel refusé : les sources répondent vraiment. Sept jetons notés, avec leurs
adresses et leurs prix.

## Ce que ça coûte de ne pas le savoir

Le radar était **fini, vert et à l'arrêt depuis le 31/08**. 167 tests, cinq
étages, un seul scan réel à son actif. Personne ne le relançait, et la raison
tenait à une conséquence que tout le monde tirait d'une mesure juste :

> les hôtes de marché sont refusés → le radar ne peut pas tourner d'ici → il
> faut une machine du propriétaire, allumée et planifiée.

Les deux premières propositions sont vraies. **La troisième ne l'est pas** : il
existait depuis le début une machine toujours allumée, gratuite, et qui n'a pas
ce mandataire — le runner du dépôt lui-même. Cinq jours d'arrêt pour une porte
que personne n'avait poussée.

C'est la forme exacte que `CLAUDE.md` §7 décrit déjà pour KDP : *une
impossibilité mesurée ne rend vrai que ce qu'elle mesure*, et une conséquence
fausse attachée à une mesure juste se relit comme si elle avait été mesurée
elle aussi. Le cas KDP portait sur l'image ; celui-ci porte sur le réseau, et
c'est le même piège.

## La règle

**Avant de conclure qu'une tâche a besoin de la machine du propriétaire, se
demander si elle tiendrait dans un workflow.** Trois choses la rendent
éligible, et elles se vérifient en une minute :

- elle n'a besoin d'aucun secret, ou seulement de secrets déjà posés ;
- elle tient dans le temps d'un job, et ses dépendances s'installent depuis
  PyPI ou npm ;
- ce qu'elle produit peut vivre ailleurs que dans Git — cache, artefact, résumé
  d'exécution.

Ce qui **ne** se transpose **pas**, et qu'il ne faut pas déduire de cette
leçon : un runner n'a ni la carte graphique, ni les logiciels de bureau, ni les
comptes connectés du PC. Cette leçon dit qu'il a **du réseau**, et rien d'autre.

## Ce qui n'a pas été mesuré

Un seul hôte a été éprouvé de bout en bout — DexScreener, par la sonde du
radar. Les huit autres (`api.binance.com`, `api.bybit.com`, `api.kraken.com`,
`api.coingecko.com`, `api.hyperliquid.xyz`, `api.alternative.me`,
`www.reddit.com`, `api.llama.fi`) sont **probables et non vérifiés** : ils
tombaient pour la même raison, ils devraient se relever de la même façon. Le
jour où l'un d'eux compte, le sonder plutôt que le supposer — c'est
précisément l'erreur que cette leçon raconte.
