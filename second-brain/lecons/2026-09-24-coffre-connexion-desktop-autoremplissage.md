# Mon Tiroir Secret — distinguer CORS, panne et code refusé

Mesuré le 24/09/2026 sur l’aperçu Vercel de `le-coffre` : après correction
des origines, Chrome ordinateur envoyait bien `OPTIONS` en **200**, puis
`POST` en **401** à `connexion-coffre` (17 h 37 et 17 h 40, heure de Paris).
Au même moment, `recuperer-code-coffre` répondait **200**. Le serveur et CORS
étaient donc joignables ; l’ordinateur transmettait un code refusé alors que
le même compte fonctionnait sur mobile.

Le piège venait de deux comportements combinés : le champ demandait
explicitement à Chrome un `current-password`, donc pouvait reprendre un ancien
code enregistré, et l’interface remplaçait toute erreur de fonction par
« identifiant ou mot de passe incorrect ». Une panne réseau, un refus d’origine
et une vraie 401 devenaient visuellement indiscernables.

Garde-fous posés : affichage/masquage du code, remise à zéro après 401, conseil
explicite sur l’autoremplissage, traduction des statuts 401/403/429 et des
erreurs réseau, plus mise à jour du service worker sans cache intermédiaire.
Le diagnostic futur doit partir des couples `OPTIONS`/`POST` dans
`function_edge_logs`, jamais du seul texte affiché par le client.
