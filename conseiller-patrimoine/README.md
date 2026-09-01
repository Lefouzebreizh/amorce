# Conseiller Patrimoine — la vue d'ensemble, en lecture seule

Un tableau qui répond à trois questions : combien vaut le patrimoine
aujourd'hui, à quelle distance il est de la répartition visée, et où mettre le
prochain versement. Bourse, crypto, immobilier et liquidités dans le même
total — un portefeuille d'ETF regardé seul donne une image fausse dès qu'il y a
un bien à côté.

> **Ce que cet outil n'est pas.** Il ne passe aucun ordre, ne touche à aucun
> portefeuille, et ne modifie aucun fichier de NexusCrypto ni du radar. Il ne
> prédit rien non plus : il compare ce que vous détenez à une cible que vous
> avez choisie à froid, et rappelle la fiscalité plutôt que de la calculer. Les
> estimations immobilières et les cours sont ceux que vous saisissez.

---

## 1. Ce qui tourne

```
conseiller-patrimoine/
├── README.md
├── requirements.txt          # une dépendance, et la liste de ce qui est banni
├── config/
│   ├── patrimoine.exemple.yaml   # ✅ le modèle, versionné
│   └── patrimoine.yaml           #    le vôtre, jamais versionné
├── core/
│   ├── modeles.py            # ✅ ce qui circule, gelé — `None` n'est pas zéro
│   ├── reglages.py           # ✅ validation stricte, refus de démarrer
│   └── lecture_seule.py      # ✅ le garde-fou : porte unique, SQLite en `mode=ro`
├── lecteurs/                 # un par source, aucune décision, aucune écriture
│   ├── saisie.py             # ✅ le seul qui apporte des montants
│   ├── nexuscrypto.py        # ✅ l'allocation cible et le signe de vie
│   ├── pepites.py            # ✅ les alertes récentes du radar
│   └── banque.py             # ⏳ place tenue — AISP le jour venu, jamais PISP
├── analyse/                  # pur : ni disque, ni réseau, ni horloge
│   ├── valorisation.py       # ✅ valeur nette, plus-values, fraîcheur des cours
│   ├── ecarts.py             # ✅ dérive contre la cible, bande de tolérance
│   ├── conseil.py            # ✅ l'apport avant l'arbitrage
│   └── redaction.py          # ✅ la voix, et ses trois refus
├── rapport.py                # ✅ l'assemblage des quatre lecteurs
├── main.py                   # ✅ verifier | sources | bilan | conseil
└── tests/                    # ✅ 91 tests, aucun réseau, aucune horloge
```

```bash
cd conseiller-patrimoine
python3 -m unittest discover -s tests      # 91 tests, moins d'une seconde
```

---

## 2. Démarrer

```bash
pip install -r requirements.txt
cp config/patrimoine.exemple.yaml config/patrimoine.yaml   # puis vos montants

python3 main.py verifier    # valide le fichier et sort
python3 main.py sources     # qui répond, qui se tait — à faire en premier
python3 main.py bilan       # l'inventaire et la répartition, sans conseil
python3 main.py conseil     # tout, rééquilibrage compris
```

**Commencer par `sources`.** Un bilan surprenant ne dit pas *pourquoi* il
surprend : fichier à moitié rempli, cours périmé, radar jamais lancé et chemin
de travers rendent tous un tableau plausible. `sources` tranche entre ces cas en
une seconde, sans rien calculer. C'est la leçon de la sonde du radar, et elle se
paie deux fois quand on ne l'applique pas.

`bilan` et `conseil` existent séparément pour une raison de sang-froid : on
regarde parfois où l'on en est sans vouloir qu'on nous dise quoi faire.

---

## 3. La lecture seule, rendue vérifiable

Ce module lit l'argent de quelqu'un. Une promesse dans un README ne protège de
rien — elle se lit une fois et s'oublie. Quatre verrous la remplacent, et
chacun **casse** quand on le franchit.

