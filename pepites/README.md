# Pépites — radar multi-chaînes de jetons en accumulation

Outil personnel de détection de low-caps et micro-caps en phase d'accumulation,
avant que le public n'arrive, avec un filtrage des arnaques. Tout tourne en
local, en Python 3, sur des API gratuites.

> **Ce que cet outil n'est pas.** Il ne prédit rien. Il repère une **anomalie
> statistique de volume** et vérifie que le contrat n'est pas un piège évident.
> Un jeton peut passer les cinq étages et perdre 90 % le lendemain : le filtrage
> écarte les pièges mécaniques (revente bloquée, émission ouverte, liquidité
> retirable), pas la décision d'une équipe de vendre. C'est un réducteur de
> bruit, pas un conseil.

---

## 1. Architecture

```
pepites/
├── README.md
├── requirements.txt
├── .env.example              # jetons et clés — le `.env` réel n'est pas versionné
├── config/
│   ├── chaines.yaml          # ✅ table d'identité des blockchains
│   └── reglages.yaml         # ✅ seuils, trapèzes, pondérations
├── core/
│   ├── modeles.py            # ✅ ce qui circule d'un skill à l'autre
│   ├── reglages.py           # ✅ chargement et validation de la configuration
│   ├── reseau.py             # ✅ session HTTP, débit par point d'entrée, reprise sur erreur
│   └── stockage.py           # ✅ SQLite : relevés, alertes, portefeuilles
├── sources/                  # un client par API, aucune décision
│   ├── dexscreener.py        # ✅
│   ├── goplus.py             # ✅
│   ├── honeypot_is.py        # ✅
│   ├── rugcheck.py           # ✅
│   ├── etherscan.py          # ✅
│   └── solana_rpc.py         # ✅
├── skills/                   # les cinq skills
│   ├── radar.py              # ✅ skill 1
│   ├── bouclier.py           # ✅ skill 2
│   ├── convergence.py        # ✅ skill 3 — pur, sans réseau
│   ├── smart_money.py        # ✅ skill 4
│   └── telegram.py           # ✅ skill 5
├── pipeline.py               # ✅ l'enchaînement des étages
├── rapport.py                # ✅ écriture de `pepites_radar.md`
├── main.py                   # ✅ `scan`, `purger`
└── tests/                    # ✅ 121 tests, sans réseau
```

Les cinq skills sont écrits. Aucun test ne touche au réseau.

La séparation `sources/` ↔ `skills/` est la seule qui compte : un module de
`sources` connaît la forme JSON d'un service et rend des objets de
`core.modeles`, sans décider de rien. Le jour où RugCheck ferme son accès
gratuit — ça arrivera —, on remplace un fichier de 80 lignes sans relire une
seule ligne de logique de détection.

---

## 2. Les API, skill par skill

Toutes sont gratuites. Trois fonctionnent sans aucune clé.

### Skill 1 — Radar multi-chaînes : **DexScreener**

Base : `https://api.dexscreener.com`. Sans clé.

| Point d'entrée | Usage | Débit annoncé |
| --- | --- | --- |
| `GET /latest/dex/search?q={texte}` | découverte : une requête par jeton de cotation et par chaîne | 300/min |
| `GET /latest/dex/pairs/{chaine}/{paire}` | rafraîchir une paire suivie | 300/min |
| `GET /token-pairs/v1/{chaine}/{jeton}` | tous les pools d'un jeton — c'est ce qui permet le regroupement | 300/min |
| `GET /tokens/v1/{chaine}/{adresses}` | jusqu'à 30 jetons d'un coup | 300/min |
| `GET /token-profiles/latest/v1` | jetons qui viennent de publier une fiche | 60/min |
| `GET /token-boosts/latest/v1` et `/top/v1` | jetons dont quelqu'un a payé la mise en avant | 60/min |

**La contrainte à connaître avant d'écrire une ligne :** DexScreener n'expose
aucun point d'entrée « toutes les paires actives ». Beaucoup de tutoriels le
supposent ; il n'existe pas. La découverte se construit donc en trois sources
complémentaires, dont l'union donne quelques centaines à quelques milliers de
paires par tour :

