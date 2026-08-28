# NexusCrypto — moteur d'investissement autonome à DCA dynamique

Ossature logicielle d'un système d'investissement crypto qui décide seul : il
lit le marché, les données on-chain, la température communautaire et
l'actualité macro, en tire un indice de confiance, et fait varier le **montant**
de ses achats programmés — sans jamais toucher au calendrier.

> **Ce que cet outil n'est pas.** Il ne prédit rien et ne promet rien. Il
> applique une discipline d'achat régulier en modulant les montants selon la
> zone de valorisation, et il refuse d'agir plus souvent qu'il n'agit. Le mode
> simulation est le défaut, le mode réel demande deux gestes explicites, et
> aucun réglage de ce dépôt n'a été éprouvé sur de l'argent. Un backtest vert
> n'est pas une performance future.

---

## 1. Ce qui tourne aujourd'hui

```
nexuscrypto/
├── README.md
├── requirements.txt          # quatre dépendances, et la liste de ce qui est refusé
├── .env.example              # secrets — le `.env` réel n'est jamais versionné
├── config/
│   └── config.yaml           # ✅ tous les paramètres ajustables, en un seul endroit
├── main.py                   # ✅ simulation | production | analyser | pepites | verifier
├── src/
│   ├── core/
│   │   ├── modeles.py        # ✅ ce qui circule d'un module à l'autre, gelé
│   │   ├── config.py         # ✅ chargement, validation stricte, refus de démarrer
│   │   ├── reseau.py         # ✅ client async, reprise, limiteur, erreurs typées
│   │   └── journal.py        # ✅ journal tournant, filtre de secrets
│   ├── data_engine/
│   │   ├── marche.py         # ✅ CCXT (Binance, Bybit) + Hyperliquid en REST
│   │   ├── onchain.py        # ✅ DeFiLlama + DexScreener
│   │   ├── sentiment.py      # ✅ Fear & Greed + lexique pondéré du domaine
│   │   ├── macro.py          # ✅ flux RSS + classement par gravité
│   │   └── agregateur.py     # ✅ tout de front, tolérant aux pannes
│   ├── strategy/
│   │   ├── indicateurs.py    # ✅ RSI, EMA, ATR, profil de volume — Python pur
│   │   ├── scoring.py        # ✅ indice de confiance 0-100, poids redistribués
│   │   ├── dca.py            # ✅ calendrier d'un côté, montant de l'autre
│   │   ├── pepites.py        # ✅ scanner d'anomalies de volume
│   │   └── moteur.py         # ✅ contexte → décision, sans réseau ni ordre
│   ├── risk_management/
│   │   ├── portefeuille.py   # ✅ état immuable, dérive contre l'allocation cible
│   │   ├── sizing.py         # ✅ taille décidée par la distance au stop
│   │   ├── stops.py          # ✅ stop à l'ATR, prise de bénéfice suiveuse
│   │   └── coupe_circuit.py  # ✅ quatre déclencheurs, réarmement gradué
│   ├── execution/
│   │   ├── courtier.py       # ✅ simulation réaliste + CCXT réel
│   │   └── gestionnaire.py   # ✅ le seul chemin entre une décision et le marché
│   ├── notifications/
│   │   ├── canaux.py         # ✅ console, Telegram, Discord — en HTTP nu
│   │   └── messages.py       # ✅ mise en forme, testée sans réseau
│   ├── rejeu/
│   │   ├── donnees.py        # ✅ CSV de bougies + six marchés fabriqués
│   │   ├── rejeu.py          # ✅ la boucle, sans regard vers l'avenir
│   │   └── rapport.py        # ✅ mesures, tableau, verdict
│   └── orchestrateur.py      # ✅ l'assemblage et la boucle
├── profils.py                # ✅ l'effet d'un réglage sur six marchés connus
├── logs/                     # journal tournant (ignoré par Git)
└── tests/                    # ✅ 251 tests, aucun ne touche au réseau
```

`python3 -m unittest discover -s tests` : **251 tests, moins de deux secondes.**
La suite entière passe avec `aiohttp`, `ccxt`, `pandas` et `numpy` bloqués à
l'import — c'est vérifié, et c'est la propriété qui rend le moteur de décision
reproductible ailleurs que sur la machine qui l'a écrit.

---

## 2. Démarrer

```bash
cd nexuscrypto
pip install -r requirements.txt
cp .env.example .env            # facultatif : la simulation n'a besoin d'aucune clé

python3 main.py verifier        # valide la configuration et sort
python3 main.py rejeu           # rejoue la stratégie sur six marchés fabriqués
python3 main.py analyser        # décide et affiche, sans exécuter — à faire en premier
python3 main.py simulation --une-passe
python3 main.py simulation      # boucle en mode papier
```

Le mode réel demande **deux gestes**, pas un :

