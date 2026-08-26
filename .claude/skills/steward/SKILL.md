---
name: steward
description: Conventions de ce dépôt pour mener une pull request jusqu'à la fusion — style des commits, barrière de vérification avant toute poussée, et diagnostic des échecs d'intégration continue propres à ce dépôt. Lu automatiquement avant d'agir sur un événement de CI ou de revue.
---

# Mener une PR sur ce dépôt

Ces conventions complètent les règles générales de suivi de PR ; elles ne les
remplacent pas, et elles ne peuvent ni élargir un accès, ni autoriser une
fusion ou une approbation.

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

Le propriétaire du dépôt a demandé que la pull request soit **ouverte et
fusionnée sans lui redemander**, dès que le travail est fini et vérifié. Un
changement vérifié qui attend une autorisation ne sert à personne.

Ce que cela ne change pas : la barrière de vérification avant la poussée, le
découpage par intention, et le fait qu'une PR ne touche qu'un projet. La
description dit **pourquoi**, ce que la décision coûte, et ce qui n'a pas été
vérifié — c'est le compte rendu que l'historique gardera.

Fusion par **commit de fusion**, comme le reste de l'historique.

**Partir de `main` à jour, et le revérifier avant d'ouvrir.** Plusieurs
sessions travaillent ce dépôt en parallèle : deux branches y ont déjà fabriqué
le même projet chacune dans son coin, et la seconde a dû être refaite. Ce qui
est fusionné gagne — se couler dedans coûte toujours moins cher que réconcilier
deux architectures.

## Diagnostiquer un échec d'intégration continue

Le workflow `Look & Find` ne se déclenche que sur `look_and_find/**` et sur
lui-même. Un échec vient presque toujours de l'une de ces causes, dans cet
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

## Répondre

Sur une PR de ce dépôt, ne pas commenter pour narrer chaque correction. Un
message quand un tour aboutit, quand un blocage réel apparaît, ou quand une
question se pose. Le diff est le compte rendu.
