"""Ce qui empêche une bonne stratégie de finir mal.

Le risque n'est pas un module parmi les autres : c'est le seul dont la mission
est de dire non. Il est donc placé **après** la stratégie et **avant**
l'exécution, sans exception possible — le gestionnaire d'ordres n'a pas de
chemin qui le contourne."""