```bash
python3 main.py production --je-confirme
```

La sous-commande *et* le drapeau. Un seul geste serait franchissable par une
faute de frappe dans un fichier de service, et ce programme passe des ordres.

---

## 3. Le portefeuille cible

| Ligne | Poids | Rôle | Vendu sur signal |
| --- | --- | --- | --- |
| BTC | 50 % | socle et tendance de marché | **non** — c'est la réserve |
| SOL | 20 % | écosystème haute performance | oui |
| ETH | 10 % | contrats intelligents et DeFi | oui |
| HYPE | 10 % | pépite, via Hyperliquid | oui |
| LINK | 5 % | pépite | oui |
| réserve de découverte | 5 % | ce que le scanner ramène, 150 $ par jeton | oui |

La somme fait exactement 100, et le chargeur **refuse de démarrer** sinon : une
allocation à 97 % laisse 3 % de capital que personne ne réclame et qui ne sera
jamais investi.

---

## 4. Les décisions d'architecture qui tiennent le système

Ce sont elles qui expliquent la forme du code. Les défaire casse quelque chose
qu'aucun test générique ne verrait.

### Un seul chemin vers le marché

`décision → coupe-circuit → dimensionnement → courtier → portefeuille → journal
→ alerte`. Pas de raccourci « juste pour le rééquilibrage » : ce serait
exactement l'endroit par lequel un ordre passerait un jour sans contrôle de
risque. Une seule exception, et elle va dans le sens qui protège : **un
coupe-circuit déclenché ne bloque jamais une vente**. Une sortie de secours
verrouillée est un piège.

### La sortie prime sur l'entrée

Un actif qui s'effondre a un RSI en survente, donc un excellent score d'achat,
au moment même où son stop est touché. Sans cet ordre de priorité, le moteur
renforcerait une position qu'il est en train de devoir couper.

### Une source absente n'est pas une source à zéro

Compter à zéro ce qu'on ne sait pas ferait passer tous les scores sous le seuil
d'achat le jour où DeFiLlama tombe : le système s'arrêterait d'acheter pour une
raison sans rapport avec le marché. Le poids d'une famille absente est
redistribué, et la liste des sources muettes part dans la notification.

### L'indice mesure une opportunité d'achat, pas une santé de marché

Un RSI à 25 donne un *bon* score : on accumule dans la peur. Une avidité extrême
donne un mauvais score alors que le marché monte. Inverser cette convention
donne un système qui achète les sommets, et rien ne le dirait — d'où le test
`test_convention_contrarienne`.

### Le score ne peut pas dominer la zone de valorisation

Pour que la peur extrême au pire score achète encore plus que le neutre au
meilleur, il faut `2(1−i) > 1(1+i)`, donc `i < 1/3`. Au-delà, le signal le plus
bruyant prend la main sur le plus robuste. Le chargeur de configuration refuse
un `influence_score` supérieur à un tiers.

### Zéro est une décision, pas une panne

En avidité extrême le multiplicateur vaut 0 et le système **temporise** : le
montant non dépensé reste en trésorerie et gonfle les achats futurs. D'où
`TEMPORISER` distinct d'`ATTENDRE` — un report se raconte dans le
récapitulatif, une absence non.

### La taille se décide sur la distance au stop, jamais sur la conviction

`capital × risque / (prix − stop)`. Un actif volatil a un stop plus loin, donc
une position plus petite, automatiquement, sans table par actif à tenir à jour.

### La simulation est réaliste ou elle ne sert à rien

Frais d'un compte sans remise, glissement calculé **en parcourant le carnet**, et
exécution partielle au-delà de 10 % de la profondeur visible. Un simulateur qui
exécute au prix affiché produit une courbe qui sert ensuite à régler des seuils,
et ces seuils sont alors réglés sur une fiction.

### Les filtres gratuits avant les filtres qui coûtent

Le scanner de pépites applique volume, âge et capitalisation — gratuits — avant
tout appel réseau. L'ordre inverse épuise le quota de l'API avant d'avoir
regardé le dixième candidat sur une liste de trois cents paires.

---

## 5. Ce qui n'est pas couvert, et qu'il faut savoir

C'est la section à lire avant d'y mettre un dollar.

- **Aucune source n'a tourné en conditions réelles.** Tout est validé sur des
  réponses rejouées. Un changement de forme chez DexScreener, DeFiLlama ou
  Binance ne serait vu par aucun test. Un changement dans `src/data_engine/` se
  signale comme **non vérifié** tant qu'un vrai `python3 main.py analyser` n'a
  pas tourné.
- **Les réglages sont raisonnés, pas optimisés.** Le harnais de rejeu existe
  (§ 8) et mesure leur effet, mais aucune recherche de réglage n'a été menée.
