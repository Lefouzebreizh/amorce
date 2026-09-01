# Paper-Manager — assistant administratif personnel

Numériser un document, le comprendre, le ranger, et ne plus y penser. Usage
strictement personnel : tout reste sur la machine, sauf le seul appel qui a
besoin de sortir (la lecture d'un document par un modèle de vision, et
uniquement si elle est activée).

Ce fichier est le plan du projet. **Les quatre modules sont écrits et
vérifiés** : lecture et classement des documents, calendrier, abonnements,
résiliation — plus le remplissage de formulaires PDF. La reconnaissance des
champs se fait par motifs, hors réseau ; le modèle de vision reste le recours
prévu pour ce qu'ils ne trouvent pas.

## Les quatre modules

| Module | Dossier | Ce qu'il fait |
| --- | --- | --- |
| 1. Scan & OCR | `core/scan.py`, `core/extraction.py`, `core/nommage.py` | Un fichier déposé devient un document identifié, nommé et rangé. |
| 2. Calendrier | `core/calendrier.py` | Les dates repérées deviennent des rappels, dans l'agenda du téléphone. |
| 3. Abonnements | `core/abonnements.py` | L'état des contrats, et l'alerte **avant** le préavis, pas après. |
| 4. Résiliation | `core/resiliation.py`, `core/formulaires.py` | Le courrier prêt à signer, et le formulaire PDF rempli sans le remplir. |

## Arborescence

```
paper-manager/
├── README.md
├── requirements.txt
├── paper.py                    point d'entrée unique en ligne de commande
├── admin_config.exemple.json   le modèle versionné (voir plus bas)
├── admin_config.json           le vrai fichier — ignoré par git, il est personnel
├── core/
│   ├── config.py         lecture, validation et réécriture d'admin_config.json
│   ├── modele.py         les dataclasses partagées : Document, Abonnement, Alerte…
│   ├── scan.py           module 1 — un fichier (image, PDF, photo) devient du texte
│   ├── extraction.py     module 1 — le texte devient des champs (nature, montant, dates)
│   ├── nommage.py        module 1 — les champs deviennent un nom et un dossier
│   ├── journal.py        l'index de ce qui a été traité, et la détection des doublons
│   ├── formulaires.py    remplir un PDF : par ses champs, ou par coordonnées s'il est plat
│   ├── calendrier.py     module 2 — les échéances deviennent un fichier .ics
│   ├── abonnements.py    module 3 — l'état des contrats et le calcul des alertes
│   └── resiliation.py    module 4 — le courrier, à partir d'un gabarit et du contrat
├── interface/
│   ├── app.py            l'écran du tableau de bord, en Streamlit — lecture seule
│   ├── rendu.py          sa mise en forme, sans Streamlit : c'est ce qui se teste
│   └── lancer.sh         démarrage en une commande
├── modeles/
│   ├── formulaires/      un plan de remplissage par formulaire (JSON versionné)
│   └── *.txt             gabarits de courriers (texte à trous)
├── tests/                unittest, comme mon-app-audio/
└── coffre/               ignoré par git — c'est là que vivent les documents
    ├── entree/           ce qu'on dépose, en vrac
    ├── formulaires/      les PDF vierges (Cerfa, mandats) — binaires, donc hors dépôt
    ├── classes/          ce qui est rangé : classes/2026/energie/…
    ├── courriers/        ce qui est produit : lettres de résiliation, contestations
    └── documents.json    l'index tenu par la machine
```

## Les décisions qui tiennent le projet

**1. Deux fichiers d'état, et une frontière nette entre les deux.**
`admin_config.json` porte ce qui vient d'une **décision humaine** : mes
abonnements, mes préférences de rangement, une alerte que j'ai choisi de
reporter. `coffre/documents.json` porte ce que la **machine a lu** : un
document, ses champs extraits, son empreinte. Cette frontière n'est pas
cosmétique — c'est elle qui permet de jeter et refabriquer l'index sans jamais
risquer les six mois de saisie des contrats.