| Verrou | Où | Ce qu'il empêche |
| --- | --- | --- |
| Zéro dépendance réseau | `requirements.txt` | toute sortie hors de la machine |
| Porte unique vers l'environnement | `core/lecture_seule.py` | une clé de négoce ramassée par mégarde |
| SQLite en `mode=ro` | `core/lecture_seule.py` | l'écriture dans la mémoire du radar |
| Relecture du source | `tests/test_lecture_seule.py` | tout cela, **dans le code pas encore écrit** |

Le quatrième est le seul qui ne dépende pas de la bonne volonté de celui qui
écrit la ligne suivante. Il relit tous les fichiers du paquet et échoue s'il y
trouve `requests`, `ccxt`, `yfinance`, un accès à `os.environ` hors de la porte,
une manipulation de `sys.path`, ou une écriture sur le disque ailleurs qu'au
point d'entrée. **Il a été éprouvé en injectant les quatre violations** : les
quatre sont refusées.

### Les clés, aujourd'hui et le jour où il y en aura

Il n'y en a aucune. Le module ne sort pas sur le réseau, donc il n'a rien à
présenter à personne.

Le jour où une banque sera raccordée, deux règles s'appliquent, et elles sont
déjà écrites dans `lecteurs/banque.py` plutôt que remises à ce jour-là :

- **AISP, jamais PISP.** Un agrégateur bancaire européen se connecte sous l'une
  de deux portées, et le mot qui les sépare figure dans le contrat du
  prestataire : *Account Information* (consultation) ou *Payment Initiation*
  (virement). Seule la première entre ici, sous aucune condition la seconde —
  pas même en bac à sable, pas même « pour tester ».
- **Le jeton passe par `variable()`**, qui exige le suffixe `_LECTURE_SEULE` et
  refuse malgré tout les noms parlant de négoce, de retrait ou de clé privée.
  Le suffixe dit l'intention ; les motifs disent ce que la chose est.

---

## 4. Les décisions qui font le résultat

Ce module **absorbe** l'assistant d'allocation qui dormait sous
`archives-backlog/` : 688 lignes et 27 tests verts, mis de côté faute de
personne pour le faire avancer. Sa fiche — `archives-backlog/assistant-patrimoine.md`
— raconte ce qui a été repris et ce qui ne l'a pas été. Son calcul et ses décisions sont repris ici,
et ce sont elles qui valaient le déplacement — le code, on le réécrit ; une
décision payée une fois se reperd.

**L'immobilier compte en valeur nette.** Un bien à 148 000 € financé par
76 500 € de crédit restant pèse 71 500 €. Le compter brut écrase mécaniquement
les autres poches et rend le rééquilibrage illisible tant que le crédit court.
Le capital restant dû reste affiché à côté, pour ne pas perdre l'effet de levier
de vue.

**Le rendement locatif se rapporte à la valeur du bien, pas à l'apport.**
Rapporté à la seule part non financée, un bien acheté presque entièrement à
crédit afficherait des rendements à trois chiffres qui ne veulent plus rien dire.

**L'apport passe avant l'arbitrage.** Renforcer ce qui est sous-pondéré ne
déclenche aucune imposition ; vendre ce qui est sur-pondéré en déclenche, hors
PEA et assurance-vie. Le plan de versement se calcule donc en premier, et une
vente n'est proposée que pour ce que douze mois d'apports ne rattraperaient pas.
Le manque se mesure sur le patrimoine **après** versement : mesuré avant, un
apport de cent mille euros retombait à 49,98 % au lieu de 50.

**Rien ne bouge dans la bande de tolérance.** Sous cinq points d'écart,
arbitrer coûte plus en frais et en impôt que la discipline ne rapporte. Et
« ne rien faire » s'écrit en toutes lettres : un écran sans action doit se lire
comme un feu vert, jamais comme une panne.

