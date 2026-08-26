---
name: verifier
description: Lance la vérification du dépôt — typecheck, lint et tests pour le studio Amorce, lint, typecheck, tests et build pour le socle agence, analyse et tests pour l'application Flutter Look & Find, tests unitaires pour l'assistant Paper-Manager et pour le radar crypto. À utiliser avant de committer, quand on demande « est-ce que ça passe », « vérifie », « lance les tests », ou après un changement qu'on veut valider.
---

# Vérifier ce dépôt

Des projets indépendants, une séquence chacun. **Ne lance que celle du projet
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

## Socle Agence — `agence/`

```bash
cd agence
npm run lint
npm run typecheck
npm test
npm run build
```

Les quatre, et depuis `agence/` : le projet a son propre `tsconfig.json` et son
propre ESLint, la racine l'ignore volontairement. Le workflow
`.github/workflows/agence.yml` rejoue exactement cette séquence.

Le `build` n'est pas facultatif ici. C'est lui qui attrape ce que `tsc` laisse
passer dans une application App Router : une directive `'use client'`
manquante, un composant serveur qui reçoit une fonction en propriété, un export
non asynchrone dans un fichier `'use server'`. Il réclame les variables
d'environnement — les valeurs d'exemple suffisent :

```bash
NEXT_PUBLIC_SUPABASE_URL="https://exemple.supabase.co" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="cle-de-compilation" npm run build
```

Les politiques RLS, elles, ne se vérifient pas depuis TypeScript. Elles ont
leur propre contrôle, sur un vrai PostgreSQL :

```bash
docker run --rm -d -e POSTGRES_PASSWORD=postgres -p 5432:5432 --name pg postgres:16
PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres npm run test:rls
```

Vingt contrôles : ce qu'un utilisateur, un administrateur et un visiteur
anonyme peuvent lire et écrire. **À relancer dès qu'on touche à
`supabase/schema.sql`** — c'est le seul filet de cette partie-là, et une
politique trop large ne se remarque qu'en production.

Sans PostgreSQL sous la main, le même fichier (`supabase/verifier-rls.sql`) se
colle dans l'éditeur SQL d'un projet Supabase : il annule tout ce qu'il crée.

## Chaîne KDP — `kdp/`

Une seule partie de la chaîne est testable hors fichiers : le validateur de
niches, qui n'est que du calcul.

```bash
python3 -m unittest discover -s kdp/tests
```

Pour tout le reste, le juge est `kdp/pipeline/valider.py`, qui ouvre les deux
PDF **tels qu'ils partiront chez l'imprimeur** et sort en erreur au premier
contrôle qui échoue.

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
validation et réécriture d'`admin_config.json`, tableau de bord et fusion des
alertes, format du fichier de rappels, choix du gabarit de résiliation et
mentions obligatoires du courrier, résolution des gabarits de formulaire et
remplissage effectif d'un PDF. Le formulaire de test est fabriqué
à l'exécution — aucun binaire n'est versionné ici.

Seul PyMuPDF est nécessaire, et il est déjà installé par le hook de démarrage
pour la chaîne KDP. Ce que les tests ne disent pas : qu'un Cerfa réel a bien les
noms de champs que son plan lui prête — cela ne se voit qu'en le remplissant.
## Studio audio — `mon-app-audio/`

```bash
python3 -m unittest discover -s mon-app-audio/tests
```

Le plan d'atténuation se vérifie sans son, sur des intervalles ; le reste du
mixage sur un signal synthétisé, sans jamais toucher au disque. Ce qu'aucun
test ne dit : si le mixage **s'entend** bien. Cela demande une écoute.

## Radar crypto — `pepites/`

```bash
cd pepites
python3 -m unittest discover -s tests    # 121 tests, aucun ne touche au réseau
python3 profils.py                       # l'effet des réglages sur six profils connus
```

`profils.py` en plus **si et seulement si** le changement touche à un seuil, à
un trapèze, à une pondération ou à un filtre : il montre d'un coup d'œil si la
discrimination entre les six profils de marché tient encore. Les tests seuls
diraient qu'ils passent sans dire que la note du profil « accumulation » est
tombée de 100 à 48.

Ce qu'aucun des deux ne dit : **si une API a changé de forme**. Rien n'a encore
tourné contre DexScreener ni GoPlus en conditions réelles ; tout est validé sur
des réponses rejouées. Un changement dans `pepites/sources/` se signale comme
non vérifié tant qu'un vrai `python3 main.py scan` n'a pas tourné.

## Répondeur Facebook — `repondeur-facebook/`

```bash
python3 -m unittest discover -s repondeur-facebook/tests
```

Hors réseau : ni Facebook, ni modèle. Ils couvrent le dépouillement des
réponses de l'API, le tri, la mémoire des commentaires traités, la mise au
propre du texte et la mise en forme de la notification.

Ce qu'ils ne disent pas, et qui doit figurer dans le compte rendu : si le jeton
a les bonnes permissions, si le ton ressemble à celui de l'auteur, et si le
modèle met de côté les bons commentaires. Cela se regarde **en simulation**
(sans `--publier`), sur de vrais commentaires.

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