1. **Recherche par jeton de cotation** — `search?q=WETH`, `q=SOL`, `q=USDC`…
   pour chaque chaîne. C'est le gros du volume.
2. **Profils et mises en avant récents** — un jeton dont l'équipe paie une fiche
   sort de l'anonymat ; c'est un signal faible mais un très bon point de départ.
3. **Notre propre liste** — tout jeton déjà vu par un scan précédent est
   re-relevé, quoi qu'il arrive. C'est ce qui rend la persistance possible.

`token-boosts` mérite une nuance : payer une mise en avant est autant un signal
d'équipe active qu'un signal de sortie organisée. Il sert à **découvrir**, jamais
à noter.

### Skill 2 — Bouclier anti-rugpull

| Chaîne | Service | Point d'entrée | Clé |
| --- | --- | --- | --- |
| EVM | **GoPlus Security** | `GET https://api.gopluslabs.io/api/v1/token_security/{chain_id}?contract_addresses={adresse}` | non (≈30/min) |
| EVM (ETH, BSC, Base) | **honeypot.is** | `GET https://api.honeypot.is/v2/IsHoneypot?address={adresse}&chainID={id}` | non |
| Solana | **GoPlus Solana** | `GET https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses={mint}` | non |
| Solana | **RugCheck** | `GET https://api.rugcheck.xyz/v1/tokens/{mint}/report/summary` | non |

Ce qu'on lit **côté EVM** (GoPlus) : `is_honeypot`, `buy_tax` / `sell_tax`,
`is_open_source`, `owner_address` et `can_take_back_ownership`, `hidden_owner`,
`is_mintable`, `transfer_pausable`, `trading_cooldown`, `lp_holders` (avec
`is_locked` par détenteur), `holders` (concentration).

Ce qu'on lit **côté Solana** (GoPlus + RugCheck) : autorité d'émission encore
active, autorité de gel, métadonnées modifiables, frais de transfert
(Token-2022), autorité de fermeture, concentration des principaux détenteurs,
état de la liquidité.

Les deux services se complètent plus qu'ils ne se doublent : GoPlus lit le
contrat, honeypot.is **simule un achat puis une revente** sur un nœud. Un
contrat propre dont la revente échoue en simulation est le cas que l'analyse
statique rate — et c'est le plus coûteux.

**Aucun de ces services n'est un quitus.** Un contrat peut être propre et
l'équipe malhonnête. Sur les chaînes sans honeypot.is (Arbitrum, Avalanche,
Polygon, Optimism), on n'a que l'analyse statique : la note en tient compte.

### Skill 3 — Convergence mathématique

Aucune API. C'est de l'arithmétique sur ce que le radar a déjà rapporté, et
c'est délibéré : cet étage doit pouvoir traiter mille candidats en une seconde
pour que les deux étages coûteux ne s'exécutent que sur vingt-cinq.

### Skill 4 — Traqueur smart money

| Chaîne | Service | Point d'entrée | Clé |
| --- | --- | --- | --- |
| EVM | **Etherscan V2** | `GET https://api.etherscan.io/v2/api?chainid={id}&module=account&action=tokentx&contractaddress={jeton}&sort=asc&page=1&offset=100` | oui, gratuite — **une seule clé couvre les 60+ chaînes** |
| Solana | **Helius** (offre gratuite) | `getSignaturesForAddress` puis transactions analysées | oui, gratuite |
| Solana | RPC public, en repli | `getTokenLargestAccounts` | non, mais souvent saturé |

**Côté Solana, ce ne sont pas les premiers acheteurs, et c'est assumé.**
Remonter le premier achat demanderait de parcourir toutes les signatures du
jeton, que le RPC rend de la plus récente à la plus ancienne : des centaines
d'appels par jeton, pour une offre gratuite qui n'en supporte pas le dixième. On
prend l'autre bout du même fil — les **plus gros porteurs actuels**. Signal plus
faible, mais un portefeuille dominant sur une série de petits jetons qui montent
ensuite reste ce qu'on cherche. Le rapport dit laquelle des deux lectures a
servi ; les confondre serait se mentir.

