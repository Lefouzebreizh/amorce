# Une suite verte chez son auteur que le lanceur du dépôt ne sait pas lancer

08/09/2026 — mesuré en cherchant pourquoi « Tests Python » est rouge sur `main`.

## Les deux façons de lancer la même suite

```bash
python3 -m unittest discover -s moteur-administratif/tests -t moteur-administratif
#   Ran 90 tests — OK

python3 -m unittest discover -s moteur-administratif/tests
#   ModuleNotFoundError: No module named 'moteur_administratif' — 6 erreurs
```

**C'est la seconde que le dépôt exécute.** `.github/workflows/tests-python.yml`
découvre les suites par `find -maxdepth 3 -type d -name tests` et lance chacune
par `python -m unittest discover -s "$tests"`, **sans `-t`** : la racine
d'importation devient le dossier `tests/` lui-même, et le paquet du projet
n'est plus sur le chemin.

Douze autres projets Python du dépôt passent par ce même lanceur sans rien
demander. La convention existe donc, elle n'est simplement écrite nulle part —
et un projet neuf peut arriver avec quatre-vingt-dix tests verts **chez son
auteur** et six erreurs chez tout le monde.

## Ce que ça dit au-delà du cas

**Une suite de tests n'est verte que sous la commande qui la lance vraiment.**
« Mes tests passent » n'est pas une propriété de la suite : c'est une propriété
du couple suite + invocation. Un projet ajouté à un dépôt partagé se vérifie
donc avec **la commande du dépôt**, pas avec celle qu'on tape à la main dans son
dossier.

Le lanceur est lisible en trois lignes dans le workflow, et le rejouer
localement — la même boucle `find`, la même invocation — nomme la suite fautive
en moins d'une minute.

## Le second rouge du même jour, et il est plus retors

`life-organizer/tests/test_plafond_opencv.py` échoue parce qu'OpenCV **5.0.0.93**
est installé, alors que la branche 5 retire `CascadeClassifier`. Le test fait
exactement son travail et dit quoi faire.

Sauf que **l'épingle existe déjà** : `.github/requirements-tests.txt` porte
`opencv-python-headless<5`, et un `pip install --dry-run` sur ce fichier retient
bien **4.14.0.94**. La contrainte est donc écrite au bon endroit, résolue
correctement — et l'environnement porte quand même la 5.0.0.93.

C'est le cas le plus coûteux à diagnostiquer : **une épingle écrite et non
honorée**, parce que quiconque ouvre le fichier conclut que le sujet est traité.
Une épingle se vérifie sur la version **installée**, jamais sur la ligne qui la
demande.
