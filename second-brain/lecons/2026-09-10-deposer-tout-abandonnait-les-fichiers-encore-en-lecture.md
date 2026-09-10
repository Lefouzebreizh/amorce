# « Déposer tout » abandonnait les fichiers encore en lecture

**Projet** : `le-coffre/` (Le Tiroir Secret).

## Ce qui a été mesuré

Le bug signalé par le propriétaire (« le compteur de documents passe à
zéro après un tri automatique ») n'était pas dans le tri automatique. Il
était dans le dépôt en lot qui le précède toujours.

`surDepot()` lance un appel IA de classification (`proposerClassement`,
un par fichier) en parallèle pour tout un lot déposé d'un coup, sans
aucune limite de concurrence. Ces appels se terminent en désordre. Le
bouton « Déposer tout » devient cliquable dès qu'**un seul** fichier a
fini sa lecture (`disabled={enCours || aValider.every(p => p.enAnalyse)}`
— un `every`, pas un `some`). `confirmerTout()` ne faisait qu'**une seule
passe** sur l'instantané des fichiers prêts au moment précis du clic :
tout fichier encore en lecture à cet instant restait coincé dans la liste
d'attente pour de bon, jamais redéposé tout seul.

Reproduit en conditions réelles (compte jetable, sandbox headless) sur un
lot de 35 fichiers : clic sur « Déposer tout » dès qu'il devenait
cliquable → **25 à 34 déposés selon le tirage**, le reste invisible du
compteur. Un tri automatique lancé juste après ne voit évidemment jamais
les fichiers qui n'ont jamais atteint `index.objets`.

## Le piège du seuil « > 1 »

Le même code porte déjà un commentaire daté du 06/09/2026 sur un piège
voisin : la bannière « N papiers en attente » ne s'affiche que si
`aValider.length > 1` — donc elle se tait silencieusement quand il ne
reste plus qu'un seul fichier bloqué. Un premier jet de test de
vérification s'est fait piéger par exactement ça : une boucle d'attente
qui ne guette que cette bannière conclut à tort que le dépôt est terminé
quand il ne reste qu'un fichier stagnant.

## Le correctif, et son propre piège

`confirmerTout()` boucle désormais sur un miroir à jour de la liste
d'attente (`aValiderRef`, synchronisé par un effet) jusqu'à ce qu'il n'y
ait plus rien à déposer ni rien en lecture, au lieu d'une seule passe.

Premier jet du correctif : boucle infinie. Un fichier dont le dépôt
échoue reste dans `aValider` (il n'est retiré qu'au succès), donc il
réapparaît dans `prets` à chaque tour et se fait retenter indéfiniment —
`enCours` ne redescend jamais, aucune bannière d'erreur ne sort, la
fonction ne rend jamais la main. Il a fallu un `Set` des clés déjà en
échec, exclu des tours suivants, pour retrouver le comportement d'origine
sur un échec (signalé une fois) sans perdre l'attente sur les fichiers
réellement encore en lecture.

## Ce qui aurait pu faire manquer ce bug une troisième fois

`page.innerText('body')` reflète le `text-transform: uppercase` du CSS :
« Vos papiers (N) » sort en `VOS PAPIERS (N)`. Une recherche de texte
insensible à la casse est obligatoire dans tout script de vérification
qui lit ce compteur — déjà noté une fois dans ce dépôt, reconfirmé ici.