Côté EVM, le principe : `sort=asc` rend les **premiers** transferts du jeton, donc
les premiers acheteurs. On les range dans SQLite avec le jeton et la date. Un
portefeuille devient « intelligent » quand il apparaît tôt sur au moins trois
jetons qui ont ensuite monté — pas avant. Sous ce seuil, c'est une coïncidence,
et l'outil se met à suivre des robots d'arbitrage et des routeurs de DEX.

L'analyse ne démarre donc pas froid : elle a besoin de deux à trois semaines de
relevés pour valoir quelque chose. C'est le skill le plus lent à devenir utile,
et le seul dont la valeur dépend entièrement de notre propre historique.

### Skill 5 — Bot Telegram

`POST https://api.telegram.org/bot{JETON}/sendMessage`, gratuit, sans limite
pratique à notre échelle. Jeton par `@BotFather`, `chat_id` lu une fois sur
`getUpdates`. Mise en forme HTML, aperçu de lien désactivé.

---

## 3. Le pipeline

Un entonnoir, et l'ordre est la seule optimisation qui compte : **le calcul
gratuit filtre avant les appels payés en quota.** GoPlus répond trente fois par
minute ; on ne peut pas lui soumettre neuf cents jetons, et on n'a pas à le
faire.

```
 DexScreener  ──►  ~1 500 paires brutes
                        │  radar : normalisation, rejet des cotations exotiques
                        ▼
                   ~900 jetons          (regroupés par chaîne + adresse,
                        │                pools additionnés)
                        │  filtres durs : liquidité, âge, capitalisation, activité
                        ▼
                   ~120 candidats
                        │  convergence : huit trapèzes, zéro appel réseau
                        ▼
                    25 mieux notés
                        │  persistance : le signal tenait-il au relevé précédent ?
                        ▼
                   ~10 confirmés
                        │  bouclier : GoPlus + honeypot.is / RugCheck
                        ▼
                    ~4 sûrs
                        │  smart money : premiers acheteurs, croisement SQLite
                        ▼
                    ~4 enrichis
                        │  anti-spam : silence de 12 h par jeton
                        ▼
              1 à 3 alertes  ──►  Telegram  +  pepites_radar.md
```

Les types font respecter cet ordre : `bouclier` prend un `Candidat` et rend une
`Securite`, il ne peut pas s'exécuter avant que le regroupement ait eu lieu.

**SQLite n'est pas un cache, c'est un capteur.** DexScreener donne des
instantanés ; l'information la plus utile — *la liquidité monte-t-elle ou
descend-elle pendant que le volume accélère ?* — n'existe dans aucune API. Elle
naît de la comparaison de deux de nos relevés. C'est pour ça que le stockage
arrive dans les fondations et pas en dernier.

---

## 4. La logique mathématique

Notations : `L` liquidité en dollars, `M` capitalisation, `V1` / `V6` / `V24`
volumes sur 1, 6 et 24 heures, `P1` variation du cours sur 1 h en pourcentage,
`A1` / `S1` achats et ventes sur 1 h.

### 4.1 Filtres durs — ce qu'on ne note même pas

| Filtre | Valeur | Pourquoi ce n'est pas un critère noté |
| --- | --- | --- |
| Jeton de cotation de référence | WETH, WBNB, SOL, USDC, USDT… | Une paire SCAM/AUTRESCAM laisse l'agrégateur convertir en dollars imaginaires. C'est le montage exact du faux volume. |
| Liquidité | ≥ 50 000 $ (80 000 sur Ethereum, 30 000 sur Solana) | Le plancher dépend du coût du gaz : 50 000 $ n'ont pas le même sens partout. |
| Âge | 6 h ≤ âge ≤ 180 j | **Le filtre le plus important.** Sous 6 h, `V1×24/V24` explose par construction : le dénominateur n'existe pas. Tout jeton de deux heures obtiendrait la note maximale — et c'est exactement la fenêtre du retrait de liquidité. |
| Capitalisation | 100 000 $ – 30 M$ | En dessous, l'écart achat/vente mange le gain. Au-dessus, le public est déjà là. |
| Activité | ≥ 300 transactions/24 h, ≥ 15/1 h | Trois transactions suffisent à fabriquer n'importe quelle accélération. |
| Profondeur `L/M` | ≥ 2 % | En dessous, une vente de 10 000 $ divise le cours par deux : la « capitalisation » est une fiction. |
| `FDV/M` | ≤ 3 | Au-delà, l'offre est verrouillée quelque part et attend son déblocage. La hausse détectée servirait de sortie à quelqu'un. |
| Variation | `P1` ≤ +150 %, `P24` ≤ +400 % | Un cours déjà multiplié n'est plus une pré-hausse. |

