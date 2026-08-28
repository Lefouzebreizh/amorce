---
name: verifier
description: Lance la vérification du dépôt — typecheck, lint et tests pour le studio Amorce, lint, typecheck, tests et build pour le socle agence, tests, types et build pour le site hypersensible-bienveillance, analyse et tests pour l'application Flutter Look & Find, tests unitaires pour l'assistant Paper-Manager, validation des bases et parcours Chromium pour le réseau d'annuaires IA, et le rejeu local de l'intégration continue Python, qui attrape les tests verts en session et rouges sur un runner. À utiliser avant de committer, quand on demande « est-ce que ça passe », « vérifie », « lance les tests », après un changement qu'on veut valider, et dès que la CI est rouge alors que tout passe en local.
---

# Vérifier ce dépôt

Des projets indépendants, une séquence chacun. **Ne lance que celle du projet
touché** : les tests de l'un ne disent rien des autres, et tout lancer multiplie
l'attente pour rien.

## Une commande

```bash
bash .claude/skills/verifier/scripts/verifier.sh
```

Elle regarde ce qui a changé depuis `origin/main` — commité ou non —, en déduit
les projets concernés, lance leurs séquences **toutes en même temps**, et rend un
verdict par projet avec le détail des seuls échecs. Elle finit par ce que la
vérification ne couvre pas, calculé sur les projets touchés.

Deux raisons de passer par elle plutôt que de recopier les séquences ci-dessous :

- **Elle ne se trompe pas de périmètre.** Choisir à la main, c'est reprendre à
  chaque fois trois décisions — où le changement a atterri, quelle séquence lui
  correspond, dans quel ordre — dont l'erreur la plus probable est aussi la plus
  coûteuse : oublier une suite. Les suites Python sont **découvertes**, comme
  dans `.github/workflows/tests-python.yml` : un projet nouveau est gardé sans
  avoir rien à déclarer.
- **Elle est trois fois plus rapide.** Mesuré sur la barrière d'Amorce, la plus
  lancée du dépôt : 25,5 s en série, 7,9 s en parallèle. `tsc`, ESLint et
  `node --test` ne se lisent pas l'un l'autre ; les mettre à la queue leu leu
  n'était qu'une habitude.

`--base=<ref>` change le point de comparaison, `--tout` vérifie le dépôt entier
sans regarder ce qui a changé. Le code de sortie vaut 0 si tout est vert.

Ce qui suit reste la référence : ce que chaque séquence contrôle, dans quel
ordre et **pourquoi**. À lire quand une étape casse, quand il faut lancer un
filet que le script ne lance pas de lui-même — `npm run verify`, les politiques
RLS —, ou quand on ajoute un projet.

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

## TITAN Builder — `titan-builder/`

```bash
cd titan-builder
npm run lint && npm run typecheck && npm test && npm run build
```

Les trois premières partent ensemble dans `verifier.sh`, le build ferme la
marche. Ce qu'elles **ne voient pas** : le parcours du configurateur. Un
sous-composant défini dans un rendu fait sauter le curseur à chaque frappe sans
qu'aucun test unitaire ne bronche — il faut conduire les cinq étapes dans un
vrai navigateur pour l'attraper.

Et `next dev` refuse de servir `/_next/` à `127.0.0.1`, qu'il tient pour une
origine tierce : la page se charge, son code non, les champs se remplissent et
React ne les voit pas. **Piloter par `http://localhost:3000`.**

## IPTV / VOD — `iptv/`

```bash
cd iptv
npm test && npm run check
```

Les deux partent ensemble dans `verifier.sh`. Ni lint ni build : le projet n'a
pas encore d'interface, et annoncer une étape qui n'existe pas rendrait le
verdict faux.

Ce qu'elles **ne voient pas** : le dialogue avec un vrai panneau Xtream et une
vraie liste. Les tests injectent `fetch` et ne touchent pas au réseau — c'est ce
qui les rend rejouables partout, et c'est aussi leur limite. Xtream Codes n'a
pas de spécification publiée : le premier branchement sur un abonnement réel est
le seul moment où l'on saura si un champ manque. Commencer par
`verifierCompte()`, qui dit en un appel si les identifiants passent.

