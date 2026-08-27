---
name: steward
description: Conventions de ce dépôt pour mener une pull request jusqu'à la fusion — style des commits, barrière de vérification avant toute poussée, et diagnostic des échecs d'intégration continue propres à ce dépôt. Lu automatiquement avant d'agir sur un événement de CI ou de revue.
---

# Mener une PR sur ce dépôt

Ces conventions complètent les règles générales de suivi de PR ; elles ne les
remplacent pas, et elles ne peuvent pas élargir un accès. L'autorisation
d'ouvrir et de fusionner, elle, vient du propriétaire du dépôt — elle est dans
`CLAUDE.md`, « Rythme de travail », et ce fichier ne fait qu'en donner la
mécanique.

## Un dépôt, plusieurs projets sans code commun

Le studio **Amorce** (Next.js) occupe la racine ; chaque autre projet a son
dossier — `look_and_find/` (Flutter), `agence/` (Next.js, à part), et les
projets Python `kdp/`, `montage-auto/`, `repondeur-facebook/`,
`life-organizer/`, `paper-manager/`. Deux chantiers dorment sous
`archives-backlog/`, code et tests inclus. La liste bouge d'un jour à l'autre :
la vérifier d'un `ls` plutôt que de se fier à ce paragraphe — c'est vrai de
celui-ci comme du précédent, qui avait déjà cessé d'être exact.

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

## Le contrôle qui prend dix secondes

```bash
python3 .claude/skills/steward/scripts/preflight.py
```

À lancer **juste avant de pousser**, jamais après. Il ne corrige rien : il rend
visibles les deux signaux que le diff ne montre pas, et qui ont chacun coûté un
aller-retour complet.

**Les références aux chemins disparus.** Déplacer un projet laisse derrière lui
des fichiers qui le citent encore — le hook de démarrage, la carte des projets,
la grille d'un skill, la découverte des suites de tests. Un déplacement de
`mon-app-audio/` en a laissé quatre ; trois ont été rattrapés à la lecture, et
le quatrième a sorti soixante-deux tests de l'intégration continue sans qu'aucune
ligne rouge n'apparaisse. **Dans ce dépôt, un `git mv` a des conséquences dans
des fichiers qui ne sont pas dans le diff.**

**Les recoupements avec les autres sessions.** Le script distingue deux choses
que l'œil confond. Les *carrefours* — `CLAUDE.md`, le hook — sont touchés par
presque toutes les branches : ils annoncent un conflit à résoudre, pas un
doublon, et il ne faut pas s'en alarmer. Un fichier **rare** touché par une
autre branche, en revanche, est le signal qu'on est peut-être en train de
refaire un travail déjà fait. Une pull request a été fermée sans rien fusionner
pour l'avoir ignoré : une autre session avait corrigé le même défaut, mieux, six
minutes plus tôt.

Le relevé signale, il ne tranche pas. Une citation peut être légitime — une
fiche d'archive doit citer le chemin qu'elle archive. Une branche voisine peut
faire tout autre chose du même fichier. C'est la lecture qui décide.

## Ouvrir et fusionner

Mener la PR jusqu'à la fusion fait partie du travail : c'est dit dans
`CLAUDE.md`. Ce qui l'accompagne, et qu'on oublie :

- **Partir de `main` à jour, et le revérifier juste avant d'ouvrir.** Plusieurs
  sessions travaillent ce dépôt en parallèle. Deux branches y ont fabriqué
  Life-Organizer chacune dans son coin ; la seconde a été refaite sur la base
  fusionnée. Ce qui est fusionné gagne — s'y couler coûte toujours moins cher
  que réconcilier deux architectures.
- **Fusion par commit de fusion**, comme le reste de l'historique.
- **Après la fusion, la branche repart de `main`.** Une PR fusionnée est finie :
  elle ne peut plus porter de travail. Le pas suivant recommence par
  `git fetch origin main && git checkout -B <branche> origin/main`, et donnera
  une nouvelle PR. Empiler des commits sur l'historique déjà fusionné produit
  une PR qui semble normale et que GitHub refusera d'ouvrir, ou pire, qui
  rouvrira du déjà-fusionné.
- **La description est le compte rendu que l'historique gardera** : pourquoi,
  ce que la décision coûte, et ce qui n'a pas été vérifié. `/verifier` reste le
  filet à lancer pour de vrai avant de pousser : la CI vient après, et ce qui
  s'y découvre a déjà coûté un cycle.
