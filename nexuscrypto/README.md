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
│   │   ├── donnees.py        # ✅ CSV, CoinMetrics réel, six marchés fabriqués
│   │   ├── rejeu.py          # ✅ la boucle, sans regard vers l'avenir
│   │   └── rapport.py        # ✅ mesures, tableau, verdict
│   └── orchestrateur.py      # ✅ l'assemblage et la boucle
├── profils.py                # ✅ l'effet d'un réglage sur six marchés connus
├── logs/                     # journal tournant (ignoré par Git)
└── tests/                    # ✅ 310 tests, aucun ne touche au réseau
```

`python3 -m unittest discover -s tests` : **310 tests, moins de deux secondes.**
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

### Le bouclier est un veto, pas une note

Le scanner repère une anomalie de volume ; il ne sait pas si le jeton est
revendable. Un contrat piégé ne vaut pas « moins », il vaut zéro : la note
mesure une opportunité, le bouclier mesure la possibilité d'en sortir. Les
mélanger laisserait une note élevée compenser un contrat piégé, ce qui est
exactement le montage qu'on veut arrêter.

Trois avis, demandés en parallèle et sans clé d'API : **GoPlus** lit le
contrat, **honeypot.is** simule un achat puis une revente (Ethereum, BNB Chain
et Base seulement), **RugCheck** couvre Solana. Le veto passe **avant** le
dimensionnement — un jeton dont on ne peut pas sortir ne consomme même pas un
calcul de taille.

**Le silence n'est pas un quitus.** Aucune source qui répond donne `INCONNU`, et
`INCONNU` bloque par défaut. C'est l'inverse du réflexe habituel, et l'asymétrie
le justifie : une occasion manquée coûte un gain, un jeton dont on ne peut pas
sortir coûte la ligne entière. `acheter_si_inconnu` permet d'en décider
autrement, en le sachant.

**Pas d'adresse, pas de bouclier — et non « pas d'adresse, donc refus ».** Les
lignes du socle n'ont pas de contrat à auditer : exiger une adresse pour
LINK/USDT lui aurait interdit tout achat, à chaque passe, en accusant les
sources de sécurité. Une ligne d'allocation peut désormais porter `chaine` et
`adresse` ; c'est leur présence qui déclenche le veto.

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
python3 -m unittest discover -s tests    # 310 tests, aucun ne touche au réseau
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

**Mesuré sur seize ans de BTC réel**, par fenêtres de deux ans — 55 à 70
positions chacune, bien au-delà du seuil de dix sous lequel le tableau refuse
de conclure :

| fenêtre | marché | 2x | 3x | 5x | 10x |
|---|---|---|---|---|---|
| 2017–2018 | bulle puis krach | 7 % | 17 % | 33 % | **60 %** |
| 2020–2021 | haussier, +124 % | 2 % | 25 % | 33 % | **56 %** |
| 2022–2023 | baissier puis reprise | 0 % | 0 % | 0 % | **44 %** |

Part des positions liquidées. **À x10, entre 44 et 60 % des positions sont
liquidées dans les trois fenêtres** — y compris celle où le marché monte de
124 %, et y compris la plus calme des trois. Ce n'est pas un mauvais moment mal
choisi, c'est la volatilité ordinaire de l'actif contre une marge de 9,5 %.

Deux lectures s'imposent. **Un marché haussier ne protège pas** : 2020-2021 a
liquidé plus qu'il n'a épargné, parce que le levier se joue sur les creux du
parcours et non sur le point d'arrivée. Et **le seul levier qui traverse les
trois fenêtres sans une liquidation est l'absence de levier** : même 2x tombe
sur deux fenêtres sur trois.

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

---

## 9. Ce que seize ans de BTC réel disent de la stratégie

Les six marchés fabriqués (§ 8) sont symétriques par construction, et ils
flattaient : ils annonçaient un gain moyen de +13 % sur le prix d'achat contre
un DCA aveugle. **Le marché réel est bien plus dur.**

```bash
curl -sSO https://raw.githubusercontent.com/coinmetrics/data/master/csv/btc.csv
python3 main.py rejeu --coinmetrics btc.csv --symbole BTC/USD \
        --depuis 2020-01-01 --jusqu-a 2021-12-31