**2. Les alertes vivent quand même dans la configuration.**
Une alerte porte une décision (traitée, reportée, ignorée), donc elle est du
côté humain. Le programme réécrit cette section, et elle seule ; le reste du
fichier est réémis dans son ordre d'origine, clés inconnues comprises. Sa mise
en forme, en revanche, devient celle du programme — c'est le prix d'un fichier
réécrit sans analyseur qui conserve les blancs, et il ne se paie qu'une fois.
Toute réécriture est précédée d'une copie en `admin_config.json.bak` : un
fichier de configuration écrasé par un bug, c'est le projet entier qui
redémarre à zéro.

**3. Rien n'est écrasé sans le dire.**
Une commande qui déplace ou renomme simule par défaut et n'agit qu'avec
`--appliquer`, comme `kdp/kdp.py renommer` : un classement automatique dont on
n'a pas vu la sortie une première fois est un classement qu'on refait à la main.
Une commande qui produit un fichier neuf, elle, n'a rien à simuler — mais elle
refuse d'écraser une sortie existante sans `--ecraser`.

**4. Le nom du fichier est la base de données de secours.**
`AAAA-MM-JJ_Emetteur_nature_montant.pdf`, par exemple
`2026-03-14_EDF_facture_78-42EUR.pdf`. La date d'abord, parce qu'un dossier
d'administratif se parcourt dans l'ordre du temps ; le montant dans le nom,
parce que « combien ai-je payé » se répond alors sans ouvrir quoi que ce soit.
La virgule décimale devient un tiret : elle casse les exports CSV et certains
outils de synchronisation. Le jour où ce projet est abandonné, le coffre reste
lisible sans lui.

**5. L'extraction se fait par un modèle de vision, avec un filet de règles.**
Un OCR classique (Tesseract) sur une photo de facture prise de travers rend un
texte que personne ne sait ensuite structurer ; un modèle de vision lit
directement l'image et rend des champs. Mais il coûte, et il sort parfois du
cadre : `extraction.py` valide toujours ce qu'il reçoit (le montant est-il un
nombre, la date est-elle plausible, l'émetteur est-il connu) et retombe sur des
règles d'expressions régulières pour les émetteurs déjà rencontrés — une
facture EDF ressemble à la précédente. C'est ce que sert
`extraction.emetteurs_connus` dans la configuration.

**6. Aucune clé d'API dans la configuration.**
`"cle_api": "env:ANTHROPIC_API_KEY"` — le fichier ne contient que le **nom** de
la variable d'environnement. Ce fichier finit tôt ou tard dans une sauvegarde,
une pièce jointe ou un dépôt.

**7. Les durées de conservation sont dans la configuration, pas dans le code.**
Elles dépendent de la prescription applicable (5 ans pour l'énergie, 1 an pour
les télécoms, à vie pour un bulletin de paie) et elles changent. Le programme
signale ce qui est périmé, il ne le supprime jamais tout seul.

**8. Le préavis, pas l'échéance.**
Un contrat à reconduction tacite ne se résilie pas à sa date anniversaire mais
au plus tard `preavis_jours` avant. C'est cette date-là qui est calculée et
alertée — alerter sur l'échéance, c'est alerter trop tard. La date d'avis
d'échéance reçue de l'assureur est notée elle aussi : reçue en retard, elle
rouvre un droit de résiliation.

## Classer ce qui a été déposé

```bash
python3 paper.py classer                 # simule : montre ce qui irait où
python3 paper.py classer --appliquer     # range pour de bon
```

Le parcours entier : lire le fichier, en tirer les champs, calculer son nom,
l'inscrire au journal. **Rien ne bouge sans `--appliquer`** — un classement
dont on n'a pas vu la sortie une première fois est un classement qu'on refait à
la main.

**Le modèle de vision est le recours, pas la règle.** Il ne part que si trois
conditions sont réunies : `extraction.active`, une page rendue en image — ce que
`scan.py` ne fait que faute de texte utile — et une confiance sous le seuil.
Autrement dit, il ne part que pour les scans et les photos, jamais pour une
facture téléchargée qui porte son texte. **Il complète, il n'écrase jamais** :
un champ lu derrière son étiquette se retrouve en rouvrant le document, un champ
rendu par un modèle non, et échanger le premier contre le second serait troquer
du sûr contre du probable. Ce qu'il rend traverse exactement les mêmes contrôles
que les motifs — montant plausible, date dans la fenêtre permise, nature de la
liste — et pèse moins dans la confiance, parce que rien ne vient confirmer sa
lecture.

