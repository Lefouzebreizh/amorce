# Life-Organizer — assistant personnel de rangement

Nettoyer, trier, convertir et extraire les données des fichiers personnels —
documents administratifs, photos, vidéos — pour libérer de l'espace disque et
la charge mentale qui va avec.

**Tout s'exécute sur la machine.** Aucun fichier ne part sur le réseau, sauf si
une clé d'API est explicitement renseignée pour l'OCR ou l'agrandissement (deux
options désactivées par défaut).

> État : squelette d'architecture. `organizer_config.json` est complet et
> validé ; les six modules sont décrits ci-dessous. Trois sont écrits :
> `nettoyage`, complet — photos floues, quasi-doublons puis vidéos abîmées
> (`organizer nettoyer`) —, `classement`, qui range documents, photos et
> vidéos par thème et par date (`organizer ranger`), et `conversion`, qui
> repasse les HEIC en JPG et les MKV en MP4 (`organizer convertir`).

## Arborescence

```
life-organizer/
├── organizer.py              point d'entrée unique : une sous-commande par module
├── organizer_config.json     modèle de configuration (celui-ci, versionné)
├── requirements.txt
├── noyau/                    ce que les six modules partagent
│   ├── config.py             lecture, validation et écriture de la configuration
│   ├── modele.py             types communs (Fiche, Document, Media, Doublon…)
│   ├── fichiers.py           parcours, empreintes, quarantaine, déplacements sûrs
│   ├── journal.py            trace des opérations et mode simulation
│   └── outils_externes.py    localisation de ffmpeg / tesseract, repli s'ils manquent
├── modules/
│   ├── scan_ocr/             1. extraction du texte des documents, renommage
│   ├── calendrier/           2. échéances, abonnements, lettres de résiliation
│   ├── nettoyage/            3. photos floues, doublons, vidéos abîmées
│   ├── conversion/           4. HEIC→JPG, MKV→MP4, compression
│   ├── upscale/              5. agrandissement des vieilles photos et vidéos
│   └── classement/           6. rangement par date, par type, par thème
├── donnees/                  état local (empreintes, index) — non versionné
└── tests/                    tests unitaires, sans dépendance externe
```

Chaque module suit la même découpe en trois fichiers :

| Fichier | Contenu | Testé ? |
| --- | --- | --- |
| `regles.py` | La décision, en fonctions **pures** : ce fichier est-il flou, où doit-il aller, comment doit-il s'appeler. Aucune entrée-sortie, aucune dépendance lourde. | oui, `python3 -m unittest` |
| `traitement.py` | Ce qui touche au disque et aux bibliothèques lourdes (OpenCV, FFmpeg, Pillow). Applique la décision, ne la prend pas. | à la main |
| `commande.py` | Le branchement sur la ligne de commande : arguments, affichage, code de sortie. | à la main |

## Les cinq décisions qui structurent le projet

**1. La décision est séparée du geste.** « Cette photo est floue » et « supprimer
cette photo » sont deux fonctions différentes, dans deux fichiers différents.
C'est ce qui rend le projet testable : un seuil de netteté se vérifie sur des
nombres, sans décoder une seule image ni installer OpenCV.

**2. Les bibliothèques lourdes s'importent au moment de servir.** OpenCV, FFmpeg
et les modèles d'agrandissement pèsent des centaines de mégaoctets. Un
`import cv2` en tête de fichier ferait payer trois secondes de démarrage à
`life-organizer abonnements`, qui ne lit qu'un JSON. Les imports vivent dans le
corps des fonctions de `traitement.py`.

**3. On met en quarantaine, on ne supprime pas.** `securite.suppression_directe`
vaut `false` et `simulation_par_defaut` vaut `true` : par défaut, une commande
dit ce qu'elle ferait et ne fait rien. Ce qui est écarté part dans un dossier de
quarantaine daté, purgé après trente jours. Un outil qui range des souvenirs de
famille n'a pas droit à un faux positif définitif.

**4. Une seule source de vérité pour les réglages.** `organizer_config.json`
porte à la fois les paramètres de tri, le suivi des abonnements et les alertes.
Un seuil ne se code jamais en dur : s'il mérite d'être réglé, il est dans le
fichier ; sinon il est dans `regles.py` avec le commentaire qui dit pourquoi
cette valeur-là.

