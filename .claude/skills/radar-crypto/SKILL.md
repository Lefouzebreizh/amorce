---
name: radar-crypto
description: Où poser chaque fichier du radar crypto `pepites/`, l'ordre des cinq skills qu'on ne réarrange pas, les six invariants qui empêchent l'outil de délivrer un faux quitus, et les pièges d'API qui coûtent une heure chacun. À utiliser dès qu'on touche à `pepites/` — ajouter une blockchain, une source de données, un critère de notation, un skill ; brancher ou déboguer une API ; écrire un test — et dès qu'une demande parle de DexScreener, GoPlus, honeypot.is, RugCheck, Etherscan, Helius, de rugpull, de honeypot, de liquidité verrouillée, de smart money, de low-cap ou d'alerte Telegram.
---

# Le radar crypto vit dans `pepites/`

Python 3, aucun serveur, aucune base ailleurs qu'un fichier SQLite. Cinq skills
en file : découvrir, noter, contrôler le contrat, croiser les portefeuilles,
alerter. Le `pepites/README.md` explique **pourquoi** chaque seuil vaut ce qu'il
vaut ; ce fichier-ci dit **où écrire** et **ce qu'on ne casse pas**.

## Où atterrit un changement

| Ce qu'on ajoute | Où | Ce qu'on ne fait pas |
| --- | --- | --- |
| Une blockchain **EVM ou Solana** | une entrée dans `config/chaines.yaml` | nommer une chaîne ailleurs — aucun autre fichier n'a le droit |
| Une blockchain d'une **autre famille** (Sui, Aptos, TON) | d'abord une source de sécurité et un relevé de portefeuilles dans `sources/`, ensuite le YAML | croire que le YAML suffit — voir le piège en fin de fichier |
| Un service d'API | `sources/<service>.py` | y mettre un seuil ou une élimination |
| Un critère de notation | `config/reglages.yaml` **et** `CHAMPS_METRIQUES` dans `core/modeles.py` | oublier de rééquilibrer les poids à 100 |
| Une règle de décision | le skill concerné, dans `skills/` | la glisser dans une source |
| Un réglage | `config/reglages.yaml` | le coder en dur |
| Ce qui circule entre deux étages | `core/modeles.py` | rendre un dictionnaire nu |

Les noms de modules, de classes et de fonctions sont **en français**, comme dans
`mon-app-audio/`. Les tests sont du `unittest` de la bibliothèque standard, leurs
intitulés sont des phrases qui décrivent un comportement.

## L'ordre des étages n'est pas un goût

```
DexScreener → regroupement → filtres durs → note → persistance → bouclier → traqueur → alerte
   gratuit        gratuit        gratuit    gratuit   gratuit     30/min     lent      —
```

GoPlus répond **trente fois par minute**. Un scan brasse quelques centaines de
jetons. Tout ce qui se calcule sans réseau doit donc s'exécuter d'abord et
ramener ces centaines à vingt-cinq — c'est la seule raison pour laquelle l'outil
tient dans les quotas gratuits. Déplacer un contrôle de sécurité avant la note,
ou noter après avoir interrogé une API, fait passer le scan de la minute à
l'heure sans que rien n'ait l'air cassé.

Corollaire pour un nouveau skill : demande-toi ce qu'il coûte en appels, et
place-le en conséquence.

## Les six invariants

Chacun est justifié en tête du fichier concerné. Relire ce bloc avant d'y
toucher — il porte la décision, et c'est ce que le projet a de plus précieux.

**1. Une source traduit, un skill décide.** Un module de `sources/` connaît la
forme JSON d'un service et rend un objet de `core.modeles`. Pas un seuil, pas
une élimination. C'est ce qui permet de remplacer RugCheck le jour où il ferme
son accès gratuit — ça arrivera — sans relire une ligne de logique de détection.

**2. `None` n'est pas `False`.** Dans un `Constat`, l'absence veut dire « cette
source ne sait pas ». La confondre avec « rien à signaler » délivrerait un
quitus que personne n'a donné : une panne de GoPlus déclarerait tout le marché
propre. Un jeton sur lequel aucune source ne s'est prononcée sort en `INCONNU`
avec un facteur inférieur à 1, jamais en `SUR`.

**3. On lit la mémoire avant de l'écrire.** Deux fois, à deux étages. Le relevé
qu'on s'apprête à écrire ne doit pas confirmer le candidat qui le produit ; le
jeton qu'on examine ne doit pas compter dans les apparitions de ses propres
portefeuilles. Dans les deux cas, l'ordre inverse donne un filtre qui ne filtre
plus rien **tout en ayant l'air de fonctionner** — le pire des deux mondes.

**4. La note se fait par trapèzes, jamais par seuils.** Un seuil est binaire, et
tout manipulateur se place juste au-dessus ; une note linéaire récompense
l'extrême, or sur un jeton de 500 000 $ l'extrême est presque toujours fabriqué.
Un critère a une zone saine, et s'en éloigner **des deux côtés** fait baisser la
note. Ce qu'un trapèze ne peut pas voir — une symétrie trop parfaite, des ventes
qui échouent, un ticket minuscule répété — relève d'un **drapeau**, qui élimine
au lieu de retirer des points.