- **Le scanner de pépites ne vérifie pas les contrats.** Ni la revente possible,
  ni le verrouillage de liquidité, ni l'émission ouverte. Une pépite détectée
  est un **candidat à examiner**, jamais un achat — c'est écrit dans l'alerte
  elle-même. Le radar `pepites/` du même dépôt, lui, fait ce filtrage.
- **Le flux des réserves de plateformes est approché.** Aucune source gratuite
  fiable ne le publie ; il est déduit de la variation de TVL, et le champ porte
  cette approximation dans son nom de source.
- **Le lexique de sentiment ne voit ni l'ironie ni les campagnes coordonnées.**
  Mille comptes qui vantent la lune obtiennent un bon score social. C'est
  pourquoi le sentiment ne pèse que 20 % de l'indice et ne décide jamais seul.
- **Le mode réel n'a jamais passé d'ordre.** `CourtierCCXT` est écrit et lu, pas
  éprouvé contre une plateforme.

Mesuré depuis une session distante de ce dépôt : le mandataire réseau refuse en
403 `api.binance.com`, `api.hyperliquid.xyz`, `api.alternative.me`,
`reddit.com` et les trois flux RSS configurés. Le chemin de dégradation, lui,
**a** été éprouvé en conditions réelles ce jour-là : chaque source a rendu une
erreur typée, chaque actif a été écarté proprement, et le programme s'est
arrêté sur une phrase plutôt que sur une trace. C'est la seule partie du réseau
qui soit vérifiée pour de bon — la lecture des réponses, elle, ne l'est que sur
des relevés rejoués.

---

## 6. Sécurité

- Les clés vivent dans `.env`, jamais dans `config.yaml`, jamais dans le code.
  Le `.gitignore` de la racine couvre déjà `.env*`.
- **Donner des droits de retrait à ces clés n'a aucun sens** : un bot n'a pas à
  pouvoir sortir des fonds, et c'est la seule protection qui tienne si la
  machine est compromise. En simulation, la lecture seule suffit.
- `Secrets.__repr__` est masqué, et le journal filtre les jetons de bot, les
  clés en chaîne de requête et les crochets Discord. Un `logger.debug(config)`
  bien intentionné a déjà suffi, ailleurs, à publier un jeton.
- Hyperliquid signe avec une clé privée : utiliser une clé déléguée
  (*agent wallet*), jamais celle du portefeuille principal.

---

## 7. Vérifier

```bash
cd nexuscrypto
python3 -m unittest discover -s tests    # 251 tests, aucun ne touche au réseau
python3 main.py verifier                 # la configuration livrée est-elle valide
python3 main.py analyser                 # la seule commande qui touche vraiment le réseau
```

`analyser` en plus **si et seulement si** le changement touche à
`src/data_engine/` : les tests diraient que tout passe sans dire qu'une API a
changé de forme.

---

## 8. Rejeu — mesurer un réglage au lieu de le raisonner

```bash
python3 main.py rejeu                        # les six marchés fabriqués
python3 profils.py --detail                  # les mêmes, avec le détail
python3 main.py rejeu --csv btc-4h.csv --symbole BTC/USDT --fear-greed fng.csv
python3 main.py rejeu --csv btc-4h.csv --leviers 1,2,3,5,10   # compte les liquidations
```

**Le rejeu réutilise le moteur de décision tel quel.** Il ne réimplémente rien :
ce qui est mesuré est exactement ce qui tournera en direct, sinon on réglerait
un moteur pour en faire tourner un autre.

**Chaque rejeu tourne deux fois** — la stratégie, et un **témoin** qui achète
l'enveloppe pleine à chaque échéance sans rien regarder. Un résultat seul ne se
juge pas : « +28 % » ne dit rien si le marché montait de 40 %. La colonne qui
compte est *vs témoin* : le prix moyen payé, comparé à celui d'un DCA aveugle.

### Ce qui garantit que le rejeu ne triche pas

C'est le seul défaut d'un backtest qui ne se voit pas — il rend une courbe
magnifique et un compte vide. Trois propriétés le tiennent, chacune gardée par
un test :

- **le contexte de la bougie *i* ne contient que les bougies 0 à *i*** ;
- **la décision prise à la clôture de *i* s'exécute à l'ouverture de *i+1***.
  La clôture de *i* n'est connue qu'à l'instant où elle a lieu ; exécuter à ce
  prix reviendrait à passer un ordre dans le passé. La dernière bougie n'est
  donc jamais exécutable ;
- **la fenêtre est celle du direct** (`profondeur_bougies`), pas l'historique
  entier. Une EMA 200 calculée sur 600 bougies n'a pas la même valeur que sur
  300, et le direct n'en verra jamais 600.

Le test `test_une_bougie_future_ne_change_rien_au_passe` remplace la dernière
clôture par un pic absurde et exige que **pas une seule** décision antérieure
ne bouge.