Ce que la lecture sait faire sans réseau, et pourquoi c'est suffisant la plupart
du temps : une facture française est un document très régulier. « Net à payer »,
« Référence client », une date en JJ/MM/AAAA sont des motifs, pas de la
compréhension. Quatre pièges les rendent moins évidents qu'il n'y paraît :

- **Les milliers sont séparés par une espace insécable** : un motif naïf lit
  « 234,56 » dans « 1 234,56 € » et se trompe d'un facteur mille.
- **Une date française commence par le jour** : 03/04/2026 est le 3 avril.
- **Le plus gros nombre de la page n'est pas le total** : on cherche le montant
  *étiqueté*, et « Net à payer » prime sur « Total TTC », qui peut inclure un
  acompte déjà versé.
- **La date du pied de page est celle de l'impression** : la prendre pour
  l'émission range la facture au mauvais mois.

**Ce qui n'est pas sûr n'est pas rangé.** La confiance se calcule sur la manière
dont chaque champ a été trouvé — derrière son étiquette, ou ramassé au milieu de
la page. Sous `extraction.confiance_minimale`, le document reste dans le dépôt
avec la liste de ce qui lui manque, champ par champ : « il manque la date
d'émission » se corrige, « à relire » non.

Deux fichiers identiques ne sont rangés qu'une fois, reconnus par l'empreinte de
leur contenu et non par leur nom — c'est le cas dès qu'on synchronise deux
dossiers. Le compte rendu distingue « déjà rangé lors d'un passage précédent »
de « deux copies dans le même dépôt » : la première est une bonne nouvelle, la
seconde demande de choisir.

## Le tableau de bord

```bash
python3 paper.py etat                                    # ce que je paie, ce qui arrive
python3 paper.py etat --traiter <id-alerte>              # c'est fait
python3 paper.py etat --reporter <id-alerte>             # revoir ça à l'échéance
python3 paper.py etat --enregistrer                      # écrire les alertes recalculées
```

Il sort le total mensuel et annuel, la répartition par catégorie de la plus
chère à la moins chère — c'est là qu'on cherche où couper —, les alertes du
jour, puis les contrats classés par urgence de préavis.

Ce que le calcul sait, et qui vaut d'être connu :

- **La date affichée est celle du préavis**, jamais celle du terme. Un contrat
  à deux mois de préavis qui se termine le 1er novembre n'est plus résiliable
  après le 2 septembre.
- **L'échéance d'un contrat reconduit avance toute seule.** Une ligne saisie en
  2021 donne encore la bonne date en 2026 : une configuration qu'il faut tenir
  à jour à la main n'est jamais à jour.
- **Le coût d'un départ n'est chiffré que si l'engagement court encore** — celui
  de la première période. Une assurance reconduite depuis quatre ans ne coûte
  rien à quitter, et lui annoncer un coût de sortie ferait renoncer à résilier.
- **Pas d'alerte sur un prélèvement mensuel.** Trente euros tous les mois ne
  surprennent personne ; c'est la prime annuelle qui vide le compte. Une alerte
  qui revient chaque mois est du bruit, dans un outil fait pour en supprimer.
- **Une alerte de contrat devenue sans objet s'en va** (contrat résilié,
  échéance déplacée). Une alerte dont la date est **passée** reste, jusqu'à ce
  qu'on la marque traitée : la faire disparaître, ce serait décider à la place
  de l'utilisateur que l'année reconduite n'était pas grave.
- **Le statut décidé à la main survit au recalcul.** C'est la seule chose que
  le programme lit dans le fichier plutôt que de la calculer.
