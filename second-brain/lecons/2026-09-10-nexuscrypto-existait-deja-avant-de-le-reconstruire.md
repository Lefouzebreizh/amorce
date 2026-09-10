# NexusCrypto existait déjà avant de le reconstruire

**Ce qu'on a mesuré et que personne n'avait mesuré.** Une demande de
« reconstruction complète du bot depuis zéro » sur cinq axes précis (détection
multi-signaux, gestion du risque à 1-2 % par position, backtest puis paper
trading avant tout argent réel, exécution Binance autonome, garde-fou sur les
paramètres critiques) a été confrontée au code réel de `nexuscrypto/` avant
d'écrire la moindre ligne. Résultat : quatre des cinq axes existaient déjà,
testés, et n'avaient pas besoin d'être détruits.

| Exigence | État réel avant la demande |
| --- | --- |
| Risque ≤ 1-2 % par position | `risk_management/sizing.py` — dimensionnement par distance au stop, déjà à 1 % par défaut, plafonné à 10 % par la validation de configuration |
| Stop-loss / take-profit liés à la volatilité | `risk_management/stops.py` — stop ATR dynamique, prise de bénéfice suiveuse qui ne recule jamais |
| Pause automatique si le marché déraille | `risk_management/coupe_circuit.py` — quatre déclencheurs (drawdown journalier, drawdown total, chute d'un actif en 1h, perte de vue réseau), réarmement automatique sauf le pire cas |
| Backtest multi-régimes | `nexuscrypto rejeu --profils` (six marchés fabriqués) + `--coinmetrics` (seize ans de BTC réel) |
| Paper trading réaliste | `execution/courtier.py` — `CourtierPapier` simule frais, glissement par profondeur de carnet, exécution partielle |
| Exécution Binance | `execution/courtier.py` — `CourtierCCXT`, générique via CCXT, `plateforme: binance` déjà le défaut de `config.yaml` |

Seul manquait vraiment : un garde-fou qui *empêche* le passage en réel tant que
le backtest et le paper trading ne sont pas *documentés et signés* (avant, seul
`--je-confirme` existait — une intention, pas une preuve), le retrait de
Telegram, et une partie du multi-signal (ratio volume/capitalisation, ajouté ;
vitesse de croissance des détenteurs et exclusion sur revente d'initiés,
**pas** ajoutés — voir plus bas).

**Ce qui a coûté un aller-retour, évité de justesse.** La demande citait « un
type de dérive qui a produit l'ancien bot cassé » en parlant de paramètres
critiques changés en autonomie. Le réflexe naturel était de commencer la
reconstruction : cartographier d'abord (`grep`, lecture des modules
`risk_management/`, `execution/`, `strategy/moteur.py`) a montré que le
« bot cassé » du post-mortem était le radar `pepites/` (racine du dépôt) et son
seuil d'alerte à 70 jamais franchi — un scanner Telegram, pas le moteur
d'exécution de `nexuscrypto/`. Détruire et réécrire `risk_management/` et
`execution/` aurait jeté 337 tests qui couvraient déjà, pour l'essentiel, ce
qui était demandé.

**Ce qui rend une phrase de ce dépôt fausse.** Rien dans `CLAUDE.md` n'affirmait
que `nexuscrypto/` manquait de garde-fous de risque — au contraire, le bloc
existant les décrivait déjà en détail. La correction n'est donc pas dans
`CLAUDE.md` mais dans la manière de lire une demande de reconstruction : une
demande formulée par exigences (« je veux X, Y, Z ») décrit un besoin, pas
nécessairement un diagnostic exact de ce qui existe déjà. Le §10
« vérifier avant de corriger » couvre le cas d'une description de défaut
fournie par le propriétaire ; ce cas-ci en est la version pour une demande de
reconstruction — la mesurer avant de la débiter en tâches.

**Ce qui n'a délibérément pas été fait, et pourquoi.** La vitesse de
croissance des détenteurs et l'exclusion sur revente d'initiés/baleines après
un pic demandent des données on-chain (nombre de détenteurs dans le temps,
solde courant d'une adresse contre ce qu'elle a reçu) dont les champs exacts
(GoPlus, Etherscan V2) n'ont pas pu être vérifiés en direct depuis cette
session — `api.etherscan.io` et `api.gopluslabs.io` rendent `000` au
mandataire (`CONNECT tunnel failed, 403`), comme la plupart des hôtes de
données de marché déjà recensés au §7. Écrire ces signaux contre des noms de
champs supposés de mémoire, pour un garde-fou qui touche à de l'argent réel,
aurait été exactement le défaut que `/api-tierce-verifiee` existe pour éviter.
Ces deux signaux restent à construire sur la machine du propriétaire ou sur le
runner du dépôt, qui ont du vrai réseau.