### Le levier se mesure, il ne s'exécute pas

`--leviers 1,2,3,5,10` répond à une question et une seule : **à quel moment un
compte à levier aurait-il été liquidé ?** Le module `src/rejeu/levier.py` lit un
rejeu déjà fait ; il n'entre nulle part dans le chemin d'ordre, et le courtier
ne connaît toujours pas le mot « levier ». C'est délibéré — une option de levier
posée dans le courtier serait utilisée avant d'avoir été mesurée.

Une position ouverte au prix `P` à levier `L` est liquidée quand le prix touche
`P × (1 − 1/L + maintenance)`. On mesure donc, pour **chaque achat**, la pire
excursion défavorable de sa détention, sur les **plus bas** des bougies : une
mèche liquide aussi sûrement qu'une clôture et ne laisse aucune trace dans une
courbe bâtie sur les clôtures. Les ventes soldent les achats en premier entré,
premier sorti.

**Le levier porte sur la position, jamais sur le portefeuille**, et c'est la
correction qui a sauvé ce module d'être inutile. Mesuré d'abord sur le recul du
portefeuille, il déclarait 10x survivant sur « effondrement sans reprise », un
marché où l'actif perd 37 %. L'explication tient en une ligne : le bot garde
l'essentiel du capital en liquide, donc le portefeuille recule peu quand l'actif
plonge. Personne ne met du levier sur du cash dormant, et cette mesure-là
flattait le levier d'un facteur dix. Après correction, les six marchés fabriqués
plafonnent à **5x**.

**Deux refus de conclure, et ils comptent autant que le tableau.** Un rejeu sans
position ouverte ne dit *rien* du levier — la version naïve annonçait « levier
maximal 10x » sur zéro position, une conclusion rassurante tirée du vide. Et en
dessous de dix positions, le tableau décrit la période rejouée bien plus que le
réglage : l'avertissement est écrit sous le tableau.

Le nombre rendu est un **plancher**, jamais une estimation : ni le financement
d'un perpétuel, ni le prix de marque de la plateforme, ni l'illiquidité réelle
ne sont comptés, et les trois poussent dans le même sens.

### Ce que le rejeu ne simule pas

Il n'existe pas de carnet d'ordres historique. Le courtier papier retombe donc
sur son glissement forfaitaire au lieu de parcourir un carnet. Sur Bitcoin
l'écart est négligeable ; **sur une pépite peu liquide, le rejeu est optimiste,
et il l'est en silence.**

### Ce que le rejeu a trouvé, et comment il l'a corrigé

**La stratégie n'achète rien du tout dans une hausse continue.** Mesuré sur le
scénario « hausse continue » (×3 sur la période) : **zéro ordre, 398 échéances
reportées**, pendant que le témoin gagne +8,1 %.

La cause est structurelle, pas accidentelle. La note technique est
*contrarienne* : en tendance haussière le prix reste durablement au-dessus de
l'EMA 200 et le RSI en haut de sa plage, donc la note stagne entre 17 et 32 —
loin du plancher d'achat de 45. Le report n'est alors plus une temporisation,
c'est une abstention qui dure toute la période.

Pour un DCA, dont la promesse entière est de **continuer d'acheter**, c'est le
pire résultat possible : ce n'est pas de la prudence, c'est une panne de
discipline. Le verdict de `profils.py` le dit en toutes lettres et compte
l'abstention comme un échec, jamais comme un match nul.

**Corrigé par un plancher de discipline**, dont la valeur est *mesurée* et non
choisie. Quand la valorisation dit non — score sous le seuil, ou multiplicateur
de zone à zéro — le DCA achète malgré tout `plancher_enveloppe` × l'enveloppe
nominale. Le balayage sur les six marchés :

| plancher | abstentions | gain moyen vs DCA aveugle |
| --- | --- | --- |
| 0 % | **1/6** | +13,9 % |
| **15 %** | **0/6** | **+13,0 %** |
| 25 % | 0/6 | +12,2 % |
| 40 % | 0/6 | +11,1 % |

15 % est la plus petite valeur qui supprime l'abstention, et elle coûte 0,9
point de performance relative. Le montant du plancher **ne dépend pas** du
multiplicateur de zone : l'y rapporter le ramènerait à zéro en avidité extrême,
c'est-à-dire exactement là où on en a besoin. C'est un plancher, pas une
réduction.

`test_la_configuration_livree_achete_sur_les_six_marches` verrouille la
correction : si un réglage futur ramène une abstention totale, il échoue là et
non trois mois plus tard sur un relevé.

La piste non retenue, si le sujet revient : un **score relatif à la tendance** —
mesurer le prix contre sa propre moyenne récente plutôt que contre l'EMA 200,
pour qu'une hausse régulière cesse d'être lue comme une surchauffe permanente.
