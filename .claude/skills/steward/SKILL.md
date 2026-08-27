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
- **La description est le compte rendu que l'historique gardera** : pourquoi,
  ce que la décision coûte, et ce qui n'a pas été vérifié.

### Aucune PR de ce dépôt ne déclenche l'intégration continue

Les quatre workflows déclarent pourtant `on: pull_request`. Malgré cela, le
dépôt n'a **jamais** produit un seul run sur cet événement — zéro sur toute son
histoire, vérifié en listant les exécutions filtrées par `event=pull_request`.
Les runs ne partent qu'au `push` sur `main`, c'est-à-dire **après** la fusion.

Deux conséquences, et la première est la plus coûteuse à découvrir seul :

- **Attendre que « la CI passe » sur une PR, c'est attendre indéfiniment.**
  Le filet avant fusion est `/verifier`, lancé pour de vrai, et rien d'autre.
- **La fusion est le début du contrôle, pas sa fin.** Après avoir fusionné,
  regarder le run déclenché sur `main` et le mener au vert comme s'il s'agissait
  encore de la PR — c'est le même travail, il arrive simplement plus tard.

## `main` bouge sous les pieds

Plusieurs sessions fusionnent en parallèle, parfois à quelques minutes
d'intervalle. Une PR ouverte sur un `main` vieux de vingt minutes peut être
refusée à la fusion pour conflit — c'est arrivé trois fois d'affilée sur la même
PR, chaque tentative étant doublée par une fusion concurrente.

La boucle qui en vient à bout :

```bash
git fetch origin main
git merge origin/main          # résoudre s'il le faut
/verifier                      # sur le projet touché
git push
```

puis **fusionner immédiatement**. Chaque minute entre la poussée et la fusion
est une occasion de recommencer.

Les conflits tombent presque toujours dans les trois mêmes fichiers, parce que
tous les projets s'y déclarent :

| Fichier | Ce qui s'y heurte |
| --- | --- |
| `CLAUDE.md` | La liste des projets et son compte en toutes lettres — « neuf », « dix »… |
| `.claude/hooks/session-start.sh` | Le commentaire de tête et la ligne d'accueil finale, que chaque projet allonge |
| `.claude/skills/verifier/SKILL.md` | La description et l'ordre des séquences |

**Ils sont additifs, sans exception rencontrée à ce jour** : les deux côtés
ajoutent un projet, aucun ne contredit l'autre. Garder les deux apports et
recompter, plutôt que choisir un côté — choisir, c'est effacer le travail d'une
autre session.

## Diagnostiquer un échec d'intégration continue

Chaque workflow ne surveille que son projet (`look_and_find/**`, `agence/**`,
les `*/tests` Python…) et lui-même. Un échec de `Look & Find` — le plus
fréquent, parce que c'est le plus lourd — vient presque toujours de l'une de
ces causes, dans cet ordre :

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