### 4.2 Les huit métriques, et pourquoi des trapèzes

Un seuil est binaire, et tout manipulateur se place juste au-dessus. Une note
linéaire récompense l'extrême — or sur un jeton de 500 000 $, l'extrême est
presque toujours fabriqué. D'où une **fonction d'appartenance trapézoïdale** :
il existe une zone saine, et **les deux** côtés de cette zone sont suspects.

```
1 ┤      ╱▔▔▔▔▔▔▔▔▔╲
  │     ╱           ╲
0 ┼────╱             ╲────
      e   pb     ph   s
```

| # | Métrique | Formule | Trapèze `[e, pb, ph, s]` | Poids | Ce que dit chaque bout |
| --- | --- | --- | --- | --- | --- |
| 1 | **Accélération** | `V1 × 24 / V24` | `[1,5 · 3 · 12 · 40]` | 22 | 1 = une heure comme les autres. Au-delà de 40, ce n'est plus discret : tout le monde regarde déjà la bougie. |
| 2 | **Pression** | `V1 / M` | `[0,02 · 0,05 · 0,25 · 0,60]` | 18 | Voir la note ci-dessous. |
| 3 | **Discrétion** | `P1` | `[−12 · −2 · +12 · +35]` | 16 | Le cœur de la thèse : du volume **sans** cours. Le trapèze démarre sous zéro — une accumulation se fait souvent sur un repli. |
| 4 | **Rotation** | `V24 / L` | `[0,3 · 1 · 6 · 20]` | 12 | Sous 0,3 le jeton dort. Au-delà de 20, le pool n'a pas pu absorber ça honnêtement. |
| 5 | **Déséquilibre** | `A1 / (A1+S1)` | `[0,45 · 0,55 · 0,72 · 0,88]` | 10 | On veut une majorité d'acheteurs, pas l'unanimité : l'unanimité, c'est un robot — ou un jeton dont les ventes échouent. |
| 6 | **Profondeur** | `L / M` | `[0,02 · 0,05 · 0,35 · 0,90]` | 8 | Très haut, le pool pèse autant que le jeton : il n'y a presque rien à faire monter. |
| 7 | **Ticket moyen** | `V1 / (A1+S1)` | `[30 · 120 · 3 000 · 15 000]` $ | 7 | 8 $ sur 2 000 transactions = robot de volume. 20 000 $ sur onze transactions = une seule baleine, et personne en face le jour où elle sort. |
| 8 | **Âge** | heures | `[6 · 72 · 1 080 · 4 320]` | 7 | Assez vieux pour que le retrait opportuniste ait déjà eu lieu, assez jeune pour que personne n'en parle. |

**Sur la pression `V1/M`, un désaccord assumé.** La règle qui circule est
« volume 1 h > 50 % de la capitalisation ». À ce niveau, la hausse n'est pas à
venir : elle est en cours, et l'on arrive en dernier. Un jeton de 2 M$ qui fait
1 M$ en une heure est un sommet en train de se former. La zone d'accumulation
d'un micro-cap se situe entre **5 % et 25 %** — d'où le plateau, et d'où la
décroissance au-delà. Le réglage est dans `config/reglages.yaml` si l'on veut en
juger autrement, mais c'est un choix, pas un oubli.

`note = Σ poids × appartenance(métrique)`, sur 100.

### 4.3 Les drapeaux — ce qu'aucun trapèze n'attrape

Ils portent sur la *forme* des données, pas sur leur niveau. Chacun est une
élimination, pas une pénalité.

- **Signature de piège.** `A1/(A1+S1) > 0,92` **et** `S1 < 5`. Presque que des
  achats, et presque aucune vente en valeur absolue : la signature d'un jeton
  qu'on ne peut pas revendre. Le bouclier le confirmerait, mais autant ne pas
  dépenser l'appel.