```

Le jeu communautaire CoinMetrics porte **5 789 jours de BTC, de 2010 à 2026** —
et surtout le **flux net des réserves de plateformes en dollars**, mesuré jour
par jour. C'est la métrique qu'`IngestionOnchain` doit approximer par la
variation de TVL faute de source gratuite ; ici elle est réelle, et la
convention de signe du scoring s'y confronte pour la première fois.

C'est la seule source de marché atteignable depuis une session distante : tous
les hôtes de plateformes sont refusés par le mandataire, `raw.githubusercontent.com`
répond. Voir la section anti-blocage de `CLAUDE.md`.

### Le résultat, et il n'est pas flatteur

| fenêtre | marché | prix moyen | vs marché | vs témoin | PnL stratégie | PnL témoin |
| --- | --- | --- | --- | --- | --- | --- |
| 2017, la bulle | +1 769 % | 1 843 $ | −43,8 % | **−5,5 %** | — | — |
| 2018, l'hiver | −19 % | 4 760 $ | −30,6 % | **+6,2 %** | — | — |
| 2020-2021, la hausse | +546 % | 26 005 $ | −11,1 % | **−19,1 %** | **+34,9 %** | **+124,5 %** |
| 2022, la chute | −36 % | 19 769 $ | −27,6 % | **+7,2 %** | **+20,0 %** | **+39,4 %** |

**La stratégie bat un DCA aveugle quand le marché baisse, et perd quand il
monte** — lourdement : sur 2020-2021 elle rend +34,9 % là où l'achat aveugle
rend +124,5 %. C'est cohérent avec le défaut structurel du § 8 : une note
technique contrarienne lit une tendance haussière comme une surchauffe
permanente. Le plancher de discipline empêche l'abstention totale, il ne rend
pas la stratégie bonne en marché haussier.

**Et « acheter moins cher » ne suffit pas à gagner.** Sur 2022 la stratégie
paie 7,2 % moins cher que le témoin et gagne pourtant deux fois moins, parce
qu'elle engage 1 400 $ de moins. Le verdict le signale désormais explicitement :
un bon prix obtenu en achetant peu est une abstention partielle, pas une
performance.

### Le piège du rejeu long sur un seul actif

Sur 2013-2026, la stratégie affiche 702 000 $ pour 1 073 $ engagés. **Ce chiffre
ne mesure rien.** Elle a acheté 9 BTC à 119 $ de moyenne en 2013 puis s'est
arrêtée pour toujours : le plafond d'exposition par actif — 55 % du portefeuille
— gèle tout achat dès que la position s'apprécie, et sur un rejeu mono-actif ce
plafond est atteint définitivement. Le résultat mesure le plafond, pas la
stratégie.

La commande affiche cet avertissement d'elle-même. **Les fenêtres de deux à
trois ans sont les seules lisibles** tant que le rejeu ne porte qu'un actif.

### Ce que ce rejeu ne dit toujours pas

La source n'a **ni haut, ni bas, ni ouverture** : seulement une clôture
quotidienne. Les bougies sont donc plates, l'ATR devient une volatilité de
clôture à clôture — plus petite que la vraie — et les stops sont **plus serrés**
que ceux qu'on obtiendra en direct. L'erreur va dans le sens pessimiste, ce qui
est le bon sens, mais elle n'est pas nulle.

---

## 10. Le résultat qu'il faut lire avant tous les autres

Sur cinq fenêtres de BTC réel, de 2016 à 2025 : **un DCA aveugle bat cette
stratégie en gain sur les cinq. 0/5.**

| fenêtre | stratégie | DCA aveugle |
| --- | --- | --- |
| 2017, la bulle | +104,4 % | **+466,0 %** |
| 2018, l'hiver | +35,8 % | **+111,4 %** |
| 2020-2021, la hausse | +42,7 % | **+124,5 %** |
| 2022, la chute | +17,2 % | **+39,4 %** |
| 2023-2025, la reprise | +1,5 % | **+37,4 %** |

La stratégie achète souvent à meilleur prix — c'est ce que mesure la colonne
*vs témoin* — mais elle **engage moins de capital**, et sur un actif qui monte
à long terme ce compromis perd. Acheter 20 % moins cher la moitié du temps ne
rattrape pas d'avoir investi 40 % de moins.

**C'est le résultat le plus important de ce projet, et il n'est pas
encourageant.** Aucune des corrections apportées jusqu'ici — le plancher de
discipline, la note relative à la tendance — ne renverse ce constat : elles
réduisent l'écart, elles ne le comblent pas.

Ce que cela ne dit pas : que la modulation soit inutile en général. Cinq
fenêtres, un seul actif, seize ans d'un marché historiquement haussier.

**Cette section a d'abord porté une consolation, et elle était fausse.** Elle
disait qu'une stratégie qui protège le capital a une valeur que le PnL brut ne
mesure pas, en s'appuyant sur un recul maximum systématiquement plus faible que
celui du témoin. C'était vrai et sans portée : la protection a été mesurée
depuis, elle ne paie pas son prix, et le § 11 le montre. La phrase est
remplacée plutôt que nuancée — une consolation non mesurée dans un dépôt qui
mesure est pire qu'un silence.

**Quiconque lit ce dépôt en pensant y trouver un moteur qui bat le marché doit
lire ce tableau d'abord.**

### La note relative à la tendance, et ce qu'elle corrige

Le § 9 montrait la stratégie perdant 27,4 % contre le témoin sur la grande
hausse de 2020-2021. La cause : la note technique jugeait l'écart à l'EMA 200
sur des **seuils absolus** — au-delà de +30 %, note nulle — alors qu'en tendance
le prix vit durablement au-delà de ce seuil. La note restait collée à zéro
pendant deux ans.

`ecart_ema_relatif` rapporte cet écart à sa **propre distribution** sur la
fenêtre : un écart de 40 % dans un marché qui vit habituellement à 40 % vaut
zéro écart-type, donc une note neutre. Seul l'inhabituel *pour ce régime* bouge
la note.

| | absolu | relatif |
| --- | --- | --- |
| gain moyen sur le prix | −3,4 % | **+1,7 %** |
| pire cas | **−27,4 %** | **−10,2 %** |

Meilleur sur la moyenne **et** sur le pire cas — c'est ce qui décide, et c'est
le défaut livré. Il n'est pas meilleur partout : il perd 10 points sur
2023-2025. Le changer sans rejouer le harnais sur données réelles, c'est régler
à l'aveugle.

---

## 11. Et la protection ne paie pas son prix

La section 10 laisse une porte ouverte : la stratégie perd en rendement, mais
peut-être protège-t-elle. C'est mesurable, donc c'est mesuré.

```bash
python3 main.py rejeu --coinmetrics btc.csv --symbole BTC/USD \
        --depuis 2020-01-01 --jusqu-a 2021-12-31