- **La facture attendue qui n'arrive pas** ne se signale que si l'on a **déjà
  vu** un document de cet émetteur. Sans cette garde, chaque abonnement crierait
  au premier passage : l'assistant ne saurait pas distinguer une facture
  manquante d'un coffre qu'on vient d'ouvrir, et c'est le faux signal qui fait
  ignorer les vrais. Un délai de grâce s'ajoute à la période — une facture
  mensuelle n'arrive pas le même jour tous les mois.
- **Ce qu'on peut jeter est groupé par catégorie et par année.** Cinq ans de
  factures d'énergie font soixante documents : une alerte par document noierait
  tout le reste, alors qu'« les douze factures de 2020 peuvent être jetées » se
  traite d'un geste. Le groupe n'expire qu'avec son document le plus récent —
  mieux vaut garder un an de trop que jeter un justificatif encore utile. Et
  **rien n'est jamais supprimé** : le programme signale.

## L'écran, depuis le téléphone

```bash
bash interface/lancer.sh              # http://localhost:8502
PORT=8600 bash interface/lancer.sh    # ailleurs
```

Le même tableau de bord que `python3 paper.py etat`, mais lisible à bout de
bras : le total du mois, la répartition par catégorie de la plus chère à la
moins chère, ce qu'il y a à faire aujourd'hui, et les contrats classés par
urgence de préavis.

- **Il ne calcule rien.** L'écran appelle `core.abonnements.tableau()` et
  affiche ce qu'il rend. Ce n'est pas une élégance : un total réécrit dans
  l'affichage finirait par diverger de celui que les tests vérifient, sans que
  rien ne le signale — et c'est l'écran qu'on croirait, parce que c'est l'écran
  qu'on regarde. Les deux affichages se comparent d'ailleurs côte à côte, sur
  la configuration d'exemple, et disent le même mot.
- **Il ne fait que lire.** Aucun bouton, aucune écriture. Marquer une alerte
  traitée reste `python3 paper.py etat --traiter <id>` : une alerte fermée d'un
  pouce distrait dans un couloir, c'est une échéance perdue.
- **Les jauges sont deux barres horizontales**, jamais un cercle — la règle du
  dépôt (`CLAUDE.md` §2, `/tailwind-mobile-ux`), et sa raison est le terrain :
  la WebView de MIUI tronque les jauges circulaires en SVG. Deux et non une,
  parce que la fenêtre courte (ce qu'il y a à faire aujourd'hui) ne laisse
  jamais voir venir la longue (les préavis des trois prochains mois).
- **`admin_config.json` absent n'est pas une panne.** Il est personnel et
  ignoré par git : sur une machine neuve, il n'existe pas. L'écran affiche
  alors la commande à taper, et rien d'autre.
- **Ce qui se teste est dans `interface/rendu.py`**, qui n'importe pas
  Streamlit. `app.py`, lui, l'importe — et la CI du dépôt ne l'installe pas
  exprès, pour que la vérification reste à quinze secondes.

Ce qui ne se voit qu'en le faisant, et qui reste donc à confirmer : le rendu
réel sur le téléphone de référence, où la barre d'adresse de Chrome et la barre
de gestes de HyperOS amputent la hauteur annoncée. Il a été mesuré ici dans un
Chromium à 393 × 873, ce qui voit les débordements mais ni le tactile ni la
police système.

## Les rappels d'agenda

```bash
python3 paper.py agenda                       # écrit coffre/rappels.ics
python3 paper.py agenda --vers ailleurs.ics
```

Le fichier s'ouvre depuis le téléphone et ses événements entrent dans l'agenda.
Pas de service qui tourne en tâche de fond : le rappel doit arriver là où on
regarde déjà.

- **Un événement par échéance, trois sonneries dedans** (30, 7 et 1 jours
  avant, réglable par `rappels.avant_echeance_jours`). Un événement par rappel
  remplirait l'agenda de trois lignes pour une seule chose à faire ; une seule
  sonnerie tomberait forcément un jour où l'on ne peut rien faire.
- **Le titre porte l'action** — « Résilier — Assurance habitation », et la
  consigne complète en description. Un rappel qui oblige à rouvrir un dossier
  pour savoir quoi faire est un rappel qu'on repousse.
