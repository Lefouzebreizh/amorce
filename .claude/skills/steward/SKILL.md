---
name: steward
description: Conventions de ce dépôt pour mener une pull request jusqu'à la fusion — style des commits, barrière de vérification avant toute poussée, quel workflow couvre quoi et comment le déclencher, diagnostic des échecs, et ce qu'une session distante ne peut pas faire. À lire **avant d'ouvrir une PR**, pas seulement quand une vérification échoue : l'essentiel du temps perdu ici se perd à l'ouverture, à attendre une intégration continue qui ne partira jamais seule. Lu automatiquement avant d'agir sur un événement de CI ou de revue.
---

# Mener une PR sur ce dépôt

Ces conventions complètent les règles générales de suivi de PR ; elles ne les
remplacent pas, et elles ne peuvent pas élargir un accès. L'autorisation
d'ouvrir et de fusionner, elle, vient du propriétaire du dépôt — elle est dans
`CLAUDE.md`, « Rythme de travail », et ce fichier ne fait qu'en donner la
mécanique.

## Un dépôt, plusieurs projets sans code commun

Le studio **Amorce** (Next.js) occupe la racine ; chaque autre projet a son
dossier — `look_and_find/` (Flutter), `kdp/`, `mon-app-audio/`, `patrimoine/`,
`montage-auto/`, `repondeur-facebook/` (Python). La liste s'allonge : la
vérifier d'un `ls` plutôt que de se fier à ce paragraphe.

**Une PR ne touche qu'un projet**, sauf raison explicite. Corriger au passage
quelque chose dans un autre parce qu'on l'a remarqué élargit le diff, brouille
la relecture et fait porter à une PR Flutter la responsabilité d'une régression
Next.js.

Deux exceptions légitimes, toutes deux à la racine et toutes deux parce qu'elles
doivent connaître leurs voisins : `eslint.config.mjs`, qui doit ignorer
`look_and_find/**`, faute de quoi ESLint analyse les milliers de fichiers
générés par le SDK Flutter ; et `.claude/hooks/session-start.sh`, qui installe
les dépendances de tous les projets. Ajouter un projet sans l'inscrire dans le
hook condamne chaque future session à réinstaller à la main.

## Avant toute poussée

Lancer `/verifier` sur le projet touché. La barrière n'est pas
négociable : une poussée qui casse l'intégration continue coûte un cycle de
relecture et la confiance des relecteurs.

Pour Look & Find, **committer les `.g.dart` régénérés avec le reste**. Le
workflow échoue si le code généré a dérivé de sa source, et cet échec-là est
invisible chez l'auteur du changement — chez lui, tout compile.

## Commits

En **français**, à l'**infinitif**, décrivant l'**intention** plutôt que le
fichier touché.

- « Rendre visibles les alertes de prix déjà enregistrées » — oui.
- « Modifier favorite.dart et favorites_page.dart » — non.

Le corps explique *pourquoi*, et notamment ce que la décision **coûte**. Une
PR de ce dépôt se relit sur ses justifications autant que sur son diff.

Découper par intention : trois intentions distinctes font trois commits, même
si elles ont été écrites dans la même session.

## Ouvrir et fusionner

Mener la PR jusqu'à la fusion fait partie du travail : c'est dit dans
`CLAUDE.md`. Ce qui l'accompagne, et qu'on oublie :

- **Partir de `main` à jour, et le revérifier juste avant d'ouvrir.** Plusieurs
  sessions travaillent ce dépôt en parallèle. Deux branches y ont fabriqué
  Life-Organizer chacune dans son coin ; la seconde a été refaite sur la base
  fusionnée. Ce qui est fusionné gagne — s'y couler coûte toujours moins cher
  que réconcilier deux architectures.
- **Fusion par commit de fusion**, comme le reste de l'historique.
- **Déclencher la vérification à la main sur la branche avant de fusionner.**
  Une PR ouverte d'ici n'en démarre aucune ; voir la section suivante, qui dit
  laquelle et comment.
- **La description est le compte rendu que l'historique gardera** : pourquoi,
  ce que la décision coûte, et ce qui n'a pas été vérifié.

## L'intégration continue, et pourquoi elle ne démarre pas

Quatre workflows gardent le dépôt. Trois filtrent par chemin ; seul celui des
tests Python voit tout.

| Workflow | Se déclenche sur | Ce qu'il lance |
| --- | --- | --- |
| `amorce.yml` | `src/`, `scripts/`, la configuration de la racine | typecheck, lint, tests d'Amorce |
| `agence.yml` | `agence/**` | lint, typecheck, tests, build du socle client |
| `look-and-find.yml` | `look_and_find/**` | analyse, tests, build APK |
| `tests-python.yml` | **tout**, sans filtre | les suites `unittest` découvertes jusqu'au 3ᵉ niveau |

