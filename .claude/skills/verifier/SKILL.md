---
name: verifier
description: Lance la vérification du dépôt — typecheck, lint et tests pour le studio Amorce, analyse et tests pour l'application Flutter Look & Find, tests unitaires pour l'assistant Paper-Manager. À utiliser avant de committer, quand on demande « est-ce que ça passe », « vérifie », « lance les tests », ou après un changement qu'on veut valider.
---

# Vérifier ce dépôt

Quatre projets indépendants, quatre séquences. **Ne lance que celle du projet
touché** : les tests de l'un ne disent rien des autres, et tout lancer triple
l'attente pour rien.

Commence par `git status --short` pour savoir où le changement a atterri.

## Look & Find — `look_and_find/`

```bash
cd look_and_find
flutter pub get
dart run build_runner build
git diff --exit-code -- '*.g.dart'
flutter analyze
flutter test --reporter=failures-only
```

Dans l'ordre, et sans en sauter :

- `build_runner` **avant** l'analyse : un provider annoté `@riverpod` modifié
  sans régénération produit une erreur de compilation trompeuse, qui pointe le
  fichier généré plutôt que la source.
- `git diff --exit-code -- '*.g.dart'` reproduit le contrôle de l'intégration
  continue. Les `.g.dart` sont versionnés pour que le dépôt se construise sans
  codegen ; s'ils dérivent, le build casse chez tout le monde **sauf** chez
  l'auteur du changement.
- `flutter analyze` doit sortir exactement `No issues found!`. Ce dépôt ne
  tolère pas d'avertissement : un avertissement toléré en cache dix autres.

Si `flutter` est introuvable, le hook de démarrage n'a pas tourné. Le relancer
à la main : `.claude/hooks/session-start.sh` (il installe le SDK épinglé dans
`$HOME/flutter`).

## Amorce — racine du dépôt

```bash
npm run typecheck
npm run lint
npm test
```

`npm run verify` en plus **si et seulement si** le changement touche au rendu,
à l'audio, à l'export ou à la mise en page mobile. Il pilote un vrai Chromium
et contrôle les pixels et le signal sonore ; il demande `npm run dev` dans un
autre terminal et plusieurs minutes. C'est le seul filet réel pour ces
sujets-là, et il ne se remplace pas par des tests unitaires.

```bash
npm run fixtures   # une seule fois : fabrique .fixtures/rushes/
npm run dev        # dans un autre terminal
npm run verify
```

## Chaîne KDP — `kdp/`

Pas de suite de tests : le juge est `kdp/pipeline/valider.py`, qui ouvre les
deux PDF **tels qu'ils partiront chez l'imprimeur** et sort en erreur au
premier contrôle qui échoue.

```bash
python3 kdp/pipeline/valider.py --interieur <pdf> --couverture <pdf>
```

Il demande donc des PDF déjà assemblés, à partir de rushes qui ne sont pas
versionnés. Un changement qui ne touche qu'à un script de la chaîne se vérifie
au minimum par `python3 -c "import kdp.pipeline.<module>"` — la compilation
attrape déjà l'essentiel — et se signale comme **non vérifié de bout en bout**
tant que la chaîne n'a pas tourné sur de vraies planches.

Ce que `valider.py` ne voit pas, et qu'aucun script ne verra : si le dessin est
beau, si le texte est juste, si l'histoire tient.

## Paper-Manager — `paper-manager/`

```bash
python3 -m unittest discover -s paper-manager/tests -q
```

Couvre ce qui est calculable : arithmétique des échéances et des préavis,
validation et réécriture d'`admin_config.json`, résolution des gabarits de
formulaire et remplissage effectif d'un PDF. Le formulaire de test est fabriqué
à l'exécution — aucun binaire n'est versionné ici.

Seul PyMuPDF est nécessaire, et il est déjà installé par le hook de démarrage
pour la chaîne KDP. Ce que les tests ne disent pas : qu'un Cerfa réel a bien les
noms de champs que son plan lui prête — cela ne se voit qu'en le remplissant.

## Ce que la vérification ne dit pas

- **Le build Android et iOS.** Le SDK Android n'est pas installable dans ce
  conteneur : `dl.google.com` est refusé par le mandataire réseau. C'est le
  workflow `Look & Find` qui construit l'APK, à chaque poussée, et le publie
  en artéfact. Ne jamais conclure « prêt à livrer » sur la seule foi de
  `flutter analyze`.
- **La caméra, la réalité augmentée, la qualité d'identification du modèle.**
  Elles demandent un appareil réel.

Dire lesquelles de ces limites s'appliquent au changement en cours fait partie
du compte rendu. Un « tout est vert » qui tait ce qui n'a pas été vérifié est
un compte rendu faux.

## Rendre compte

Une ligne par étape, puis le détail des seuls échecs. Si un test casse, citer
son intitulé, le fichier et l'écart constaté — pas la sortie brute.

Pour une vérification lourde dont on ne veut pas la sortie dans la
conversation, déléguer à l'agent `verificateur`, qui ne rend qu'un verdict.
