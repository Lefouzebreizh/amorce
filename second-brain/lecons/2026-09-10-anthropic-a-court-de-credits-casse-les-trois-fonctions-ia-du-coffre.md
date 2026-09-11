# Le compte Anthropic d'`assistant-coffre` est à court de crédits — les trois fonctions IA du Tiroir Secret sont en panne

**Projet** : `le-coffre/` (Le Tiroir Secret).

## Ce qui a été mesuré

L'erreur « Je n'ai pas pu répondre à l'instant — réessaie dans un moment. »,
vue par le propriétaire sur son compte réel puis reproduite le 10/09/2026
en conditions réelles (compte de test jetable, bac à sable) sur une simple
question « mes photos », n'est pas un bogue de l'interface. Appel HTTP
direct de la fonction, sans passer par le client (clé publiable `anon`,
`verify_jwt: false`) :

```
POST https://hftofsrykuobbepfusuf.supabase.co/functions/v1/assistant-coffre
→ 502
{"erreur":"Appel Claude en échec (400) : {\"type\":\"error\",\"error\":{\"type\":\"invalid_request_error\",
\"message\":\"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing
to upgrade or purchase credits.\"},...}"}
```

Le compte Anthropic derrière `ANTHROPIC_API_KEY` (secret du projet Supabase
« LIFE ORGANIZER ») n'a plus de crédit. `grep` confirme que **trois**
fonctions Edge partagent ce même secret et donc la même panne, simultanément :
`assistant-coffre` (le chat), `classer-document` (le tri automatique à
chaque dépôt de papier) et `suggerer-champs-formulaire` (le pré-remplissage
CERFA). Ce n'est pas une fonctionnalité en panne, ce sont trois.

**Ce que ça change pour le diagnostic du 10/09/2026** : le bug signalé
« barre de recherche non cliquable » a été testé en conditions réelles
(clic, frappe, lecture de `inputValue()`) — le champ **répond
correctement** au clic et à la frappe, dans les deux passes de test. Ce qui
échoue, c'est ce qui se passe **après** l'envoi : la conversation s'ouvre,
l'appel serveur échoue, et l'utilisateur ne voit qu'un message d'excuse
générique. Vu depuis un usage non technique, « je tape et rien d'utile ne se
passe » se décrit facilement comme « c'est pas cliquable ».

## Le piège méthodologique qui a coûté du temps

`mcp__Supabase__query_logs` a rendu `Table "function_edge_logs" does not
exist` (et pareil pour `function_logs`, `postgres_logs`,
`information_schema.tables`) sur ce projet précis, alors que ce sont des
noms de table standard documentés par Supabase lui-même. Avant de conclure
à un défaut de méthode ou de syntaxe, l'appel direct de la fonction en HTTP
(via `curl`, avec la clé `anon` publiable — c'est exactement celle que le
navigateur utilise déjà, aucun secret à trouver) a rendu la vraie cause en
un seul appel, sans dépendre de l'explorateur de logs. Quand l'explorateur
de logs Supabase ne répond rien d'exploitable, rejouer l'appel HTTP
directement est plus rapide que d'insister sur la bonne syntaxe SQL.

## Ce qui reste à faire, et qui n'est pas du code

Recharger le crédit du compte Anthropic qui porte `ANTHROPIC_API_KEY` est
une dépense (§5 de `CLAUDE.md`) : seul le propriétaire peut la faire. Aucun
correctif de code ne rétablit ces trois fonctions tant que ce compte est à
sec.