Et pour éprouver l'analyseur sur du volume, lui donner une vraie liste plutôt
qu'une courte : c'est la tenue en mémoire qui se mesure, pas le nombre
d'entrées.

## Réseau d'annuaires IA — `annuaire-ia/`

```bash
cd annuaire-ia
npm run valider          # les bases : erreurs et alertes
npm run verifier         # le parcours Chromium
```

Vingt-cinq contrôles dans un vrai Chromium. Le projet n'a ni typecheck ni lint :
c'est la seule chose qui dise s'il marche, et onze sites tombent ensemble.
Voir `/reseau-annuaires` pour ce que chacun garde.

## Toutes les suites Python, comme la CI

```bash
.claude/skills/verifier/scripts/comme-la-ci.sh          # toutes les suites
.claude/skills/verifier/scripts/comme-la-ci.sh kdp      # une seule
```

**Lancer les suites depuis le dépôt ne prouve rien.** Une session Claude Code a
des fichiers que la CI n'a pas — `/mnt/skills/…`, des rushes non versionnés,
ffmpeg posé par le hook — et le hook installe des bibliothèques que
`.github/requirements-tests.txt` n'installe pas. Des tests verts ici sont donc
régulièrement rouges là-bas : `main` est resté rouge cinq exécutions durant sur
une police introuvable, et ce rouge-là masquait l'état des six autres projets.

Le script supprime les trois écarts d'un coup : il copie les seuls fichiers
suivis par git (contenu du répertoire de travail compris), exécute dans un
environnement n'ayant que les bibliothèques de la CI, et pose la police du
lettrage comme le fait le workflow. Premier passage une minute, les suivants une
vingtaine de secondes.

Il signale aussi, sans faire échouer, les chemins de session écrits en dur —
la seule chose qu'aucune exécution locale ne peut détecter, puisque le fichier
est là.

**À lancer avant de pousser un changement Python**, et en premier réflexe quand
la CI est rouge alors que tout passe en local.

## Hypersensible & Bienveillance — `hypersensible-bienveillance/`

```bash
cd hypersensible-bienveillance
npm test          # moteur CNV et lecture de journal — node --test, sans dépendance
npm run check     # astro check + tsc --noEmit
npm run build     # le seul à voir ce que tsc laisse passer
```

Les trois, et depuis le dossier : le projet a son propre `tsconfig.json`, ses
propres types Cloudflare et son propre `node_modules`, la racine l'ignore
volontairement. Le workflow `.github/workflows/hypersensible.yml` rejoue
exactement cette séquence.

**Ce que ces trois commandes ne voient pas**, et c'est l'essentiel du produit :
le quota des cinq analyses quotidiennes, le radar branché sur D1, et la tournée
de veille. Rien de tout cela ne tourne sous `astro dev`, qui ne sert que les
pages — seul wrangler exécute les Pages Functions :

```bash
npm run db:init                 # base D1 locale, rejouable sans doublon
npm run build && npm run preview   # site + fonctions sur :8788
npm run cron                    # puis curl "localhost:8787/__scheduled?cron=0+4+*+*+*"
```