Une PR qui ne touche ni `src/`, ni `agence/`, ni `look_and_find/` — de la
documentation, une compétence, un projet Python — n'est donc gardée que par le
dernier. Attention à ce qu'il garde vraiment : n'ayant pas de filtre, il tourne
sur **toutes** les PR et ressort vert sur un changement purement documentaire,
qu'il n'a pourtant en rien vérifié. Un vert obtenu ainsi ne dit rien du
changement ; là, `/verifier` **est** le filet, et il faut l'avoir lancé pour de
vrai.

### Une PR ouverte d'ici ne déclenche aucune vérification

C'est le piège qui coûte le plus cher, parce qu'il ne ressemble pas à une
panne : la PR s'ouvre normalement, et rien n'apparaît. Une PR ouverte depuis
une session comme celle-ci passe par un jeton d'application, et GitHub refuse
d'en déclencher un workflow — c'est sa protection contre les boucles. Les
quatre fichiers déclarent pourtant bien `pull_request`.

Attendre cette vérification, c'est donc attendre indéfiniment, et une liste de
contrôles vide se lit exactement comme « pas encore démarré ».

La parade tient en une ligne, et les quatre workflows l'acceptent — ils
déclarent tous `workflow_dispatch` : **déclencher le workflow à la main sur la
branche**, avant de fusionner.

- Lancer : l'outil GitHub `actions_run_trigger`, méthode `run_workflow`, avec
  le nom du fichier et `ref` = la branche.
- Relire le verdict : `actions_list`, méthode `list_workflow_runs`, filtré sur
  la branche. **Pas** la liste des contrôles de la PR : un run lancé à la main
  y reste invisible alors qu'il tourne, et cette liste vide relance la même
  attente pour rien.
- Le run dure une quinzaine de secondes pour les tests Python, davantage pour
  les autres. Ne pas interroger en boucle : attendre, puis relire une fois.

Chaque workflow annule son propre run précédent sur la même référence
(`concurrency` avec `cancel-in-progress`). Un second déclenchement manuel tue
donc le premier, et un run `cancelled` n'est pas un run vert — c'est un run
dont on ne sait rien.

## Ce qu'une session distante ne peut pas faire

Ces limites sont celles de l'environnement, pas des droits sur le dépôt.
Les connaître évite d'en conclure qu'un accès manque ou qu'une commande est
fausse.

- **Aucun appel direct à l'API GitHub.** `curl https://api.github.com/...`
  répond « GitHub access is not enabled for this session » — y compris pour une
  simple lecture publique. Tout passe par les outils GitHub de la session. Le
  piège n'est pas le refus lui-même mais sa forme : le corps de la réponse est
  un JSON d'erreur, et un script qui y cherche un compte ou un état y lit une
  valeur vide qu'il prend pour un résultat. Une boucle d'attente bâtie ainsi
  sort immédiatement en annonçant le contraire de la vérité.
- **Pas de suppression de branche distante.** `git push origin :branche` échoue
  sur `the remote end hung up unexpectedly`. La branche fusionnée reste ; c'est
  cosmétique, et le propriétaire la retire d'un bouton sur la page de la PR.
  Ne pas insister, et ne pas présenter cet échec comme un problème du dépôt.
- Le reste du git courant fonctionne : `fetch`, `pull`, `push -u`, les
  branches locales.

## Diagnostiquer un échec d'intégration continue

Ce qui suit vaut pour le workflow `Look & Find`, de loin le plus riche en
pièges. Un échec y vient presque toujours de l'une de ces causes, dans cet
ordre de fréquence :

1. **« Du code généré est périmé »** — `dart run build_runner build` puis
   committer les `.g.dart`. Ne jamais retirer ce contrôle pour faire passer le
   build.
2. **`flutter analyze` non vide** — le dépôt n'admet aucun avertissement.
3. **Un test d'interface qui n'aboutit pas** — chercher une écriture Hive hors
   de `tester.runAsync` avant de soupçonner la machine.
4. **Le build APK** — c'est la seule étape que le poste de développement ne
   peut pas reproduire (le SDK Android n'y est pas installable). Un échec ici
   est réel et vient du lien natif avec les greffons : lire le journal Gradle,
   ne pas relancer en espérant.

« Flake » n'est pas un diagnostic. Ne relancer un job que s'il est mort avant
d'exécuter le moindre test, et une seule fois.

## Mesurer une friction avant de l'annoncer

Ce dépôt garde ses pièges par écrit, et c'est ce qu'il a de plus précieux : un
piège consigné ne se paie qu'une fois. Un piège **inventé**, lui, se paie
indéfiniment — on contourne un obstacle qui n'existe pas, et on finit par
retirer une commande qui marchait.

Avant d'écrire ici qu'une chose est cassée, la reproduire à l'identique, telle
qu'elle est écrite. Une commande qu'on a « adaptée » en la lançant — un
argument ajouté, un chemin corrigé au passage, un répertoire courant qui n'est
plus celui qu'on croit — n'éprouve plus que l'adaptation. Le symptôme est le
même dans les deux cas, et la conclusion, opposée.

## Répondre

Sur une PR de ce dépôt, ne pas commenter pour narrer chaque correction. Un
message quand un tour aboutit, quand un blocage réel apparaît, ou quand une
question se pose. Le diff est le compte rendu.