**5. Le bonus de portefeuilles s'ajoute et plafonne ; il ne multiplie pas.**
Deux adresses réputées peuvent se tromper ensemble — c'est même la mécanique de
la plupart des sorties organisées. Un indice ne doit jamais pouvoir rattraper
une mauvaise note de fond.

**6. Toutes les paires d'un tour portent le même instant de relevé.** La
découverte s'étale sur plusieurs minutes ; les âges et les écarts entre deux
scans doivent rester comparables entre eux. Un horodatage par appel ferait
dépendre la persistance de l'ordre des requêtes.

## Vérifier

```bash
cd pepites
python3 -m unittest discover -s tests    # ~120 tests, aucun ne touche au réseau
python3 profils.py                       # l'effet des réglages sur six profils connus
```

Un changement de source d'API se teste sur une **charge utile rejouée**, pas sur
le réseau : c'est ce qui permet d'attraper une réponse malformée sans attendre
qu'elle arrive un mardi soir. Voir `ClientFactice` dans `tests/test_pipeline.py`,
qui rejoue DexScreener et GoPlus de bout en bout.

Ce qu'aucun test ne dit : **si l'API a changé de forme**. Rien n'a encore tourné
contre les services réels. Un changement qui touche à `sources/` se signale comme
non vérifié en conditions réelles tant qu'un vrai `main.py scan` n'a pas tourné.

## Les pièges, déjà payés une fois chacun

- **Le radar ne route que deux familles de chaînes.** `est_evm` est dérivé de
  l'identifiant GoPlus, et trois endroits traitent le `else` comme « Solana » :
  `sources/goplus.py`, `skills/bouclier.py`, `skills/smart_money.py`. Une
  troisième famille partirait vers les services Solana et finirait en verdict
  `INCONNU` sans un message — branchée en apparence, muette en pratique. Le
  chargement la refuse désormais, en disant quoi écrire ; ce refus est la seule
  raison pour laquelle les trois `else` ont le droit de rester des `else`.
- **DexScreener n'a pas de point d'entrée « toutes les paires ».** Beaucoup de
  tutoriels le supposent ; il n'existe pas. La découverte recoupe trois sources,
  dont notre propre mémoire. C'est le point faible de l'outil, pas la notation.
- **Les taxes de GoPlus sont des fractions de 1 (`"0.05"` = 5 %), celles de
  honeypot.is sont déjà en pourcentage.** Les additionner sans convertir donne
  un rejet ou un blanc-seing, selon le sens de l'erreur.
- **GoPlus omet les champs qu'il ne sait pas** au lieu de les mettre à zéro.
  D'où `_drapeau()`, qui rend `None` sur l'absence. Voir l'invariant 2.
- **La part de liquidité verrouillée est la seule grandeur du bouclier dont une
  valeur *basse* est le danger.** Toutes les autres — taxes, concentration — se
  croisent au maximum ; celle-là se croise au **minimum**, sinon une source
  généreuse annule le rejet d'une source prudente et rouvre la porte au retrait
  de liquidité. Ce défaut a été introduit une fois, en écrivant `_maximum` par
  symétrie avec les voisines.
- **Une liste `lp_holders` vide rend `None`, pas `0`.** Zéro pour cent de
  liquidité verrouillée est un rejet net ; « on ne sait pas » ne doit pas en
  être un.
- **Les pools et les contrats étiquetés sortent du calcul de concentration.**
  Sans cette exclusion, tout jeton honnête est rejeté : le pool détient
  mécaniquement une grosse part de l'offre.
- **Les adresses EVM se comparent en minuscules, celles de Solana pas.** En
  base58, `A` et `a` sont deux comptes différents : confondre les deux ferait
  passer un faux USDC pour le vrai. `Chaine.normaliser()` tranche, rien d'autre.
- **`pairCreatedAt` est en millisecondes**, et absent sur certains pools. Sans
  date, l'âge vaut 0 et le filtre écarte le candidat — c'est le bon sens de
  l'échec : on ne mise pas sur un pool dont on ignore la date.
- **Un critère ajouté à `reglages.yaml` sans champ dans `CHAMPS_METRIQUES` est
  refusé au chargement**, et les poids doivent tomber sur 100. Les deux refus
  sont délibérés : sans eux, l'erreur se manifeste par « le radar ne trouve plus
  rien » et on cherche du côté de l'API pendant une heure.
- **Sur Solana, le traqueur lit les gros porteurs, pas les premiers acheteurs.**
  Remonter au premier achat demanderait des centaines d'appels par jeton. Ne pas
  écrire « premiers acheteurs » dans un message qui parle de Solana.
- **Le rapport et l'alerte ne disent jamais « sûr » sans nommer les sources.**
  Un verdict sans provenance laisse croire à une vérification qui n'a peut-être
  pas eu lieu.

## Ce que l'outil ne promet pas

Il repère une anomalie statistique de volume et écarte les pièges **mécaniques**
— revente bloquée, émission ouverte, liquidité retirable. Il n'écarte pas la
décision d'une équipe de vendre, et il ne prédit rien. Tout texte produit par ce
projet — rapport, alerte, message de commit — doit rester à cette hauteur-là.