**5. Aucun secret dans la configuration.** Les deux blocs qui peuvent sortir sur
le réseau (`scan_ocr.api_vision`, `upscale.api`) ne contiennent qu'un **nom de
variable d'environnement**, jamais une clé. Le fichier de configuration finit
tôt ou tard dans une sauvegarde ou un partage d'écran.

## Les six modules

| # | Module | Entrée | Sortie |
| --- | --- | --- | --- |
| 1 | `scan_ocr` | PDF et images de documents | texte extrait, type, émetteur, date, montant ; fichier renommé `2026-08-25_EDF_facture_84,20.pdf` |
| 2 | `calendrier` | `organizer_config.json` | échéances à venir en console, fichier `.ics`, alerte de renouvellement, lettre de résiliation prête à signer |
| 3 | `nettoyage` | un dossier de photos et vidéos | liste des flous, des quasi-doublons et des vidéos illisibles ; déplacement en quarantaine |
| 4 | `conversion` | photos HEIC/PNG, vidéos MKV/AVI | JPG et MP4, avec le gain d'espace mesuré avant de remplacer quoi que ce soit |
| 5 | `upscale` | photos et vidéos basse définition | version agrandie posée **à côté** de l'originale, jamais à la place |
| 6 | `classement` | tout ce qui précède | `Photos/2024/03 - mars/`, `Documents/Administratif/Impôts/` |

Le module 1 alimente le 2 (une facture scannée devient une échéance) et le 6
(un type détecté devient un dossier). Le 3 précède le 4, qui précède le 5 :
inutile de convertir puis d'agrandir une photo floue qu'on allait jeter.

## Installation et vérification

```bash
cd life-organizer

# 1. La configuration est-elle cohérente ?
python3 organizer.py verifier

# Ce que sait faire chaque module, et lesquels sont écrits
python3 organizer.py --help

# 2. Les dépendances. `nettoyer` a besoin de Pillow, d'ImageHash et d'OpenCV ;
#    `convertir` ajoute pillow-heif pour les HEIC, et ffmpeg pour les vidéos ;
#    les autres modules ajouteront les leurs à mesure qu'ils seront écrits.
pip install -r requirements.txt

# 3. Les tests unitaires — logique pure, aucune dépendance externe requise
python3 -m unittest discover -s tests
```

Les outils externes ne sont pas des dépendances Python : `ffmpeg` pour la vidéo
et `tesseract` pour l'OCR s'installent par le gestionnaire de paquets du système.
`noyau/outils_externes.py` les cherche au démarrage et désactive proprement le
module concerné s'ils manquent, plutôt que d'échouer au milieu d'un traitement.

## Ranger

```bash
python3 organizer.py ranger                      # simulation sur dossiers.entree
python3 organizer.py ranger ~/Téléchargements    # un dossier précis
python3 organizer.py ranger --vers /disque/Photos --appliquer
python3 organizer.py ranger ~/Life-Organizer/Bibliotheque   # reprendre la bibliothèque
```

Ce que la commande décide, et pourquoi :

- **Le thème l'emporte sur la date, pour les documents.** Un avis d'imposition
  se retrouve par son sujet ; personne n'a jamais cherché « le document
  administratif de mars 2024 ». Les photos, elles, se rangent par date — c'est
  la seule chose dont on se souvienne d'un souvenir. Les mots-clés sont dans
  `classement.themes`, et le premier thème de la liste l'emporte : c'est un
  ordre de priorité qu'on maîtrise, là où un score laisserait deviner pourquoi
  la facture d'électricité est partie chez « Banque ».
- **Le motif dit d'où vient la date.** « mars 2024, d'après nom_de_fichier » ou
  « d'après la date de modification, faute de mieux ». Sans cette mention, rien
  ne distingue une photo rangée sur sa vraie date de prise de vue d'une photo
  rangée sur la date où une sauvegarde a été restaurée — et c'est la différence
  entre un souvenir retrouvé et dix ans de souvenirs empilés sous le mois
  courant.
