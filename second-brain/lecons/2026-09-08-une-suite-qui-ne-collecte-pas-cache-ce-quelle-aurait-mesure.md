# Une suite qui ne collecte pas cache ce qu'elle aurait mesuré

08/09/2026 — en réparant « Lancer les suites Python », rouge sur `main` depuis
plusieurs jours.

## Les deux pannes, et l'ordre où elles se révèlent

`moteur-administratif/tests/` porte un `__init__.py` : c'est un **paquet**, et
ses fichiers importent le projet par son nom. `unittest discover -s <dossier>`
pose alors la racine d'import sur `tests/` lui-même :

```
discover -s moteur-administratif/tests            → 6 erreurs, ModuleNotFoundError
discover -s moteur-administratif/tests -t moteur-administratif  → 90 tests, OK
```

Le `-t` posé, la CI a rendu **90 tests et un échec** : `pypdf` manquait à
`.github/requirements-tests.txt`. Cette seconde panne existait depuis le début
et **aucune trace n'en existait nulle part** — la première tombait avant que le
test concerné soit seulement collecté.

D'où la règle, qui vaut au-delà de ce dépôt : **une erreur de collecte n'est pas
un échec de plus, c'est un aveuglement.** Un échec dit qu'une assertion est
fausse ; une erreur de collecte dit qu'on ne sait rien du tout. Compter les deux
dans la même colonne « rouge » fait croire qu'on a une panne quand on en a un
nombre inconnu. Le premier correctif ne se juge donc pas sur « c'est vert
maintenant » mais sur **le nombre de tests qui s'exécutent** : 6 → 90 était le
seul signal disponible, et il disait que le travail n'était pas fini.

## Le correctif ne se pose pas partout, et sa condition est son motif

Premier essai : `-t "$projet"` sur les quatorze suites découvertes. **Treize
sont tombées** — `discover` exige alors que le dossier de départ soit
importable :

```
ImportError: Start directory is not importable: '…/kdp/tests'
```

Un seul dossier `tests/` du dépôt porte un `__init__.py`, et c'est exactement
celui qui a besoin de la racine. La condition écrite dans le workflow
(`[ -f "$tests/__init__.py" ]`) n'est donc pas un garde-fou ajouté après coup :
c'est le besoin lui-même, énoncé en shell.

## Ce qui a coûté le plus de temps : reproduire au mauvais endroit

Deux fois dans la même heure, une mesure locale a désigné la mauvaise cause.

**`life-organizer` était rouge ici et vert sur le runner.** Ce conteneur portait
OpenCV `5.0.0.93` — `Required-by` vide, donc posé hors des quatre endroits où le
dépôt épingle `<5`, et `.github/requirements-tests.txt` résout bien à `4.14.0.94`
en essai à blanc. J'ai rapporté « deux pannes en CI » ; il y en avait une. Le
garde-fou `test_plafond_opencv.py` faisait son travail, et c'est sa lecture qui
était fausse.

**Le moteur était vert ici et rouge là-bas**, pour la raison inverse : le hook
de démarrage installe `pypdf`, pas la CI.

Le geste qui tranche coûte un appel et ne se remplace par aucune reproduction
locale :

```
GET /repos/{owner}/{repo}/check-runs/{id}/annotations
```

Le workflow émet `::error title=<projet>::`, et GitHub le rend en **annotation**.
Trois lignes, le nom du projet fautif, sans télécharger un journal ni dérouler
quoi que ce soit. C'est la source à interroger **avant** de rejouer une suite sur
sa propre machine — une session et un runner n'ont jamais tout à fait le même
environnement, et c'est celui du runner qui décide de la couleur.