- **Lavage.** `|A1 − S1| / (A1+S1) < 0,03` **et** rotation > 8. Un marché réel
  n'est jamais symétrique à 3 % près. Croisé avec la rotation, c'est un
  aller-retour sur soi-même.
- **Robot de volume.** Ticket moyen sous 15 $ répété plus de 2 000 fois dans
  l'heure. Le critère « ticket moyen » ne pèse que 7 points : mesuré seul, ce
  profil note encore **88/100**. Il fallait une élimination, pas des points en
  moins.
- **Distribution déguisée.** La liquidité recule de plus de 8 % pendant que le
  volume accélère : ce n'est pas une accumulation, c'est quelqu'un qui vide le
  pool dans l'enthousiasme. Non calculable au premier relevé — neutre alors.

### 4.4 Persistance — le meilleur filtre anti-faux-signal

Un pic isolé sur un relevé est du bruit ; le même signal deux relevés de suite,
à dix minutes d'écart, est un mouvement. Ce filtre ne coûte **pas un seul appel
réseau** : il coûte une base SQLite et un peu de patience. C'est, de loin, le
meilleur rapport efficacité/coût de tout l'outil — un scan sans mémoire alerte
sur chaque hoquet d'indexation de DexScreener.

### 4.5 La note finale

```
note_finale = note_convergence × facteur_sécurité + bonus_smart_money
```