- **Sans date fiable, direction `À dater`** plutôt qu'une année devinée. Trente
  photos dans un dossier « À dater » se traitent en dix minutes ; trente photos
  noyées dans la mauvaise année ne se retrouvent jamais.
- **Une extension inconnue reste où elle est**, et le compte rendu la nomme :
  c'est une ligne à ajouter à `classement.categories`. Déplacer vers un
  fourre-tout ce que la configuration ne sait pas nommer rendrait le rangement
  plus dur qu'avant.
- **La bibliothèque n'est pas parcourue d'office**, même si elle se trouve sous
  un dossier d'entrée : un fichier déjà rangé dont la date d'origine a disparu
  repartirait dans le mois courant, et le rangement déferait son propre
  travail. La nommer en argument reste possible.
- **Le déplacement est vérifié** quand
  `securite.verifier_empreinte_apres_deplacement` vaut `true` : la copie est
  relue et comparée à l'original **avant** que celui-ci ne soit retiré. C'est le
  seul ordre qui protège d'une copie tronquée entre deux disques.

## Convertir

```bash
python3 organizer.py convertir                       # simulation sur dossiers.entree
python3 organizer.py convertir ~/Images --appliquer  # un dossier précis, pour de vrai
python3 organizer.py convertir --seulement photos    # une photo prend une seconde…
python3 organizer.py convertir --seulement videos    # … une vidéo, plusieurs minutes
```

Ce module repasse les HEIC en JPG et les MKV en MP4. Il a besoin de **Pillow**
et **pillow-heif** pour les photos, de **ffmpeg et ffprobe** pour les vidéos ;
ce qui manque est dit avant le premier fichier, pas au millième.

Ce que la commande décide, et pourquoi :

- **Chaque règle dit ce qu'elle achète : de la place, ou un fichier qui
  s'ouvre.** `conversion.regles[].objectif` vaut `espace` ou `compatibilite`, et
  c'est la décision qui fait exister ce module. Un HEIC repassé en JPEG
  **grossit** presque toujours, souvent du simple au double : lui appliquer le
  seuil de gain de 15 % revenait à ne convertir aucune photo d'iPhone tout en
  ayant l'air de marcher. Une règle `espace` doit rendre au moins
  `seuil_gain_minimal_pct` ; une règle `compatibilite` passe quoi qu'il arrive,
  tant qu'elle n'alourdit pas de plus de `inflation_max_pct`.
- **Le gain est mesuré, jamais estimé.** Le fichier est encodé à côté, dans un
  temporaire caché posé sur le même disque ; c'est son poids réel qui décide.
  Une capture d'écran d'aplats, que le PNG comprime déjà très bien, grossit de
  79 % en JPEG — elle est refusée, et le compte rendu le dit dans ces termes.
  Conséquence assumée : **en simulation, rien n'est encodé et aucun gain n'est
  annoncé.** Réencoder une photothèque entière « pour voir » coûterait des
  heures de machine pour un chiffre aussitôt jeté.
- **Un MKV déjà en H.264 est remuxé, pas réencodé.** Ses flux sont recopiés tels
  quels dans un conteneur MP4 : quelques secondes au lieu de plusieurs minutes,
  et pas une image retouchée. C'est la deuxième raison pour laquelle la règle
  vidéo vise la compatibilité — son gain d'espace est nul par construction.
- **L'original ne part en quarantaine qu'après relecture du fichier produit.**
  Une conversion est une perte définitive ; la seule chose qui la rend
  rattrapable est que l'original existe encore. Un encodage interrompu par un
  disque plein produit un fichier d'apparence normale, plus petit que
  l'original, que le seuil de gain accueillerait à bras ouverts.
- **Une entrée abîmée n'est pas convertie.** Mesuré sur un dossier d'essai : une
  vidéo tronquée se remuxe **sans erreur** — ffmpeg recopie ce qu'il trouve et
  rend le code 0. Le MP4 produit est aussi mort que son original, mais il a
  l'air neuf, et l'unique exemplaire d'origine part en quarantaine où la purge
  l'attend à trente jours. La plainte que ffmpeg écrit malgré son code 0 fait
  donc renoncer au fichier, avec le renvoi vers `organizer nettoyer`.

