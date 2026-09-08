# Moteur administratif

Moteur partagé pour une famille de produits personnels — Le Coffre, Le Dossier,
Le Recours, Le Classeur, La Relève — chacun développé dans son propre dépôt et
sa propre conversation. Ce dépôt ne contient **aucune règle métier d'aucun
produit** : il fournit quatre briques indépendantes, appelables séparément,
chacune configurée par ce que le produit appelant lui fournit.

## Les quatre briques

| Brique | Dossier | Ce qu'elle fait | État |
| --- | --- | --- | --- |
| 1. Lecture | `moteur_administratif/lecture/` | Un document photographié devient du texte (natif ou OCR local), puis des champs structurés (nature, dates, montants, émetteur). | Fonctionnel. |
| 2. Règles de délais | `moteur_administratif/regles_delais/` | Pour un type de document et une table de règles fournie par l'appelant, calcule une échéance et la démarche associée. | Fonctionnel. |
| 3. Rédaction | `moteur_administratif/redaction/` | Un gabarit + des champs → un écrit prêt à signer, avec contrôle des mentions obligatoires. Remplissage de PDF à champs (Cerfa) ou plat, mise en page d'une lettre A4. | Fonctionnel. |
| 4. Rappels | `moteur_administratif/rappels/` | Une liste de rappels devient un fichier `.ics` que l'agenda du téléphone reprend. | Fonctionnel, sans dépendance. |

Les quatre briques sont fonctionnelles et testées (90 tests, `python -m unittest
discover -s tests -v`) au 03/09/2026. Ce qui reste hors de leur périmètre —
volontairement — est décrit dans « Ce que ce moteur ne fait pas », plus bas.

## D'où vient ce qui est écrit ici

Ce moteur n'est pas parti de rien : `paper-manager` et `life-organizer`
(`C:\Users\erwan\amorce-main\`) avaient chacun, indépendamment, construit une
bonne partie des quatre briques, pour leur propre usage. L'inventaire complet
et les décisions d'architecture ont été faits le 03/09/2026 ; en résumé :

- **Lecture** : `paper-manager/core/extraction.py` a la confiance par champ
  (« étiqueté » pèse plus que « deviné ») et les pièges des documents
  administratifs français (espaces insécables dans les montants, dates
  JJ/MM/AAAA) ; `life-organizer/modules/scan_ocr/traitement.py` a l'OCR local
  Tesseract, hors réseau, choisi ici comme chemin par défaut — **jamais de
  modèle de vision dans cette brique**, décidé le 03/09/2026. Un produit qui a
  vraiment besoin d'un chemin par modèle l'ajoute lui-même.
- **Règles de délais** : n'existait nulle part sous forme générique. La
  mécanique de dates (report d'une période dépassée, calcul à rebours d'une
  échéance) s'inspire de `life-organizer/modules/calendrier/regles.py` et de
  `paper-manager/core/resiliation.py`, mais la règle elle-même est ici une
  donnée (`Regle`), pas du code.
- **Rédaction** : la résolution de gabarit (`{identite.nom}`, `{@aujourdhui:%Y}`)
  et le remplissage de PDF (Cerfa à champs, PDF plat par coordonnées) viennent
  de `paper-manager/core/formulaires.py` ; la mise en page d'une lettre A4 de
  `paper-manager/core/resiliation.py::rendre_pdf`, généralisée pour ne plus
  dépendre d'un abonnement ou d'une identité typés.
- **Rappels** : repris quasi tel quel de `paper-manager/core/calendrier.py`,
  le plus abouti des deux versions trouvées (celui de `life-organizer` fait la
  même chose, en moins testé — mis de côté plutôt que porté en double).

## Ce que ce moteur ne fait pas, et pourquoi

- **Pas de règle métier.** Aucun type de document, aucun gabarit de lettre,
  aucun mot-clé de reconnaissance n'est écrit ici. Chaque brique reçoit sa
  configuration en paramètre — table de règles JSON, gabarits sur disque,
  barème de confiance — fournie par le produit appelant.
- **Pas de réseau par défaut.** La lecture ne sort jamais sur le réseau : texte
  natif d'un PDF, sinon OCR local. Aucune brique n'envoie quoi que ce soit —
  la rédaction produit un écrit à relire et à signer, jamais à expédier.
- **Pas de base de données.** Le moteur est une bibliothèque de fonctions
  pures et de quelques fonctions d'entrée-sortie ; l'état (documents lus,
  alertes en cours, historique) reste au produit appelant.

## Installation par un produit consommateur

```bash
pip install -e C:/Users/erwan/moteur-administratif
```

Édition immédiatement visible par tous les produits qui l'ont installé ainsi,
sans republier de paquet.

## Vérifier

```bash
python -m unittest discover -s tests -v
```

## Convention interne à chaque brique

- `modele.py` — les dataclasses échangées. Immuables quand rien ne les modifie
  après coup.
- `regles.py` — les fonctions **pures** : aucune entrée-sortie, vérifiables
  sans rien installer.
- `traitement.py` — les fonctions **impures** : lecture de fichier, appel à un
  outil externe (Tesseract), écriture disque.

Un module qui n'a rien d'impur (aujourd'hui : `regles_delais`, pour la partie
calcul) n'a pas de `traitement.py` réduit à rien pour la forme — mais en a
quand même un ici, pour le chargement de la table de règles, qui est bien une
entrée-sortie.
