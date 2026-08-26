# Assistant d'allocation d'actifs

Un tableau, en console, qui répond à trois questions : combien vaut le
patrimoine aujourd'hui, à quelle distance il est de la répartition visée, et où
mettre le prochain versement.

Bourse, crypto, immobilier et liquidités dans le même total — un portefeuille
d'ETF regardé seul donne une image fausse dès qu'il y a un bien à côté.

```bash
pip install -r requirements.txt
cp config.example.json config.json      # puis remplacer les montants fictifs
python3 assistant.py
```

`config.json` reste sur la machine et n'est pas versionné (voir `.gitignore`).
Aucune clé d'API n'est nécessaire : Yahoo Finance et l'offre publique de
CoinGecko répondent sans authentification.

## Le fichier de configuration

```json
{
  "profil": {
    "appetence_risque": "equilibre",
    "horizon_annees": 15,
    "apport_mensuel": 500,
    "cibles_pct": { "bourse": 50, "crypto": 8, "immobilier": 32, "liquidites": 10 },
    "bande_tolerance_pct": 5
  },
  "actifs": { "bourse": [], "crypto": [], "immobilier": [], "liquidites": [] }
}
```

**`cibles_pct`** porte l'appétence au risque, et rien d'autre. `appetence_risque`
n'est qu'une étiquette pour s'en souvenir : ce sont les quatre pourcentages qui
pilotent le rééquilibrage. Ils doivent totaliser 100 — l'assistant refuse de
démarrer sinon, parce qu'une somme à 97 % décalerait chaque écart de trois
points sans que rien ne le signale.

**`bande_tolerance_pct`** est la largeur de la zone où l'on ne fait rien. Sous
cinq points d'écart, arbitrer coûte plus en frais et en impôt que la discipline
ne rapporte.

| Classe | Champs | Prix |
| --- | --- | --- |
| `bourse` | `nom`, `ticker`, `quantite`, `pru`, `enveloppe` | Yahoo Finance, converti en euros si le ticker cote ailleurs |
| `crypto` | `nom`, `id_coingecko`, `quantite`, `pru`, `conservation` | CoinGecko, coté en euros directement |
| `immobilier` | `nom`, `valeur_estimee`, `capital_restant_du`, `loyer_mensuel_brut`, `charges_annuelles` | saisi à la main |
| `liquidites` | `nom`, `montant`, `taux_annuel_pct` | saisi à la main |

Le `ticker` est celui de Yahoo, place de cotation comprise : `CW8.PA` pour
Paris, `CSPX.AS` pour Amsterdam, `X13.DE` pour Francfort. L'`id_coingecko` est
celui de l'adresse de la fiche (`bitcoin`, `ethereum`), pas le symbole.
L'`enveloppe` (PEA, CTO, AV, PER) ne sert pas au calcul : elle sert au conseil,
parce qu'un arbitrage dans un PEA n'est pas imposé et qu'un arbitrage sur un
compte-titres l'est.

## Les décisions qui font le résultat

**L'immobilier compte en valeur nette.** Un bien à 148 000 € financé par
76 500 € de crédit restant pèse 71 500 €. Le compter brut écraserait
mécaniquement les autres classes et rendrait le rééquilibrage illisible tant que
le crédit court. Le capital restant dû reste affiché à côté de l'estimation,
pour ne pas perdre l'effet de levier de vue.

**Le rendement locatif se calcule sur la valeur du bien, pas sur l'apport.**
Rapporté à la seule part non financée, un bien acheté presque entièrement à
crédit afficherait des rendements à trois chiffres qui ne veulent plus rien
dire.

**L'apport passe avant l'arbitrage.** Renforcer ce qui est sous-pondéré ne
déclenche aucune imposition ; vendre ce qui est sur-pondéré en déclenche, hors
PEA et assurance-vie. L'assistant répartit donc d'abord le versement mensuel,
puis ne propose de vendre que ce que douze mois d'apports ne rattraperaient pas.
Et « alléger » ne veut pas dire la même chose partout : un appartement ne se
vend pas par tranches, il se dilue en renforçant le reste.

**Un prix manquant ne s'invente pas.** Si une source ne répond pas, la ligne est
marquée « prix indisponible », elle ne compte pas pour zéro, et le total est
annoncé comme partiel. Un patrimoine faux présenté comme sûr conduirait à un
arbitrage à l'aveugle — pire que pas de tableau du tout.

## Vérifier

```bash
python3 -m unittest discover -s tests
```

Les tests couvrent tout le calcul — validation du fichier, valorisation, écarts,
répartition de l'apport, formatage — avec des cours injectés à la main : c'est
la seule façon d'écrire un test qui donne le même verdict demain qu'aujourd'hui.
Ce qui sort sur le réseau (`cours_bourse`, `taux_vers_euro`, `cours_crypto`) est
confiné à trois fonctions et se vérifie en lançant l'assistant.

## Ce que ce n'est pas

Un outil personnel, pas un conseil en investissement : les cours de Yahoo sont
différés, une estimation immobilière saisie à la main vaut ce que vaut
l'estimation, et aucune fiscalité n'est calculée — seulement rappelée.