Les sept refus, et ce qu'ils protègent :

| Constat | Geste |
| --- | --- |
| le fichier est déjà au format visé | gardé |
| son format réel est déjà celui visé, malgré son extension | gardé — le convertir le recompresserait une seconde fois |
| il est animé (APNG, GIF) | gardé — la conversion ne garderait que la première image |
| sa transparence est **utilisée** | gardé — le JPEG l'aplatirait sur du noir |
| sa transparence n'a pas pu être mesurée | gardé, par prudence |
| un `.mkv` sans piste vidéo | gardé — c'est un enregistrement sonore |
| des sous-titres image (PGS, VobSub) | gardé — le MP4 ne sait pas les porter, et les perdre en silence serait pire |

Trois points méritent leur explication :

- **La transparence se mesure sur le canal, pas sur le mode de l'image.** La
  moitié des captures d'écran sont en RGBA sans qu'un seul pixel ne soit
  transparent : les refuser sur leur mode écarterait le gros du volume que
  `si_sans_transparence` est censé protéger.
- **Les côtés réduits sont ramenés à un nombre pair**, que libx264 exige — et
  dont l'absence ne se découvre qu'**après** le temps de réencodage.
- **Un fichier refusé est réessayé à chaque exécution.** Une capture d'écran
  dont le gain était insuffisant sera réencodée puis refusée à la suivante. Sur
  des photos c'est une seconde ; sur une vidéo, ce serait à consigner dans
  `donnees/`. Ce n'est pas fait : personne n'en a encore souffert.

## Inspecter les vidéos

La troisième passe de `organizer nettoyer` ne cherche ni une image ratée ni une
image en trop : elle cherche le fichier qui ne s'ouvrira plus le jour où on
voudra le revoir. Elle a besoin de **ffprobe et de ffmpeg**, qui sont un paquet
système et non un paquet Python (`sudo apt install ffmpeg`). Sans eux, la passe
le dit et ne tourne pas — elle ne devine pas.

Ce qu'elle constate, et le geste qui suit :

| Constat | Geste |
| --- | --- |
| ffprobe n'ouvre pas le conteneur, et le fichier est sous `taille_minimale_ko` | quarantaine — « vide ou tronquée » |
| ffprobe n'ouvre pas le conteneur, et le fichier a un poids normal | quarantaine — « illisible », avec le mot exact de l'outil |
| la fin du fichier ne se décode pas | quarantaine — « fin de fichier corrompue » |
| durée sous `duree_minimale_secondes` | quarantaine — « trop courte » |
| aucune piste vidéo (un `.mp4` qui ne porte que du son) | **gardé** et signalé |
| le fichier a été modifié il y a moins de `ignorer_si_modifiee_recemment_minutes` | **gardé**, sans être jugé |

Quatre choix méritent leur explication :

- **Le poids ne condamne jamais seul.** Il ne fait que nommer « vide ou
  tronquée » ce que l'inspection a déjà déclaré illisible. Mesuré sur un vrai
  dossier : un MKV de quatre secondes en 320×240 pèse 20 ko et se lit
  parfaitement — en faisant du poids un critère de plein droit, il partait en
  quarantaine, et son motif masquait au passage le vrai diagnostic des quatre
  fichiers réellement abîmés, tous plus petits que le seuil.
- **Seule la fin du fichier est décodée**, sur trois secondes. C'est là qu'est
  la coupure d'un transfert interrompu, d'une carte mémoire retirée trop tôt ou
  d'une copie sur un disque plein — et c'est le seul symptôme d'un fichier
  tronqué, dont l'en-tête reste intact et continue d'annoncer la durée
  d'origine. **Ce que cela ne voit pas :** une corruption au milieu d'un fichier
  par ailleurs complet. La chercher demanderait de décoder l'intégralité de
  chaque vidéo, soit plusieurs minutes par gigaoctet.
- **Une pochette d'album n'est pas une piste vidéo.** Un fichier sonore avec
  jaquette porte un flux « video » d'une seule image ; le compter ferait passer
  un enregistrement pour une vidéo, et le signalement ne se déclencherait jamais
  sur les fichiers qu'il vise.