- **`facteur_sécurité` ∈ [0, 1]** : 0 pour un rejet net (piège, taxes > 10 %,
  émission ou gel encore actifs, liquidité verrouillée à moins de 50 %, dix
  détenteurs au-dessus de 50 % de l'offre hors pools). Sinon, produit des
  pénalités : propriétaire non renoncé ×0,85, contrat non vérifié ×0,90, mise
  en pause possible ×0,70…
  **Un jeton rejeté vaut 0 quelle que soit sa note.** Aucune accélération de
  volume ne rachète un contrat dont on ne peut pas sortir.
- **Aucune source n'a répondu → facteur 0,4**, ni rejet ni quitus. Une panne de
  GoPlus ne doit pas délivrer un blanc-seing à tout le marché, mais elle ne doit
  pas non plus faire disparaître le radar. Le rapport nomme les sources qui ont
  répondu : « sûr » sans nom de source laisserait croire à une vérification qui
  n'a pas eu lieu.
- **`bonus_smart_money` ∈ [0, 15]**, plafonné (5 points par portefeuille reconnu,
  trois suffisent à plafonner). C'est un indice, jamais une
  thèse : deux adresses réputées peuvent se tromper ensemble, et c'est même la
  mécanique de la plupart des sorties organisées. Un bonus, pas un facteur.

Alerte à partir de **70**, cinq maximum par scan, silence de 12 h par jeton sauf
progression de plus de 12 points. Un radar qui prévient trois fois par heure du
même jeton finit en sourdine — et c'est ce jour-là qu'il a raison.

---

## 5. Où en est le projet

**Les cinq skills tournent**, du premier appel DexScreener au message Telegram.
148 tests, dont un qui traverse tout le tuyau sur client factice : deux scans à
quinze minutes d'écart, confirmation, bouclier, alerte, puis silence.

Ce qui reste **fragile ou incomplet**, dit franchement :

- **La largeur de la découverte**, et non la notation. Sans point d'entrée
  « toutes les paires actives », on ne voit qu'une fenêtre du marché. C'est la
  mémoire qui compense, en s'élargissant à chaque tour — raison de plus pour
  faire tourner le scan régulièrement plutôt que de temps en temps.
- **Le traqueur de portefeuilles ne vaut rien le premier jour.** Il ne consulte
  aucune base d'adresses réputées : il fabrique la sienne, scan après scan.
  Comptez deux à trois semaines avant qu'il ne dise quoi que ce soit, et
  sachez que sur Solana il lit les gros porteurs, pas les premiers acheteurs.
- **Sur Arbitrum, Avalanche, Polygon et Optimism, il n'y a pas de simulateur
  d'achat/revente** comparable à honeypot.is : on n'y dispose que de l'analyse
  statique. Le rapport nomme les sources, à chacun d'en tirer les conséquences.
- **La sonde a tourné contre les vraies API le 29/08/2026, et tout tient.**
  Verdict : « Toutes les sources répondent et se lisent. » DexScreener rend
  **30 paires reçues, 30 lues** sur ses trois points d'entrée — recherche,
  vitrine, pools d'un jeton — donc aucun champ n'a bougé depuis que l'analyseur
  a été écrit. GoPlus répond sur ses deux points d'entrée, EVM et Solana ;
  honeypot.is et RugCheck répondent aussi. Le code entier avait été écrit sur
  des réponses **rejouées**, sans qu'aucun appel réel n'ait jamais été passé :
  c'était le risque numéro un du projet, et il est levé.

  Deux réserves, attendues et sans gravité. Le **RPC public Solana** rend `429`
  (« Too many requests ») : il est saturé en permanence, c'est écrit depuis le
  premier jour, et cela ne coûte que le traqueur de portefeuilles sur Solana —
  une clé Helius gratuite le règle. Et **Etherscan comme Telegram sont sans
  clé** : les premiers acheteurs EVM sont désactivés, et le radar notera sans
  jamais prévenir tant que le jeton du bot n'est pas posé.

  **Le premier scan réel a suivi**, même jour : `887 paires → 232 jetons →
  11 candidats en 27 secondes`, pour 101 appels HTTP et 60 jetons en vitrine.
  Aucune pépite retenue, ce qui est le comportement attendu — la persistance
  exige deux relevés espacés de dix minutes, et le premier tour ne fait que
  remplir la mémoire. L'entonnoir tient donc ses promesses de bout en bout : le
  calcul gratuit ramène 887 paires à 11 candidats **avant** le premier appel de
  sécurité, et c'est ce qui fait tenir l'outil dans les quotas gratuits.

  Sous Windows, le verrou de tour se dégrade en avertissement — `fcntl` n'y
  existe pas — et l'annonce lui-même. Comportement voulu et vérifié sur le
  terrain, sur un système qu'aucun test du dépôt ne couvre.

## 6. Commandes

```bash
pip install -r requirements.txt
cp .env.exemple .env                       # jeton Telegram, clés facultatives

python3 main.py sonde                      # les sources se lisent-elles encore ?
python3 main.py scan                       # un tour complet → pepites_radar.md
python3 main.py scan --bavard              # avec le détail des appels
python3 main.py purger --garder 30         # efface les vieux relevés

python3 main.py bilan                      # ce que les pépites sont devenues
python3 main.py bilan --note 65            # seulement celles qui ont bien noté

python3 -m unittest discover -s tests      # 167 tests, sans réseau
python3 profils.py                         # l'effet des réglages sur six profils connus
```

### La sonde, à lancer avant le premier scan

**Un scan qui ne trouve rien ne dit pas pourquoi.** Trois situations très
différentes rendent le même rapport vide : le marché est calme, un service ne
répond plus, ou un service répond et nous ne savons plus lire ce qu'il rend. La
première est une bonne nouvelle ; la troisième est la pire, parce que tout a
l'air de fonctionner — les appels partent, les réponses arrivent, aucun
compteur d'erreur ne bouge — et le radar est aveugle.

`main.py sonde` interroge chaque point d'entrée une fois et rend deux nombres :
**reçus** et **lus**. Des éléments reçus dont aucun ne se traduit, c'est un
format qui a bougé, et c'est le seul cas où elle crie :

```
dexscreener · recherche    dérive     30 reçus / 0 lu · 30 paires rendues, toutes chaînes confondues
goplus · EVM               ok         1 reçu / 1 lu · sujet : Ethereum
telegram                   sans clé   le radar notera sans jamais prévenir

DÉRIVE DE FORMAT — dexscreener · recherche répond sans que nous sachions les
lire. Un scan rendrait un rapport vide qui se lirait comme un marché calme.
```

Elle n'écrit rien, ne note rien, n'alerte pas, et sort en code 4 si une source
est muette ou dérivée — de quoi la mettre dans une tâche planifiée sans lire le
tableau. Une source qu'une coupure a empêché d'atteindre est déclarée « non
sondé » plutôt qu'omise : un point absent du tableau se lirait comme un point
sain, ce qui est le mensonge exact que cette commande combat.

Les sujets de sondage sont les **jetons de cotation de `config/chaines.yaml`**,
jamais des adresses écrites dans la sonde : ce sont les jetons les plus
permanents de chaque chaîne, et une adresse en dur vieillirait sans que
personne ne la relise, faisant de la sonde une source de fausses alertes.

`profils.py` est l'instrument de réglage : il fait passer six profils de marché
de côté — celui qu'on cherche et les cinq façons de se tromper — par les vrais
filtres et la vraie note. On bouge un seuil, on relance, on lit la colonne qui a
bougé. Un scan réel ne répond pas à cette question : il dépend du marché du
moment et deux tours ne sont jamais comparables.

Sans clé, le radar, la note et le bouclier fonctionnent tous les trois : GoPlus,
honeypot.is et RugCheck répondent sans inscription. Seuls le traqueur
(`ETHERSCAN_API_KEY`, `HELIUS_API_KEY`) et l'alerte (`TELEGRAM_BOT_TOKEN`,
`TELEGRAM_CHAT_ID`) en demandent — et leur absence est signalée, jamais
silencieuse.