- **L'heure est flottante** : 8 h là où se trouve l'appareil. C'est ce qu'on
  veut d'un rappel personnel, et cela évite d'embarquer un bloc `VTIMEZONE`,
  trente lignes de règles de changement d'heure qui vieillissent.
- **Les identifiants sont stables** : réimporter le fichier met à jour les
  événements au lieu d'en créer des doubles.
- **La sortie est déterministe** : même configuration, même jour, même fichier
  à l'octet près. On peut le comparer au précédent pour voir ce qui a changé.
- **Les échéances déjà passées n'y vont pas.** Un événement daté d'hier ne
  prévient plus personne ; le tableau de bord, lui, continue de les afficher en
  retard tant qu'elles ne sont pas traitées.

Le fichier est écrit sans bibliothèque : il n'y a ici ni récurrence ni fuseau à
gérer, et il restait trente lignes de format texte — moins que le coût d'une
dépendance à installer sur chaque machine qui régénère le fichier.

## Remplir un PDF

Un Cerfa, un mandat de prélèvement, un bulletin d'adhésion : les mêmes vingt
informations, une fois par an, recopiées à la main. Le repérage des champs se
fait **une fois** et devient un plan JSON, rejoué ensuite sans y penser.

```bash
python3 paper.py champs coffre/formulaires/mon-cerfa.pdf              # ce que le PDF déclare
python3 paper.py champs coffre/formulaires/mon-cerfa.pdf --gabarit \
        > modeles/formulaires/mon-cerfa.json                          # le squelette à compléter
python3 paper.py remplir modeles/formulaires/mon-cerfa.json --abonnement maif-habitation
```

Le plan associe chaque champ du PDF à un gabarit : `"{identite.prenom}
{identite.nom}"`, `"{abonnement.reference_client}"`, `"Fait à {identite.ville},
le {@aujourdhui}"`, ou `true` pour cocher une case. La syntaxe complète est dans
`modeles/formulaires/README.md`.

Quatre choix qui méritent d'être connus avant d'y toucher :

- **Le PDF vierge n'est jamais modifié**, et le résultat est **aplati** : les
  valeurs sont gravées dans la page. Un formulaire dont les champs restent
  vivants s'imprime vierge chez qui ne régénère pas leur apparence — et c'est le
  guichet qui le découvre. `--modifiable` garde les champs si on y tient.
- **La valeur « cochée » n'est jamais écrite en dur** : elle vaut `/Yes` sur un
  formulaire et `/1` sur le suivant. Le plan dit `true`, le module lit l'état que
  la case déclare.
- **Un champ du plan absent du PDF arrête tout.** Un Cerfa change de millésime et
  renomme ses champs ; neuf champs remplis sur douze donnent un dossier qui a
  l'air complet et revient trois semaines plus tard.
- **Un PDF plat se remplit aussi**, par coordonnées (`positions` dans le plan).
  Attention alors : les polices de base d'un PDF sont limitées au latin-1, et
  `œ`, `€` ou le tiret cadratin y deviennent `?` sans le moindre avertissement.
  Le module les transpose (`œ` → `oe`, `€` → `EUR`) — mesuré, pas supposé.

## Le courrier de résiliation

```bash
python3 paper.py resilier maif-habitation              # un PDF prêt à signer
python3 paper.py resilier orange-fibre --texte         # à coller dans un formulaire en ligne
python3 paper.py resilier salle-sport --gabarit resiliation_simple --motif "un déménagement"
```

Quatre gabarits dans `modeles/`, et **c'est la situation juridique qui choisit**,
pas un `si` à l'intérieur d'un texte : un gabarit truffé de conditions n'est plus
relisible, et c'est une lettre qu'on signe de son nom.

| Situation | Gabarit | Date d'effet |
| --- | --- | --- |
| Avis d'échéance **reçu** trop tard (moins de 15 jours avant la fin du préavis) | `resiliation_avis_tardif` | au terme |
| Le préavis peut encore être respecté | `resiliation_echeance` | au terme — ni mois de plus, ni pénalité |
| Assurance ou mutuelle en cours depuis plus d'un an, hors délai de préavis | `resiliation_infra_annuelle` | un mois après réception |
| Tout le reste | `resiliation_simple` | un mois |

