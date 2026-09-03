---
name: branche-partagee
description: "Travailler sur une branche pendant que d'autres sessions font avancer `main` — savoir en une commande de combien on a pris du retard, quels commits de la branche sont déjà passés dans `main` par une autre PR, et quoi faire ensuite. À utiliser avant de commencer un lot de travail, avant d'ouvrir une pull request, dès qu'une fusion est refusée pour conflit, dès qu'un « déjà à jour » ou un « 52 commits non poussés » surprend, et dès qu'une PR semble annoncer autre chose que son diff. À utiliser aussi quand on reprend une branche laissée de côté quelques heures : dans un dépôt à plusieurs sessions, quelques heures suffisent à la périmer."
---

# Une branche dans un dépôt à plusieurs sessions

Ce dépôt reçoit plusieurs sessions en parallèle. `CLAUDE.md` en tire déjà la
règle : *partir de `main` à jour, et le revérifier avant d'ouvrir*. Ce qui suit
est la mécanique, apprise en s'y cognant.

```bash
bash .claude/skills/branche-partagee/scripts/etat-branche.sh
```

Retard, avance, arbre propre ou non, **quels commits sont déjà dans `main`**, et
la commande suivante. Rien n'est modifié.

## Les trois moments où on le lance

**Avant de commencer un lot.** Une branche laissée trois heures est périmée :
chaque commit de retard est un conflit potentiel de plus, et ils ne se
résolvent pas plus facilement en attendant.

**Avant d'ouvrir une PR.** C'est là que se joue la surprise coûteuse : une autre
session peut avoir emporté vos commits dans sa propre PR. Le script le dit
commit par commit. Une PR dont la description annonce ce qu'on a fait, alors que
son diff ne contient qu'un tiers, laisse une trace fausse dans l'historique —
**décrire d'après le diff réel**, quitte à réécrire titre et corps avant de
fusionner.

**Après une fusion.** Réaligner la branche sur `main` fusionné évite que le lot
suivant reparte d'une base déjà dépassée, et que le contrôle de fin de session
signale des commits « non poussés » qui ne sont que `main` rapatrié.

## Rapatrier, et rien d'autre

```bash
git merge --ff-only origin/main   # aucun commit propre : avance rapide, sans risque
git merge origin/main             # sinon : commit de fusion, comme le reste de l'historique
```

**Jamais de rebase, jamais de force sur une branche que quelqu'un d'autre peut
avoir récupérée.** Un commit de fusion garde tous les clones valides ; une
histoire réécrite les casse en silence. La seule force acceptable est un
`--force-with-lease` sur une branche à soi qui ne contient que de l'histoire
déjà fusionnée.

## Les conflits d'ici sont presque tous additifs

Ce dépôt est fait de projets sans code commun : deux sessions ne modifient
presque jamais la même logique. Elles se croisent sur **les fichiers qui
connaissent tout le monde** — le hook de démarrage, `CLAUDE.md`, `INDEX.md`, les
tableaux de compétences.

La résolution y est presque toujours la même : **garder les deux apports**. Une
ligne d'accueil enrichie par l'autre session et un bloc ajouté par la vôtre ne
s'excluent pas ; les fusionner prend dix secondes, en choisir un fait disparaître
du travail sans que personne ne s'en aperçoive.

Quand le conflit porte vraiment sur la même logique — et cela arrive — la règle
de `CLAUDE.md` tranche : **ce qui est fusionné gagne**. Se couler dans la base
commune coûte moins cher que réconcilier deux architectures. Deux branches ont
déjà construit Life-Organizer chacune de leur côté ; la seconde a été refaite.

## Quand ça conflicte pour de bon

`etat-branche.sh` diagnostique sans rien modifier ; quand il faut y aller :

```bash
bash .claude/skills/branche-partagee/scripts/integrer.sh
```

Il fusionne et **classe** les conflits en deux tas — les listes de la racine,
additives, et le reste, qui demande un jugement — puis affiche les blocs côte à
côte pour éviter d'ouvrir chaque fichier. Il ne résout rien, volontairement :
garder les deux apports est mécanique, mais la phrase qui les introduit ne se
fusionne pas. Résoudre à l'aveugle publie un « neuf projets » suivi de dix
éléments, une erreur qui survit des mois parce qu'elle a l'air relue.

Les fichiers qui se télescopent, et ce qu'il faut y regarder :

| Fichier | Le piège |
| --- | --- |
| `CLAUDE.md` | Le **compte** en gras se recalcule sur la liste résolue, il ne se fusionne pas |
| `.gitignore` | Aucun : coller les deux blocs |
| `.claude/hooks/session-start.sh` | Deux étapes ajoutées au même endroit : garder les deux, l'ordre est libre |
| `second-brain/lecons.md` | Aucun : deux leçons ajoutées à la fin, garder les deux. `preflight.py` le compte parmi les carrefours, la table l'oubliait |
| `.claude/skills/verifier/SKILL.md` | Son préambule ne compte plus les projets, exprès : ne pas réintroduire un nombre |
| `.github/requirements-tests.txt` | Ne jamais y recopier la liste du hook — voir l'en-tête du fichier |

## « Cette branche a-t-elle encore du travail ? » — le seul test qui réponde