Un scan seul ne confirme rien : la persistance demande deux relevés espacés d'au
moins dix minutes. Le premier tour remplit la mémoire, les suivants s'en
servent. En usage réel, c'est une tâche planifiée — toutes les quinze minutes
est un bon rythme :

```cron
*/15 * * * * cd /chemin/vers/pepites && /usr/bin/python3 main.py scan >> scan.log 2>&1
```

**Sous Windows, où ce radar tourne réellement**, l'équivalent se déclare une
fois dans PowerShell. Le détour par `cmd.exe` n'est pas une coquetterie : il
apporte la redirection vers `scan.log`, qu'une tâche planifiée ne fait pas
d'elle-même, et sans journal un tour qui échoue toutes les quinze minutes est
indiscernable d'un marché calme.

```powershell
$dossier = "$HOME\Downloads\amorce-main\amorce-main\pepites"
$action  = New-ScheduledTaskAction -Execute "cmd.exe" `
             -Argument "/c python main.py scan >> scan.log 2>&1" `
             -WorkingDirectory $dossier
$rythme  = New-ScheduledTaskTrigger -Once -At (Get-Date) `
             -RepetitionInterval (New-TimeSpan -Minutes 15) `
             -RepetitionDuration ([TimeSpan]::MaxValue)
Register-ScheduledTask -TaskName "Radar pepites" -Action $action -Trigger $rythme
```

`-RepetitionDuration` compte : sans elle, le déclencheur `-Once` ne se répète
que pendant vingt-quatre heures, puis s'arrête sans erreur — la tâche reste
listée, elle ne se déclenche plus, et le radar paraît simplement n'avoir rien
trouvé depuis la veille.

Ce chemin est écrit contre la surface documentée de `ScheduledTasks` et n'a pas
été exécuté : aucune session de ce dépôt ne tourne sous Windows. Il se vérifie
en une minute — `Get-ScheduledTask "Radar pepites"` doit rendre `Ready`, et
`scan.log` doit grossir au quart d'heure suivant.

Pour l'arrêter : `Unregister-ScheduledTask "Radar pepites"`.

**Un seul scan tourne à la fois**, et le radar s'en charge : un verrou de
fichier est pris pour la durée du tour, et un second passage lancé pendant le
premier est refusé au lieu de doubler la cadence. Ce n'était pas théorique —
`Debit` compte par processus, donc deux tours simultanés valent deux fois le
débit annoncé contre GoPlus et RugCheck, et les 429 qui s'ensuivent frappent
les deux. La base y gagne aussi : SQLite s'en tient à cinq secondes d'attente
avant de lever « database is locked ».

Le refus est bruyant — code de sortie 5, et une ligne qui dit depuis combien de
temps l'autre tourne :

```
Scan sauté : un scan tourne déjà depuis 8 min. Si cette ligne revient à chaque
passage, l'intervalle est trop court pour la largeur configurée.
```

