# Life-Organizer — assistant personnel de rangement

Nettoyer, trier, convertir et extraire les données des fichiers personnels —
documents administratifs, photos, vidéos — pour libérer de l'espace disque et
la charge mentale qui va avec.

**Tout s'exécute sur la machine.** Aucun fichier ne part sur le réseau, sauf si
une clé d'API est explicitement renseignée pour l'OCR ou l'agrandissement (deux
options désactivées par défaut).

> État : squelette d'architecture. `organizer_config.json` est complet et
> validé ; les six modules sont décrits ci-dessous mais pas encore écrits.

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
| 6 | `classement` | tout ce qui précède | `Photos/2026/08 - Août/`, `Documents/Administratif/Impôts/2026/` |

Le module 1 alimente le 2 (une facture scannée devient une échéance) et le 6
(un type détecté devient un dossier). Le 3 précède le 4, qui précède le 5 :
inutile de convertir puis d'agrandir une photo floue qu'on allait jeter.

## Installation et vérification

```bash
cd life-organizer

# 1. Le squelette est-il complet et la configuration lisible ?
python3 - <<'PY'
import json, pathlib
attendus = ["noyau", "modules/scan_ocr", "modules/calendrier", "modules/nettoyage",
            "modules/conversion", "modules/upscale", "modules/classement", "tests"]
manquants = [d for d in attendus if not pathlib.Path(d).is_dir()]
print("Dossiers manquants :", manquants or "aucun")
config = json.load(open("organizer_config.json"))
print("Configuration lue :", len(config), "sections —", ", ".join(config))
PY

# 2. Les dépendances (une fois les modules écrits)
pip install -r requirements.txt

# 3. Les tests unitaires — logique pure, aucune dépendance externe requise
python3 -m unittest discover -s tests
```

Les outils externes ne sont pas des dépendances Python : `ffmpeg` pour la vidéo
et `tesseract` pour l'OCR s'installent par le gestionnaire de paquets du système.
`noyau/outils_externes.py` les cherche au démarrage et désactive proprement le
module concerné s'ils manquent, plutôt que d'échouer au milieu d'un traitement.

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
| `nettoyage_medias` | seuils de flou, distance de hachage perceptuel, intégrité vidéo |
| `conversion` | règles de format, qualité, gain minimal pour valider un remplacement |
| `upscale` | modèle, facteur, taille source maximale, appareil de calcul |
| `abonnements` | un objet par abonnement : montant, périodicité, préavis, statut |
| `echeances` | paiements datés et leurs rappels |
| `alertes` | canaux, jours de préavis, seuil de hausse de prix, abonnement dormant |
| `resiliation` | expéditeur des lettres, ton, dossier de sortie |

Deux réglages méritent d'être lus avant de lancer quoi que ce soit :

- `scan_ocr.extraction.iban` et `numero_de_securite_sociale` valent `false`. Un
  IBAN reconnu finirait dans un nom de fichier, donc dans une liste de dossier,
  donc dans une capture d'écran.
- `resiliation.envoi_automatique` vaut `false`. Une lettre de résiliation est un
  acte juridique : elle se relit et se signe.