**Un prix manquant ne s'invente pas.** Une ligne sans cours vaut `None`, jamais
zéro, et n'entre pas dans le total — que le rapport annonce alors partiel. Le
conseil, lui, est **retenu** : une répartition calculée sur un total incomplet
reste parfaitement plausible à l'écran, et c'est exactement ce qui la rend
dangereuse.

**Un prix vieux ne se présente pas comme frais.** C'est la décision propre à ce
module, le pendant de la précédente. Les cours étant saisis à la main, ils
vieillissent ; chacun porte sa date, et au-delà de la fraîcheur admise le bilan
bascule en partiel comme s'il manquait. Là on refusait d'inventer un prix, ici
on refuse de faire passer celui de l'été dernier pour celui du matin.

---

## 5. Ce que les deux moteurs laissent lire — et ce qu'ils ne laissent pas

C'est le point à comprendre avant de s'étonner d'un total.

### NexusCrypto ne persiste aucune position

**Mesuré avant d'écrire une ligne.** Son portefeuille naît en mémoire au
démarrage, à `capital_initial_usd`, dans `Orchestrateur.__init__`, et meurt avec
le processus. Il n'existe ni instantané, ni base, ni état sur le disque. Ce qui
se lit :

| Lisible | Pas lisible |
| --- | --- |
| `config/config.yaml` — l'allocation **cible** | les positions détenues |
| `logs/` — quand le moteur a tourné | la valeur du portefeuille |

La distinction porte tout : un conseiller qui présenterait « BTC 50 % » comme
une détention afficherait un patrimoine imaginaire, et **parfaitement
plausible**. La poche crypto réellement détenue se saisit donc à la main, comme
le reste.

Un instantané écrit par NexusCrypto en fin de passe lèverait la limite. Ce
serait une modification de NexusCrypto, donc un lot à décider séparément — pas
un geste à glisser depuis ici.

### Une pépite repérée n'est pas une pépite détenue

Le radar, lui, a une vraie mémoire : `donnees/pepites.sqlite3` et
`pepites_radar.md`. Mais il signale une anomalie de volume ; il ne dit pas qu'on
a acheté. Ses trouvailles sortent en **notes**, sous les tableaux, jamais en
lignes valorisées.

Sa base s'ouvre en `mode=ro`. Le radar tient un verrou de fichier pendant un
scan : une lecture concurrente peut alors rendre « base occupée », traité comme
*source occupée* et jamais comme *aucune pépite* — les deux donneraient le même
tableau vide.

---

## 6. Pourquoi les cours se saisissent à la main

C'est la question qu'on pose en premier, alors voici les trois raisons, dans
l'ordre où elles comptent.

1. **Zéro sortie réseau est une propriété vérifiable.** Un test relit le source
   du paquet. « Il ne fait que des GET » serait une promesse qu'il faudrait
   recontrôler à chaque modification — et ce module lit l'argent de quelqu'un.
2. **Les hôtes de cours ne répondent pas** depuis une session distante de ce
   dépôt : les neuf hôtes de marché rendent `000`. Un module de cours écrit ici
   serait du code jamais éprouvé, présenté comme fonctionnel.
3. **Une saisie mensuelle est le rythme réel d'un rééquilibrage.** On ne
   réarbitre pas un patrimoine au cours de la minute.

La contrepartie est traitée plutôt qu'ignorée : chaque prix porte sa date, et au
bout de trente jours le conseil se tait de lui-même.

---

## 7. Vérifier

```bash
python3 -m unittest discover -s tests
```

91 tests, aucun réseau, aucune horloge — les dates et les cours sont injectés,
seule façon d'obtenir demain le même verdict qu'aujourd'hui. Les lecteurs sont
éprouvés sur de vraies structures de fichiers fabriquées en dossier temporaire,
y compris les cas qui comptent le plus : source absente, vide, illisible.

Ce que les tests **ne** couvrent pas, et qu'il faut regarder à l'œil : la mise
en forme du rapport sur un écran étroit, et la justesse d'une estimation
immobilière — qui ne vaut jamais que ce que vaut l'estimation.