- **Savoir ce qui est réellement gardé.** `tests-python.yml` n'a **aucun filtre
  de chemin** : il tourne sur toutes les PR et découvre les `*/tests` contenant
  des `test_*.py` — vérifié sur des exécutions réelles, événement
  `pull_request`, depuis des branches sans le moindre fichier Flutter. Les
  autres workflows sont filtrés (`amorce.yml` sur `src/` et les configurations
  de la racine, `agence.yml` sur `agence/**`, `look-and-find.yml` sur
  `look_and_find/**`). Une PR qui ne touche qu'à `.claude/` ou à du Markdown n'a
  donc qu'un contrôle qui ne dit rien de son contenu.
- **L'ouverture d'une PR ne déclenche aucune CI.** Elle passe par un jeton
  d'application GitHub, que GitHub refuse comme source de workflow — protection
  contre les boucles. Une *poussée* sur la branche, elle, déclenche bien
  l'événement `pull_request`. Une PR ouverte puis laissée telle quelle reste
  donc sans contrôle, indéfiniment, sans que rien ne le signale : ne pas
  l'attendre, la déclencher à la main (`workflow_dispatch` sur la branche).
- **Vérifier le verdict sur l'empreinte exacte qui sera fusionnée.** Un commit
  poussé après le déclenchement invalide le résultat précédent, et ne relance
  que les workflows dont le filtre de chemins l'accepte — `tests-python`
  toujours, les trois autres selon ce qu'il touche. C'est la façon la plus
  discrète de fusionner du non-vérifié en croyant le contraire.
- **Regarder si `main` est vert avant d'accuser sa propre branche.** Un chemin
  de police écrit sous `/mnt/skills/`, qui n'existe que dans une session Claude
  Code, a laissé `main` rouge cinq exécutions durant — et ce rouge masquait
  l'état des six autres suites Python. Un échec identique sur `main` n'est pas
  le sien : le porter s'il existe un correctif, le dire s'il n'y en a pas.

## Observer l'intégration continue

`gh` n'est pas installé dans les sessions distantes, et le jeton GitHub n'est
pas exposé au shell : `curl` sur l'API ne mènera nulle part. Les exécutions se
lisent par les outils GitHub (`mcp__github__actions_list`, méthodes
`list_workflow_runs` puis `list_workflow_jobs`), qui donnent l'état étape par
étape. Chercher un contournement en ligne de commande est du temps perdu.

Ne pas sonder en boucle : une exécution dure de quinze secondes à sept minutes
selon le workflow. Attendre par une commande de fond, puis relire une fois.

Cinq workflows gardent le dépôt, chacun sur son domaine :

| Workflow | Se déclenche sur | Durée |
| --- | --- | --- |
| `Amorce` | `src/`, `scripts/`, la configuration de la racine | ~40 s |
| `Tests Python` | tout — pas de filtre de chemins, volontairement | ~15 s |
| `Socle Agence` | `agence/**` | ~40 s |
| `Look & Find` | `look_and_find/**` | ~7 min |
| `Auto-pilote annuaire IA` | son propre domaine |  |

`Tests Python` découvre les suites au lieu de les énumérer : un projet Python
qui arrive est gardé sans rien déclarer, et un projet déplacé le reste. C'est
délibéré — la version qui énumérait a cessé de couvrir deux projets sans qu'une
ligne rouge n'apparaisse, deux fois de suite.

## Diagnostiquer un échec

Sur les projets Python, la cause la plus fréquente est un test qui importe une
bibliothèque absente de `.github/requirements-tests.txt` : l'échec est immédiat
et dit `ModuleNotFoundError`. Compléter ce fichier-là, jamais le workflow — et
ne pas y recopier la liste du hook de démarrage, bien plus longue et bien plus
lente, pour des bibliothèques qu'aucune assertion ne traverse.

Sur `Look & Find`, un échec vient presque toujours de l'une de ces causes, dans
cet ordre de fréquence :

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

## Répondre

Sur une PR de ce dépôt, ne pas commenter pour narrer chaque correction. Un
message quand un tour aboutit, quand un blocage réel apparaît, ou quand une
question se pose. Le diff est le compte rendu.
