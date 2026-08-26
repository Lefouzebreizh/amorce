---
name: verifier
description: Lance la vérification du projet touché — typecheck, lint et tests pour le studio Amorce, analyse et tests pour Look & Find, tests Python pour le studio audio et le radar crypto, validation des PDF pour la chaîne KDP. À utiliser avant de committer, quand on demande « est-ce que ça passe », « vérifie », « lance les tests », ou après un changement qu'on veut valider.
---

# Vérifier ce dépôt

Cinq projets indépendants, cinq séquences. **Ne lance que celle du projet
touché** : les tests de l'un ne disent rien des autres, et tout lancer multiplie
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

## Studio audio — `mon-app-audio/`

```bash
python3 -m unittest discover -s mon-app-audio/tests
```

Ce qui est couvert : le plan d'atténuation, le recollage des tranches, la
normalisation — du calcul d'intervalles et du signal synthétisé, sans toucher au
disque. Ce qui ne l'est pas : l'alignement par Whisper, qui demande PyTorch, et
la voix de synthèse, qui demande une connexion. Un changement sur ces deux
chemins-là se signale comme non vérifié.

## Radar crypto — `pepites/`

```bash
cd pepites
python3 -m unittest discover -s tests    # ~120 tests, aucun ne touche au réseau
python3 profils.py                       # l'effet des réglages sur six profils connus
```

`profils.py` en plus **si et seulement si** le changement touche à un seuil, à
un trapèze, à une pondération ou à un filtre : il montre d'un coup d'œil si la
discrimination entre les six profils de marché tient encore. Les tests seuls
diraient qu'ils passent sans dire que la note du profil « accumulation » est
tombée de 100 à 48.

Ce qu'aucun des deux ne dit : **si une API a changé de forme**. Rien n'a encore
tourné contre DexScreener ni GoPlus en conditions réelles ; tout est validé sur
des réponses rejouées. Un changement dans `pepites/sources/` se signale comme non
vérifié tant qu'un vrai `python3 main.py scan` n'a pas tourné.

## Ce que la vérification ne dit pas

- **Le build Android et iOS.** Le SDK Android n'est pas installable dans ce
  conteneur : `dl.google.com` est refusé par le mandataire réseau. C'est le
  workflow `Look & Find` qui construit l'APK, à chaque poussée, et le publie
  en artéfact. Ne jamais conclure « prêt à livrer » sur la seule foi de
  `flutter analyze`.
- **La caméra, la réalité augmentée, la qualité d'identification du modèle.**
  Elles demandent un appareil réel.
- **Les appels réseau du radar crypto.** La politique réseau des sessions
  distantes refuse `api.dexscreener.com` et les services de sécurité : un scan
  lancé ici s'arrête sur « Réseau indisponible » au bout d'une trentaine de
  secondes. Ce n'est pas une panne de l'outil.

Dire lesquelles de ces limites s'appliquent au changement en cours fait partie
du compte rendu. Un « tout est vert » qui tait ce qui n'a pas été vérifié est
un compte rendu faux.

## Rendre compte

Une ligne par étape, puis le détail des seuls échecs. Si un test casse, citer
son intitulé, le fichier et l'écart constaté — pas la sortie brute.

Pour une vérification lourde dont on ne veut pas la sortie dans la
conversation, déléguer à l'agent `verificateur`, qui ne rend qu'un verdict.