Ce qui mérite d'être connu avant d'y toucher :

- **Le gabarit garantit le fond.** `controler` vérifie que le courrier composé
  porte la référence client, le contrat visé, la date d'effet et la demande de
  confirmation écrite — et **refuse de produire un fichier** s'il en manque une.
  Une lettre sans référence client se fait classer sans suite.
- **Le gabarit doit s'accorder avec la date d'effet calculée.** Un texte qui
  annonce un effet « un mois après réception » sous une date d'effet calculée au
  terme se contredit, et c'est le genre d'incohérence qu'un service client
  relève avant de refuser. Un test compose le courrier de chaque contrat à
  quatre dates différentes pour s'en assurer.
- **Un avis d'échéance à venir ne fonde aucun droit.** `date_avis_echeance` est
  une date de réception : tant qu'elle est dans le futur, la lettre ne peut pas
  affirmer avoir reçu ce courrier.
- **Le texte invoqué dépend de qui est en face** : code des assurances pour un
  assureur, code de la sécurité sociale pour une complémentaire santé, code de
  la consommation pour tout le reste. Citer le mauvais affaiblit précisément la
  lettre qu'on voulait rendre opposable.
- **La lettre est datée du jour de sa composition**, pas de son impression :
  tous ses délais sont calculés à cette date.
- **Rien n'est envoyé.** Un courrier administratif parti tout seul ne se
  rattrape pas.

## Ce qui n'est pas fait, et pourquoi

- **Pas de base SQLite.** Quelques dizaines d'abonnements et quelques milliers
  de documents ; du JSON se lit, se corrige à la main et se sauvegarde par une
  copie de fichier.
- **L'interface ne fait que lire.** `interface/app.py` affiche le tableau de
  bord ; tout ce qui écrit — marquer une alerte traitée, classer un dépôt,
  produire un courrier — reste à `python3 paper.py`. Voir plus bas.
- **Pas de relève de boîte mail.** Beaucoup de factures arrivent par courriel,
  et c'est la suite logique — mais c'est un cinquième module, avec ses propres
  questions d'authentification.

## Le fichier `admin_config.json`

`admin_config.exemple.json` est le modèle. Le copier, le remplir, ne jamais
committer la copie.

```bash
cp admin_config.exemple.json admin_config.json
```

Sections, dans l'ordre du fichier :

| Section | Écrite par | Contenu |
| --- | --- | --- |
| `identite` | moi | Ce qui remplit l'en-tête d'un courrier de résiliation. |
| `classement` | moi | Racine du coffre, gabarit de nom, catégories et durées de conservation. |
| `extraction` | moi | Modèle de vision, seuil de confiance, émetteurs déjà reconnus. |
| `rappels` | moi | Combien de jours avant, à quelle heure, où sort le `.ics`. |
| `abonnements` | moi | Un objet par contrat — c'est le cœur du fichier. |
| `alertes` | **le programme**, et moi pour le statut | Ce qui est ouvert aujourd'hui. |

### Un abonnement, champ par champ

| Champ | À quoi il sert |
| --- | --- |
| `id` | Identifiant stable, cité par les alertes et les courriers. |
| `libelle`, `emetteur`, `categorie` | Affichage, et rattachement des documents entrants. |
| `montant`, `periodicite` | Total mensuel du tableau de bord, et date du prochain prélèvement. |
| `reference_client` | La seule chose qu'un service client demande. Elle doit être dans le courrier. |
| `engagement` | `debut`, `fin`, `duree_mois`. `fin` est la fin de la **première** période, celle qui engage — pas la prochaine date anniversaire d'un contrat reconduit dix fois. |
| `reconduction_tacite`, `date_avis_echeance` | Le couple qui décide s'il reste un droit de résiliation. |
| `preavis_jours` | Ce qui fait la date d'alerte. `0` pour un contrat résiliable à tout moment. |
| `resiliable_en_ligne` | Un abonnement souscrit en ligne se résilie en ligne : pas de lettre à écrire. |
| `adresse_resiliation` | Postale ou électronique, selon ce qui est opposable. |
| `recommande` | Le courrier doit-il partir en recommandé avec accusé de réception. |
| `statut` | `actif`, `en_resiliation`, `resilie`. Un contrat résilié reste dans le fichier : c'est l'historique. |
| `alerte_avant_jours` | Surcharge locale du réglage global, pour un contrat qu'on veut voir venir de plus loin. |