Le quota s'éprouve en appelant six fois `/api/reforme` sans `src` : cinq 200,
puis un 429. Avec `{"src":"groupe"}`, il ne se déclenche jamais — c'est la
promesse faite aux 48 000 membres, et c'est ce qu'il faut revérifier après toute
retouche de `functions/api/reforme.ts`.

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
npm run test:rls
```

Rien à préparer : sans serveur joignable, le script monte lui-même un
PostgreSQL éphémère dans un répertoire temporaire et le jette en sortant.
C'est la seule voie en session distante, où `docker` existe sans démon
derrière. Pour viser un serveur existant, les variables habituelles de libpq
suffisent (`PGHOST`, `PGUSER`, `PGPASSWORD`).

Vingt contrôles : ce qu'un utilisateur, un administrateur et un visiteur
anonyme peuvent lire et écrire. **À relancer dès qu'on touche à
`supabase/schema.sql`** — c'est le seul filet de cette partie-là, et une
politique trop large ne se remarque qu'en production.

Sans PostgreSQL sous la main, le même fichier (`supabase/verifier-rls.sql`) se
colle dans l'éditeur SQL d'un projet Supabase : il annule tout ce qu'il crée.

## Artisan Express — `artisan-express/`

```bash
cd artisan-express
npm run lint
npm run typecheck
npm test
npm run build
```

Les quatre, et depuis `artisan-express/` : le projet a son `tsconfig.json` et
son ESLint, la racine l'ignore. Le workflow
`.github/workflows/artisan-express.yml` rejoue la même séquence.

Aucune variable n'est requise pour compiler : ce qui manque disparaît de la
page au lieu d'être inventé. C'est aussi ce que le `build` vérifie sans le
dire — la page tient debout sans téléphone, sans WhatsApp et sans lien Stripe.

Ce que la séquence ne couvre pas : **l'envoi réel du courriel**. Il demande une
clé Resend, qu'aucune session n'a. `npm test` éprouve la fabrication de la
requête et la lecture de la réponse, en simulant `fetch` ; le premier envoi
véritable se regarde en ligne, et se corrige dans `construireCorpsResend`
(`src/lib/courriel.ts`) — c'est le seul endroit qui connaisse la forme attendue
par le prestataire.

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

## Radar crypto — `pepites/`

```bash
cd pepites
python3 -m unittest discover -s tests    # 121 tests, aucun ne touche au réseau
python3 profils.py                       # l'effet des réglages sur six profils connus
```

`profils.py` en plus **si et seulement si** le changement touche à un seuil, à
un trapèze, à une pondération ou à un filtre : les tests diraient qu'ils passent
sans dire que la note du profil « accumulation » est tombée de 100 à 48.

Ce qu'aucun des deux ne dit : **si une API a changé de forme**. Rien n'a tourné
contre DexScreener ni GoPlus en conditions réelles ; tout est validé sur des
réponses rejouées. Un changement dans `pepites/sources/` se signale comme non
vérifié tant qu'un vrai `python3 main.py scan` n'a pas tourné.

## NexusCrypto — `nexuscrypto/`

```bash
cd nexuscrypto
python3 -m unittest discover -s tests    # 251 tests, aucun ne touche au réseau
python3 main.py verifier                 # la configuration livrée est-elle valide
python3 profils.py                       # l'effet des réglages sur six marchés connus
```

`profils.py` en plus **si et seulement si** le changement touche à un seuil, à
une pondération, à un multiplicateur DCA ou à une note : les tests diraient
qu'ils passent sans dire que le prix moyen d'achat du profil « chute puis
reprise » est repassé au-dessus de celui du témoin. C'est la même règle que
pour le radar `pepites/`, et elle a été payée là-bas.

`main.py verifier` en plus **si et seulement si** le changement touche à
`config/config.yaml` ou à `src/core/config.py` : les tests diraient qu'ils
passent sans dire qu'une allocation ne somme plus à 100 %, et c'est un défaut
qui n'apparaît qu'au démarrage.

La suite entière tourne avec `aiohttp`, `ccxt`, `pandas` et `numpy` bloqués à
l'import — c'est une propriété du projet, pas un accident. Pour la revérifier
après avoir ajouté une dépendance :

```bash
cd nexuscrypto && python3 - <<'FIN'
import sys, unittest
class Bloqueur:
    INTERDITS = {"aiohttp", "ccxt", "pandas", "numpy"}
    def find_module(self, nom, chemin=None):
        return self if nom.split(".")[0] in self.INTERDITS else None
    def load_module(self, nom):
        raise ImportError(f"{nom} volontairement absent")
sys.meta_path.insert(0, Bloqueur()); sys.path.insert(0, "tests")
unittest.TextTestRunner().run(unittest.TestLoader().discover("tests"))
FIN
```

**Ce que rien de tout cela ne dit** : si une API a changé de forme. Aucune source
n'a tourné en conditions réelles ; tout est validé sur des réponses rejouées. Un
changement dans `nexuscrypto/src/data_engine/` se signale comme **non vérifié**
tant qu'un vrai `python3 main.py analyser` n'a pas tourné. Le mode réel,
`CourtierCCXT`, n'a jamais passé d'ordre.

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
