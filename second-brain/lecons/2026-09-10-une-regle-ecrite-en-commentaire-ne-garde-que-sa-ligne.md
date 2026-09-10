# Une règle écrite en commentaire ne garde que la ligne qu'elle commente

*10/09/2026 — Amorce, reproductibilité du rendu*

## Ce qui a été mesuré

Un contrôle du parcours complet — « le fichier livré n'écrête pas » — tombait
par intermittence. Cinq mesures du **même montage**, rigoureusement identique,
sur cinq tours :

| tour | vrai pic |
| --- | --- |
| 1 | −0,85 dBFS |
| 2 | −0,70 |
| 3 | **−0,41** — sous le seuil, échec |
| 4 | −0,99 |
| 5 | −0,73 |

Un montage déterministe ne devrait rendre qu'un seul nombre. Après correction,
quatre mesures sur deux tours et deux profils : **−0,93 dBFS, quatre fois**.

## La cause, et elle était déjà écrite

`sfx.ts` porte, sur son générateur à graine fixe, ce commentaire :

> *« La réponse impulsionnelle doit être identique d'une exécution à l'autre :
> `Math.random` ferait que la queue de réverbération entendue en
> prévisualisation ne serait pas celle gravée à l'export. »*

La règle est juste, complète, et parfaitement appliquée — **à la réverbération**.
Deux fonctions plus haut, le tampon de bruit blanc qui nourrit *tous* les
bruitages appelait `Math.random`. Et l'étalonnage tirait sa tuile de grain de la
même façon.

Le tampon est mis en cache **par contexte audio**, et l'export en ouvre un neuf :
chaque export gravait donc un bruit différent, et l'aperçu en faisait entendre
encore un autre — exactement ce que le commentaire interdit, à quinze lignes de
lui.

## La règle

**Un commentaire garde la ligne qu'il commente, jamais l'invariant qu'il
énonce.** Il explique, il ne vérifie pas. Une règle formulée au singulier — « la
réponse impulsionnelle doit être… » — se lit comme une note sur *cet* objet,
alors qu'elle vaut pour toute une famille. Le lecteur suivant applique ce qu'il
lit là où il le lit.

Le symptôme est reconnaissable : **le défaut naît d'une incohérence, pas d'un
oubli de principe.** Le principe est là, écrit, respecté quelque part. C'est ce
qui le rend invisible — on le trouve en cherchant, on le rate en relisant, parce
que la relecture tombe sur la version correcte et conclut que tout va bien.

## La parade, et ce dépôt l'avait déjà

Un **garde qui balaye le code source** et une liste d'exceptions déclarées avec
leur raison. Amorce en avait un pour `fetch` — « aucun appel réseau ne s'ajoute
au moteur en silence » — avec trois entrées justifiées. Il en a désormais un
pour `Math.random`, avec une seule : la fabrication d'identifiants, que rien ne
rejoue.

Ce qui distingue ce garde d'un test ordinaire : il ne vérifie pas un
comportement, il vérifie qu'**aucune quatrième occurrence ne s'ajoute**. C'est
la seule forme qui tienne quand le défaut se propage par imitation ou par
distraction, et non par erreur de raisonnement.

D'où la question à se poser en écrivant un commentaire qui commence par « doit
être identique », « ne doit jamais », « il faut toujours » : *est-ce que
j'énonce une règle de famille en la posant sur un seul membre ?* Si oui, elle
mérite un garde, pas un paragraphe.
