# NexusCrypto : brancher le scanner en direct a exigé deux corrections trouvées en le regardant

**Ce qu'on a mesuré et que personne n'avait mesuré.** `strategy/moteur.py`
suppose qu'un actif possède toujours une série OHLCV pour calculer son ATR et
son score technique — vrai pour toute ligne de watchlist (une plateforme CCXT
en fournit une), faux pour un pool DexScreener, qu'aucune plateforme CCXT ne
connaît. Ce n'était pas visible tant que le scanner de pépites
(`strategy/pepites.py`) n'avait jamais été branché dans la boucle en direct :
la phrase du dépôt « un actif hors watchlist reçoit exactement le même
traitement qu'une ligne connue d'avance » était donc fausse dans les faits
dès qu'on essayait de la réaliser, pas seulement optimiste. La correction
retenue (score du scanner = décision d'achat directe, stop en pourcentage
fixe) est écrite dans `nexuscrypto/README.md` § 16 bis.

**Ce qui a coûté un aller-retour, deux fois, tous deux trouvés en lisant la
sortie réelle d'un test plutôt qu'en se fiant au vert.**

1. Un client HTTP factice de test répondait à `"/tokens/" in url` pour simuler
   le point d'entrée DexScreener `paires_du_jeton` — sauf que l'URL de RugCheck
   (`api.rugcheck.xyz/v1/tokens/{mint}/report/summary`) contient elle aussi
   `/tokens/`. Le premier jet du test qui devait prouver qu'un verdict de
   sécurité rejeté bloque un achat de pépite passait au vert **sans avoir
   jamais appelé RugCheck** — la réponse DexScreener vide était retournée à sa
   place, `juger([], ...)` faute de constat. Un test qui ne fait pas
   l'appel qu'il prétend vérifier est le même défaut que celui d'un
   contrôle qui saute en silence : il faut vérifier *ce qui a été mesuré*,
   pas seulement que le verdict final est le bon. Corrigé en distinguant les
   deux points d'entrée par nom d'hôte (`api.dexscreener.com`) plutôt que par
   fragment de chemin.
2. `risk_management.stops.evaluer()` annonçait « stop touché : … (4 ATR sous
   l'entrée, perte …) » y compris quand le stop venait du nouveau paramètre
   `stop_force` (pourcentage fixe, aucun ATR calculé). Le calcul était juste,
   le message racontait un mécanisme qui n'avait pas eu lieu — exactement la
   famille de défaut déjà nommée au §8 de `CLAUDE.md` : une mesure juste sur
   le mauvais objet. Vu en relisant la sortie du test de vente, pas en la
   lisant en diagonale pour son statut vert/rouge.

**Ce qui rend une phrase de ce dépôt fausse.** La phrase de `CLAUDE.md` (§4,
nexuscrypto) « un actif hors watchlist reçoit exactement le même traitement
qu'une ligne connue d'avance » décrivait une intention, pas un mécanisme
vérifié — corrigée pour dire que c'est vrai pour le *chemin de décision*
(score contre seuil, bouclier), pas pour le *calcul technique* (ATR, score
multi-facteurs), qui reste réservé aux actifs pour lesquels une série de
bougies existe.

**Un troisième défaut, trouvé par `garde-du-bot` en relisant le lot une
seconde fois, pas par un test qui rougissait.** `_passe_pepites` rafraîchissait
le prix d'une pépite détenue *après* l'appel à `_verifier_coupe_circuit` dans
`une_passe()`. `Portefeuille.valeur_totale(prix)` retombe sur `prix_moyen`
(prix d'achat) pour tout actif absent du dict `prix` — le coupe-circuit de
portefeuille restait donc **aveugle à la perte latente d'une pépite tant
qu'elle n'était pas vendue**, sur exactement la classe d'actifs la plus
volatile que ce lot introduit dans la boucle en direct. Le stop individuel de
la position, lui, fonctionnait très bien — c'est le garde-fou *agrégé* qui ne
voyait rien. Corrigé en scindant `_passe_pepites` en deux étages
(`_evaluer_sorties_pepites`, qui mute `prix` en place, avant le
coupe-circuit ; `_decouvrir_pepites` après), et gardé par un test qui fait
**vraiment** se déclencher le coupe-circuit sur une chute de pépite qui ne
touche pas son stop individuel — sans quoi le déclenchement observé pourrait
venir d'autre chose que du garde-fou de portefeuille agrégé. Une revue qui
relit un lot **deux fois** a trouvé deux défauts différents ; s'arrêter après
le premier passage l'aurait laissé passer.