### Une alerte, champ par champ

| Champ | À quoi il sert |
| --- | --- |
| `id` | Stable, pour retrouver l'alerte d'un passage à l'autre. |
| `type` | `preavis`, `renouvellement`, `paiement`, `document_manquant`, `conservation` — tous calculés. Les deux derniers demandent le journal des documents. |
| `source` | `abonnement:<id>` ou `document:<id>` — d'où elle vient. |
| `echeance` | La date qui compte : celle du préavis, pas celle du contrat. |
| `declenchement` | À partir de quand elle apparaît dans `paper.py etat`. |
| `statut` | `ouverte`, `reportee`, `traitee`. C'est la part humaine du fichier. |
| `action` | La phrase à lire. Une alerte qui ne dit pas quoi faire est un bruit. |

## Les commandes prévues

```bash
python3 paper.py etat [--traiter ID | --reporter ID]       # écrit
python3 paper.py agenda [--vers coffre/rappels.ics]        # écrit
python3 paper.py champs <formulaire.pdf> [--gabarit]       # écrit
python3 paper.py remplir <plan.json> [--abonnement <id>]   # écrit
python3 paper.py resilier <id> [--texte] [--motif ...]     # écrit
python3 paper.py classer [--source ...] [--appliquer]      # écrit
```

## Vérifier

```bash
python3 -m unittest discover -s paper-manager/tests -v
```

Les tests couvrent ce qui est calculable : l'arithmétique des échéances et des
préavis, la validation et la réécriture de la configuration, le tableau de bord
et la fusion des alertes, le format du fichier de rappels jusqu'au pliage des
lignes, le choix du gabarit de résiliation et les mentions obligatoires du
courrier, la résolution des gabarits et le remplissage effectif d'un PDF, et la
mise en forme du tableau de bord. Le formulaire de test est **fabriqué à
l'exécution** — ce dépôt ne versionne aucun binaire, et un Cerfa vierge en est
un.

**La suite ne traverse jamais Streamlit.** `interface/app.py` l'importe,
`interface/rendu.py` non : c'est là que vit tout ce qui se vérifie de
l'affichage, et c'est ce qui garde la vérification à quinze secondes. La
distinction est écrite en tête de `.github/requirements-tests.txt`, et il ne
faut pas ajouter Streamlit à ce fichier pour « faire bonne mesure » — aucune
assertion ne le traverse.

PyMuPDF, `anthropic` et `pydantic` sont nécessaires aux tests ; Streamlit ne
l'est qu'à l'exécution de l'écran. Le hook du dépôt les installe tous dans une
session distante.

## Ce qui n'a pas pu être vérifié ici

Le chemin par modèle est éprouvé avec un client de substitution : la requête
construite, la validation de ce qui revient, la fusion avec les motifs et le
comportement en cas de panne. **Un vrai appel n'a jamais été fait** — aucune clé
n'est présente dans l'environnement de développement. Reste donc à confirmer, le
jour où une clé existe, que l'API rend bien la forme attendue.

Les motifs, eux, ne diront jamais si une **vraie** facture d'un fournisseur donné
les suit. Cela ne se verra qu'en déposant de vrais documents, et la pile « à
relire » est faite pour que ça se voie sans rien perdre.

## Prochaine étape

**Les gestes**, maintenant que l'écran a fait ses preuves : marquer une alerte
traitée ou reportée depuis le téléphone, sans revenir au terminal. C'est la
seule écriture qui manque vraiment au quotidien — les autres commandes
(`classer`, `resilier`, `remplir`) produisent des fichiers qu'on veut de toute
façon relire avant de s'en servir.

**La relève de boîte mail** ensuite, le cinquième module : beaucoup de factures
arrivent par courriel, et les déposer à la main dans `coffre/entree/` est le
geste qui reste.
