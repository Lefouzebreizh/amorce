# Anthropic rend un 401 explicite pour une clé invalide, distinct du 500 d'un collage en double

Sur `psy-ia`, un premier incident (même journée) avait révélé qu'une clé
`ANTHROPIC_API_KEY` collée en double (espace ou saut de ligne entre les deux
copies) fait planter `fetch` avec un `TypeError: Headers.append: … is an
invalid header value` — corrigé par un garde-fou qui refuse toute clé
contenant un caractère d'espacement (PR #916).

**Une fois ce garde-fou passé, un deuxième refus, de nature différente, est
resté sans diagnostic pendant un moment faute de journalisation côté
serveur** (corrigé par la PR #917, un simple `console.error` du statut et du
corps de la réponse d'Anthropic avant de rendre le message générique au
client). Une fois posé, le journal a rendu :

```
Anthropic a refusé la requête : 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011CexDX8a1KzAB2KfR2sCw8"}
```

**Ce qui est mesuré et vaut au-delà de ce projet** : Anthropic distingue
clairement, dans le corps JSON de sa réponse, une clé syntaxiquement propre
(sans espace, correctement formée) mais non reconnue — `401
authentication_error / invalid x-api-key` — d'un problème de facturation, de
modèle inconnu ou de quota, qui rendraient un autre `type` d'erreur. Sans
journaliser ce corps, les quatre causes se confondent derrière un même 502
générique côté client, et un diagnostic à distance devient impossible :
c'est exactement ce que la PR #917 corrige, et c'est la seule raison pour
laquelle cette cause a pu être nommée avant de demander quoi que ce soit à
l'humain.

**Ce que ça change pour toute session future qui diagnostique un rejet
LLM** : ne jamais s'arrêter à un statut HTTP générique renvoyé par sa propre
API — toujours journaliser (côté serveur, jamais renvoyé au client) le corps
de la réponse du fournisseur, qui porte presque toujours un `type` d'erreur
explicite. Le coût est nul (une ligne de `console.error`), le gain est un
diagnostic immédiat au lieu d'un aller-retour de conjectures avec le
propriétaire.