C'est délibéré. Un tour sauté en silence laisserait un radar qui se chevauche
en permanence — donc qui ne tourne jamais vraiment — ressembler à un radar en
bonne santé. Si la ligne revient à chaque passage, il faut espacer la minuterie
ou réduire `jetons_en_vitrine_max` et `jetons_suivis_max`.

Le verrou est un verrou du noyau, pas un fichier témoin : après un `kill -9` ou
une coupure de courant, il est relâché tout seul. Personne n'a de fichier à
effacer à la main le matin où le radar s'est tu. Deux appels selon le système,
aucune bibliothèque tierce — `fcntl.flock` sur POSIX, `msvcrt.locking` sur
Windows.

**Le chemin Windows reste à démontrer.** Il est écrit contre la surface
documentée de `msvcrt`, mais aucun test du dépôt ne peut l'exécuter : la CI
tourne sous Linux. La vérification prend deux minutes sur un poste Windows —
ouvrir **deux** fenêtres PowerShell dans `pepites`, lancer `python main.py scan`
dans la première, puis la même commande dans la seconde pendant que la première
tourne. La seconde doit refuser :

```
Scan sauté : un scan tourne déjà depuis 12 s.
```

Si elle démarre au lieu de refuser, le verrou Windows ne fonctionne pas et il
faut le dire ici. Tant que l'épreuve n'a pas été faite, la protection y est
**probable, pas démontrée**.

Ce qui **n'est pas** en cause, et qu'on croit toujours : la confirmation. Un
relevé écrit à la seconde ne peut pas confirmer un candidat, `ecart_min_minutes`
le refuse quelle que soit son origine.

### Le bilan, à lire après quelques semaines

**Le radar n'avait jamais été noté sur ses résultats.** Il l'était sur le fait
qu'il ne plante pas et qu'il rend un entonnoir plausible — jamais sur la seule
question qui compte : *ce qu'il a désigné est-il monté ?* La matière était
pourtant déjà en base, `releves` gardant `prix_usd` et `note` à chaque tour.
Personne ne la relisait.

```bash
python3 main.py bilan
```

Aucun appel réseau : tout se calcule sur le fichier SQLite local. La commande
répond donc aussi bien depuis une machine qui n'atteint aucune API de marché.

**Elle refuse de conclure quatre fois plutôt qu'une**, et c'est son intérêt
principal — un bulletin bâti sur rien rend toujours le verdict le plus
rassurant, et personne ne va vérifier un chiffre qui fait plaisir :

| Situation | Ce qui est affiché | Pourquoi pas autre chose |
| --- | --- | --- |
| Un seul relevé | `indécidable` | « 0 % » se lirait comme « ça n'a pas bougé », qui est une mesure. Personne n'a regardé deux fois. |
| Deux relevés en moins de 6 h | la variation, suivie de `(trop tôt)` | Une heure sur une pépite, c'est la respiration du carnet d'ordres. La variation est vraie, le verdict qu'on en tirerait ne l'est pas. |
| Prix de départ nul | `indécidable` | Une division par zéro y passerait inaperçue précisément parce que le cas n'arrive jamais. |
| Moins de 20 jetons jugeables | pas de taux de réussite | Sur cinq jetons, trois hausses font « 60 % » et ne disent rien du réglage, seulement du marché de la semaine. |

**L'âge du dernier relevé est affiché à côté de chaque ligne.** Un jeton qui
sort de l'entonnoir cesse d'être relevé : son dernier prix connu peut dater de
trois semaines, et sans cet âge une hausse ancienne se lit comme une hausse
d'aujourd'hui.

**Le taux global est une médiane, jamais une moyenne.** Un seul jeton multiplié
par cinquante tirerait une moyenne vers le haut et donnerait au radar un
bulletin flatteur que quarante-neuf lignes perdantes ne corrigeraient pas.

**Le symbole manque sur les relevés antérieurs à sa colonne**, et la ligne porte
alors `?` avec son adresse. Ce n'est pas une perte grave : une adresse est un
meilleur identifiant qu'un nom, qui se copie à l'identique par n'importe qui.
La colonne est ajoutée par migration à l'ouverture de la base — une base qui
tourne depuis des semaines la gagne sans rien perdre de ses lignes.
