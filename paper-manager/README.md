# Paper-Manager — assistant administratif personnel

Numériser un document, le comprendre, le ranger, et ne plus y penser. Usage
strictement personnel : tout reste sur la machine, sauf le seul appel qui a
besoin de sortir (la lecture d'un document par un modèle de vision, et
uniquement si elle est activée).

Ce fichier est le plan du projet. Écrits à ce jour : le modèle de données, la
configuration et le remplissage de formulaires PDF, avec leurs tests. Les autres
modules sont des coquilles portant leur justification.

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
fichier est relu et réémis tel quel. Toute réécriture est précédée d'une copie
en `admin_config.json.bak` : un fichier de configuration écrasé par un bug,
c'est le projet entier qui redémarre à zéro.

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

## Ce qui n'est pas fait, et pourquoi

- **Pas de base SQLite.** Quelques dizaines d'abonnements et quelques milliers
  de documents ; du JSON se lit, se corrige à la main et se sauvegarde par une
  copie de fichier.
- **Pas d'interface web pour l'instant.** Le tableau de bord du module 3 est
  d'abord `python3 paper.py etat`. Le jour où la ligne de commande ne suffira
  plus, c'est un `interface/app.py` en Streamlit, comme `mon-app-audio/`.
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
| `engagement` | `debut`, `fin`, `duree_mois` : partir avant la fin coûte des mois restants. |
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
| `type` | `preavis`, `renouvellement`, `paiement`, `document_manquant`, `conservation`. |
| `source` | `abonnement:<id>` ou `document:<id>` — d'où elle vient. |
| `echeance` | La date qui compte : celle du préavis, pas celle du contrat. |
| `declenchement` | À partir de quand elle apparaît dans `paper.py etat`. |
| `statut` | `ouverte`, `reportee`, `traitee`. C'est la part humaine du fichier. |
| `action` | La phrase à lire. Une alerte qui ne dit pas quoi faire est un bruit. |

## Les commandes prévues

```bash
python3 paper.py champs <formulaire.pdf> [--gabarit]       # écrit
python3 paper.py remplir <plan.json> [--abonnement <id>]   # écrit
python3 paper.py classer --source coffre/entree            # module 1, à venir
python3 paper.py etat                                      # module 3, à venir
python3 paper.py agenda --vers coffre/rappels.ics          # module 2, à venir
python3 paper.py resilier <id-abonnement>                  # module 4, à venir
```

## Vérifier

```bash
python3 -m unittest discover -s paper-manager/tests -v
```

Les tests couvrent ce qui est calculable : l'arithmétique des échéances et des
préavis, la validation et la réécriture de la configuration, la résolution des
gabarits et le remplissage effectif d'un PDF. Le formulaire de test est
**fabriqué à l'exécution** — ce dépôt ne versionne aucun binaire, et un Cerfa
vierge en est un.

Seul PyMuPDF est nécessaire au code écrit à ce jour ; il est déjà installé dans
une session distante par le hook du dépôt, pour la chaîne pré-presse KDP.

## Prochaine étape

`core/abonnements.py` : le tableau de bord et le calcul des alertes. Tout ce
dont il a besoin — échéance reconduite, date de préavis, mois restants — est
déjà écrit et vérifié dans `core/modele.py`.