La question se pose à chaque inventaire de branches, et **les trois façons
évidentes d'y répondre sont fausses**. Mesuré le 28/08/2026 sur les 78 branches
`claude/*` du distant : deux estimations successives, deux chiffres faux
annoncés avec assurance, avant d'y arriver.

| Ce qu'on essaie | Ce que ça mesure vraiment |
| --- | --- |
| `git log main..BRANCHE` | Des commits, pas du contenu. Une branche **fusionnée en squash** garde tous les siens : elle affiche « 4 commits d'avance » alors qu'elle n'apporte rien |
| `git diff main...BRANCHE` | Part de la **base de fusion**, donc affiche encore le travail d'une branche déjà livrée. C'est le piège le plus coûteux : le diff est plein, et il est vide de sens |
| `git diff main..BRANCHE` | Mélange l'avance et le **retard** : une branche de 500 commits en arrière annonce 500 fichiers « différents » |
| `git cherry` | Compare des empreintes de patch, qu'un squash change toutes |

Le seul test exact est celui-ci : **la fusion changerait-elle l'arbre de
`main` ?**

```bash
git merge-tree --write-tree origin/main origin/claude/BRANCHE | head -1
# ce SHA d'arbre égale `git rev-parse origin/main^{tree}` → la branche n'apporte rien
```

**Et son verdict positif n'est pas un quitus.** « La fusion changerait l'arbre »
répond à *ce que la fusion ferait*, jamais à *y a-t-il du travail à sauver* — et
sur une branche ancienne les deux divergent. Mesuré le 02/09/2026 sur les 209
branches jamais fusionnées : vingt-deux changeraient l'arbre, et pas une ne
portait de travail perdu. Ce qu'elles apportent est une **ancienne version** d'un
code que `main` a corrigé depuis, exactement le cas décrit plus bas pour les
conflits — sauf qu'ici rien ne conflicte, donc rien n'alerte.

Le test mécanique borne donc la recherche ; il ne la conclut pas. Ce qui
conclut, c'est d'ouvrir le fichier : les cinq branches IPTV du lot annonçaient
un correctif d'ordre des index, et il était déjà dans `main`, son commentaire
d'origine compris.

En conflit, `merge-tree` ne rend pas d'arbre : il faut alors fusionner
réellement dans un worktree jetable, résoudre, puis comparer.

```bash
git worktree add -q --detach /tmp/essai origin/claude/BRANCHE
cd /tmp/essai && git merge origin/main --no-edit   # résoudre, puis :
git diff --name-only origin/main HEAD              # vide → rien à livrer
```

**Et c'est le cas le plus fréquent, pas le cas rare.** Sur les neuf branches en
conflit ce jour-là, **les neuf** rendaient un arbre identique à `main` une fois
résolues. Leur « conflit » n'était pas du travail en attente : c'était une
**ancienne version** d'un code que `main` avait depuis corrigé. Fusionner leur
côté aurait réintroduit les défauts corrigés.

D'où la règle : une branche en conflit n'est pas une branche à sauver tant
qu'on n'a pas mesuré ce qu'elle apporte. Sur 78 branches, 68 étaient des
références mortes et aucune ne portait de travail perdu.

## Ce qui a déjà été déminé

Deux aimants à conflits ont été retirés — inutile de les recréer :

- **La ligne d'accueil du hook** ne s'écrit plus d'un bloc. Les commandes sont
  déclarées dans un tableau `commandes=(…)`, une ligne par projet, et la ligne
  se compose à la fin. Avant, c'était plus de mille caractères sur une seule
  ligne que tout nouveau projet devait modifier : un conflit garanti par projet
  ajouté, sur un fichier que toutes les branches touchent.
- **Le décompte de projets de `CLAUDE.md`** a disparu de sa phrase
  d'introduction. Il est passé de « cinq » à « onze » en quelques semaines, se
  trompait entre-temps, et forçait une retouche de la même ligne à chaque
  arrivée. L'énumération qui suit dit la même chose sans se périmer.

Si un conflit se répète au même endroit, chercher cette forme-là : **une ligne
unique que tout le monde doit modifier**. La découper vaut mieux que documenter
comment la résoudre.

## La course qu'on perd en fusionnant

`main` peut bouger **entre** la dernière intégration et l'appel à la fusion.
GitHub répond alors `405 Pull Request has merge conflicts`. Ce n'est pas une
panne, et réessayer ne sert à rien : réintégrer, résoudre, pousser, refusionner.
Trois tours d'affilée sont un déroulement normal ici.

Le raccourci qui économise un tour : intégrer **juste avant d'appeler la
fusion**, et non juste avant d'ouvrir la PR — l'ouverture, elle, ne coûte rien
à refaire.

## Fusionner par lots courts

Le vrai remède n'est pas de mieux résoudre les conflits, c'est d'en avoir moins.
Une branche qui vit une nuit entière accumule les divergences ; trois PR de
trois commits en accumulent trois fois moins qu'une PR de neuf, et chacune se
relit.

Si l'accord d'ouvrir et de fusionner soi-même les PR a été donné, il n'y a
aucune raison d'attendre : fusionner dès qu'un lot tient debout et que la
barrière de vérification du projet touché est franchie.