```

**Le piège de cette famille de mesures est énorme, et il faut le poser d'abord :
une stratégie qui n'investit rien a un recul nul.** Comparer des reculs bruts
entre deux stratégies qui n'engagent pas le même capital ne mesure que la
différence de capital. La seule colonne qui se compare honnêtement est donc le
**gain par unité de recul**.

| fenêtre | | PnL | recul max | temps sous l'eau | pire mois | **gain/douleur** |
| --- | --- | --- | --- | --- | --- | --- |
| 2017 | stratégie | +104,4 % | 37,6 % | 77 % | −17,4 % | 2,78 |
| | témoin | +466,0 % | 49,2 % | 76 % | −25,3 % | **9,47** |
| 2018 | stratégie | +35,8 % | 8,4 % | 90 % | −1,5 % | 4,25 |
| | témoin | +111,4 % | 20,9 % | 89 % | −13,2 % | **5,34** |
| 2020-21 | stratégie | +42,7 % | 30,9 % | 86 % | −20,0 % | 1,38 |
| | témoin | +124,5 % | 51,2 % | 86 % | −33,8 % | **2,43** |
| 2022 | stratégie | +17,2 % | 8,4 % | 90 % | −4,2 % | 2,05 |
| | témoin | +39,4 % | 15,9 % | 90 % | −5,1 % | **2,48** |
| 2023-25 | stratégie | +1,5 % | 19,7 % | 91 % | −10,3 % | 0,07 |
| | témoin | +37,4 % | 31,8 % | 90 % | −17,4 % | **1,18** |

**La protection est réelle.** Le recul maximum de la stratégie est deux fois
plus faible sur trois des cinq fenêtres, et son pire mois est toujours plus
doux — sur 2018, −1,5 % contre −13,2 %.

**Et elle ne paie pas son prix.** Rapporté au gain, le DCA aveugle rend plus par
unité de recul sur les **cinq** fenêtres. La protection est achetée, elle n'est
pas offerte : elle coûte plus de rendement qu'elle n'épargne de douleur.

**Le temps passé sous l'eau, lui, ne bouge pas du tout.** 77 % contre 76 %,
90 % contre 89 %, 86 % contre 86 %. La stratégie réduit l'**amplitude** de la
douleur, jamais sa **durée** — or c'est la durée qui fait abandonner une
stratégie un dimanche soir. La consolation qu'on aurait pu se donner ne tient
pas non plus.

### Où cela laisse le projet

Sur les deux axes mesurés — rendement, et protection normalisée — **cette
stratégie est dominée par un DCA aveugle sur les cinq fenêtres testées.** Ce
n'est pas un défaut de réglage qu'une pondération corrigerait : les trois
corrections déjà apportées (plancher de discipline, note relative à la tendance,
redistribution des poids absents) ont réduit l'écart sans jamais le renverser.

Ce que le harnais ne peut pas trancher : le comportement sur un actif qui **ne**
monte pas structurellement, un portefeuille à cinq lignes plutôt qu'une, ou une
période de plus de trois ans sans que le plafond d'exposition ne fausse tout.
Les trois sont hors de portée d'ici — le premier faute de données on-chain
équivalentes sur SOL, ETH et HYPE, les deux autres faute de rejeu
multi-actifs. **C'est le prochain vrai chantier, et tant qu'il n'est pas fait,
la seule affirmation honnête sur ce moteur est celle-ci : sur Bitcoin, il n'a
pas encore justifié sa complexité.**