- **Un téléchargement en cours ressemble trait pour trait à un fichier
  tronqué** : en-tête complet, fin absente. C'est le seul faux positif que cette
  passe produirait en masse, et il viserait précisément ce que l'utilisateur est
  en train de récupérer — d'où le délai de grâce, réglable.

Une durée absente n'est jamais tenue pour nulle : beaucoup de MKV et tous les
flux enregistrés en direct n'annoncent aucune durée et se lisent très bien.

## Configuration

`organizer_config.json` est le modèle versionné. À l'usage, il se copie et la
copie de travail reste locale :

```bash
cp organizer_config.json ~/.config/life-organizer/config.json
```

| Section | Ce qu'elle règle |
| --- | --- |
| `dossiers` | où chercher, où ranger, où mettre en quarantaine, quoi ignorer |
| `securite` | simulation par défaut, refus de la suppression directe, durée de rétention |
| `classement` | schéma des dossiers, extensions par catégorie, thèmes et leurs mots-clés |
| `scan_ocr` | moteur, langues, seuil de confiance, modèle de nom, champs extraits |
| `nettoyage_medias` | seuils de flou, ressemblance des doublons (voir plus bas), intégrité vidéo |
| `conversion` | règles de format, objectif de chacune, qualité, gain minimal et inflation tolérée |
| `upscale` | modèle, facteur, taille source maximale, appareil de calcul |
| `abonnements` | un objet par abonnement : montant, périodicité, préavis, statut |
| `echeances` | paiements datés et leurs rappels |
| `alertes` | canaux, jours de préavis, seuil de hausse de prix, abonnement dormant |
| `resiliation` | expéditeur des lettres, ton, dossier de sortie |

### Régler la ressemblance des doublons

`nettoyage_medias.doublons.distance_max` dit **à quel point deux photos doivent
se ressembler** pour n'en garder qu'une. Chaque photo est réduite à une empreinte
perceptuelle de 64 bits (pHash) qui décrit l'image et non le fichier : une photo
recadrée, recompressée ou passée par une messagerie garde la même empreinte alors
qu'elle n'a plus un octet en commun avec l'originale. Le réglage est le nombre de
bits qui ont le droit de différer — 0 pour le même rendu exact, 64 pour n'importe
quoi.

| Niveau | Bits | Ce qu'il rapproche |
| --- | --- | --- |
| `identique` | 0 | une copie, un « photo (1).jpg » |
| `stricte` | 2 | la même photo recompressée ou redimensionnée |
| `prudente` | 5 | + un léger recadrage, un filtre — **le défaut** |
| `large` | 10 | + les rafales : plusieurs déclenchements de la même scène |

Le défaut est prudent parce que deux photos d'une rafale ne sont pas des
doublons : on ne veut pas se voir retirer la seule où tout le monde a les yeux
ouverts. Le réglage se change pour de bon dans la configuration, ou le temps
d'une commande :

```bash
python3 organizer.py nettoyer ~/Images            # simulation, seuil configuré
python3 organizer.py nettoyer ~/Images --ressemblance large
python3 organizer.py nettoyer ~/Images --ressemblance 8      # en bits
python3 organizer.py nettoyer ~/Images --ressemblance stricte --appliquer
```

Sans `--appliquer`, la commande dit seulement ce qu'elle ferait. Avec, les
surnuméraires partent dans la quarantaine datée, avec un fichier `origines.jsonl`
qui note d'où venait chacun : rien n'est supprimé, rien n'est irréversible.
Celle qu'on garde est choisie par `conserver` puis `departager_par` — meilleure
définition d'abord, puis poids, puis la plus ancienne, qui est presque toujours
l'originale.

Deux réglages méritent d'être lus avant de lancer quoi que ce soit :

- `scan_ocr.extraction.iban` et `numero_de_securite_sociale` valent `false`. Un
  IBAN reconnu finirait dans un nom de fichier, donc dans une liste de dossier,
  donc dans une capture d'écran.
- `resiliation.envoi_automatique` vaut `false`. Une lettre de résiliation est un
  acte juridique : elle se relit et se signe.
