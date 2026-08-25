# Look & Find — guide du sous-projet

Application Flutter (iOS/Android) qui identifie un objet photographié, le
compare chez les marchands, le projette dans la pièce en réalité augmentée et
en suit le prix. **Elle est indépendante du studio Amorce** qui occupe la
racine du dépôt : rien ici n'importe rien de `../src`, et réciproquement.

Le `README.md` de ce dossier s'adresse à qui utilise ou évalue l'application
(parcours, décisions justifiées, ce qui est testé). Ce fichier-ci s'adresse à
qui modifie le code.

## Commandes

```bash
flutter pub get
dart run build_runner build      # providers Riverpod générés
dart run build_runner watch      # pendant le développement
flutter analyze                  # doit sortir « No issues found! »
flutter test
flutter run --dart-define=GEMINI_API_KEY=votre_clé
```

Avant de pousser : `flutter analyze && flutter test`. Si le changement touche
au code annoté `@riverpod`, régénérer **et committer** les `.g.dart` — le
workflow `Look & Find` échoue si l'un d'eux a dérivé de sa source.

Ce que la machine de développement ne peut pas vérifier : le build Android
(SDK absent du conteneur), la caméra, la session de réalité augmentée. Le
workflow GitHub construit l'APK de debug à chaque poussée et le publie en
artéfact — c'est le chemin le plus court vers un vrai téléphone.

## Carte du code

```
lib/
├── main.dart        ouverture des boîtes Hive, surcharges, démarrage
├── app.dart         thème, langue, écran d'entrée
├── core/
│   ├── constants/   app_config (clé, endpoint, bornes), app_colors, app_strings
│   ├── network/     dio_client, retry_interceptor, logging_interceptor, app_exception
│   ├── theme/       app_theme — thème unique, sombre
│   └── utils/       result, formatters, extensions, image_compressor
└── features/
    ├── scanner/         viseur, capture, appel au modèle
    ├── product_detail/  fiche, comparateur, alternatives  ← propriétaire du produit
    ├── ar_view/         projection 3D et ancrage
    └── favorites/       stockage local, historique, alertes
```

Chaque fonctionnalité porte ses trois couches (`data`, `domain`,
`presentation`). `core/` ne contient que ce qui est réellement transverse : y
ajouter quelque chose qui n'est utilisé que par une fonctionnalité, c'est
commencer à défaire le découpage.

### Fichiers où l'on comprend le reste

| Fichier | Pourquoi commencer par là |
| --- | --- |
| `product_detail/domain/entities/product.dart` | Le modèle de données, et la règle de dépendance entre fonctionnalités. |
| `product_detail/data/models/product_dto.dart` | Toute la tolérance de lecture face à un modèle de langage. |
| `scanner/data/datasources/gemini_prompt.dart` | L'invite et le schéma : c'est là que se règle la qualité d'identification. |
| `core/network/app_exception.dart` | Les échecs que l'application sait expliquer, et lesquels valent un « Réessayer ». |

## Invariants à ne pas casser

Chacun est justifié en tête du fichier concerné ; relire ce commentaire avant
d'y toucher.

1. **La direction des dépendances entre fonctionnalités est unique.**
   `product_detail` est propriétaire de la notion de produit et n'importe
   personne. Concrètement : le `data` et le `domain` d'une fonctionnalité
   n'importent jamais le `data` ni la `presentation` d'une autre — seulement
   son `domain` et le DTO qui le sérialise. La `presentation` peut importer
   celle d'une autre uniquement pour naviguer vers son écran, ou pour un
   composant partagé explicitement (`FavoriteButton`, qui appartient au suivi
   de prix et non à la fiche qui l'affiche).
2. **La clé d'API n'entre jamais dans le dépôt.** Elle arrive par
   `--dart-define`. Sans elle, l'application démarre et explique quoi faire ;
   ne pas remplacer cet écran par un échec d'appel.
3. **`ProductDto` ne lève sur aucun champ, sauf l'absence de titre.** Un
   marchand illisible est écarté, les autres sont conservés. Rendre la lecture
   stricte ferait disparaître des fiches entières pour un prix mal typé.
4. **Un seul DTO pour le réseau et pour Hive.** Pas de `TypeAdapter` généré :
   la boîte contient du JSON relu par le même parseur tolérant, ce qui évite
   une migration binaire à chaque champ ajouté à la fiche.
5. **Le schéma de `gemini_prompt.dart` et la lecture de `product_dto.dart` se
   tiennent.** Modifier l'un sans l'autre fait silencieusement disparaître un
   champ de la fiche, sans qu'aucun test ne l'attrape.
6. **Le prix de référence d'un favori ne bouge pas.** C'est lui qui rend une
   baisse mesurable ; le recalculer ferait glisser le repère avec le prix et
   aucune baisse ne serait jamais visible.
7. **Une alerte s'acquitte, et l'acquittement porte un prix.** Un objet acquitté
   à 80 € ne resignale qu'en passant sous 80 €. Sans cela, la même alerte
   revient à chaque ouverture, on apprend à ne plus la voir, et la suivante —
   la vraie — passe inaperçue.
8. **L'échelle en réalité augmentée est fixe** (`ArScale.fixed`). La fonction
   répond à « est-ce que ça rentre » : laisser agrandir au doigt donnerait une
   réponse fausse et rassurante.
9. **La caméra est libérée à la mise en pause.** Sur Android, le capteur est
   une ressource exclusive : la garder en arrière-plan empêche les autres
   applications de l'ouvrir, et nous met nous-mêmes en échec au retour.
10. **La photo est réduite hors du fil principal.** `ImageCompressor` passe par
   `compute` ; le faire sur le fil de l'interface fait sauter des images juste
   au moment où l'utilisateur attend le retour du déclencheur.

## Riverpod 3 — ce qui diffère de la version 2

Le générateur est en version 4, le runtime en version 3. Chacun de ces points a
déjà coûté un débogage :

- **`Ref` n'est plus générique.** On écrit `Ref ref`, pas `FooRef ref`.
- **Interdiction de toucher à `ref` dans un cycle de vie.** Un `ref.read(...)`
  dans `ref.onDispose` lève. Capturer la dépendance pendant la construction,
  puis n'utiliser que la valeur capturée.
- **Lire `ref` après un `await` n'est pas sûr.** Le provider peut avoir été
  libéré entretemps. La convention du dépôt : **tout ce qui vient de `ref` est
  lu avant le premier `await`** (voir `ScanController.identify` et
  `ScanJournal.record`).
- **`AsyncValue.valueOrNull` n'existe plus**, c'est `value`.
- `keepAlive` n'est pas un confort. `ScanJournal` en a besoin parce que la
  baisse de prix est produite par le viseur et lue par la fiche, deux écrans
  qui ne coexistent jamais.

## Conventions de code

- **Français partout** : commentaires, textes affichés, messages d'erreur,
  intitulés de tests, messages de commit. Les identifiants restent en anglais
  (`averagePrice`, `BestOffer`).
- **Les commentaires disent pourquoi, pas quoi.** La convention est un bloc en
  tête de fichier qui explique la décision de conception, et des commentaires
  ponctuels qui justifient un choix contre-intuitif. Ne pas paraphraser le
  code.
- **Pas de valeur hexadécimale en dur** : les couleurs sont des jetons de
  `AppColors`. **Deux accents, deux rôles** — `action` désigne ce qu'il y a à
  faire, `gain` désigne uniquement l'argent économisé. Un accent qui sert à
  deux choses ne signale plus rien.
- Le design se fait par **surfaces empilées** (`ink` < `slab` < `raised`), pas
  par contours : une bordure est réservée à ce qui sépare vraiment, ou à ce qui
  est désigné (la meilleure offre).
- **Cibles tactiles d'au moins 48 dp** (`AppTheme.minTouchTarget`).
- Une **espace insécable** avant `%` s'écrit ` ` en échappement, jamais en
  caractère brut : brute, elle est invisible dans un diff, et quelqu'un la
  remplace un jour par une espace ordinaire sans le voir.

## Vérifier

Les tests couvrent ce qui se décide hors appareil. Les intitulés sont des
phrases françaises qui décrivent le comportement attendu, pas le nom de la
méthode testée.

| Fichier | Ce qu'il verrouille |
| --- | --- |
| `product_dto_test.dart` | Les formes réellement renvoyées par un modèle : prix à virgule, « null » écrit en toutes lettres, marchand incomplet, URL inventée, identifiant stable. |
| `best_offer_test.dart` | La règle du comparateur — le moins cher **en stock**. |
| `favorite_test.dart` | Ce qui compte comme une baisse, et ce qui déclenche l'alerte. |
| `app_exception_test.dart` | La traduction des échecs réseau et le droit à un « Réessayer ». |
| `formatters_test.dart` | Cotes manquantes omises, conversion du volume. |
| `ar_model_test.dart` | Ce que le format du modèle autorise, plateforme par plateforme. |
| `scan_controller_test.dart` | Le parcours de scan complet, réseau et disque remplacés par surcharge de providers. |
| `alerts_test.dart` | Ce qui doit être signalé, et surtout ce qui doit se taire une fois acquitté. |
| `product_detail_page_test.dart` | La fiche montée pour de vrai. |
| `favorites_page_test.dart` | « Ma liste » montée pour de vrai : bandeau d'alerte, cumul, acquittement. |

Trois recettes utiles quand on ajoute un test :

- **Tout remplacer par surcharge.** `favoritesBoxProvider` et
  `historyBoxProvider` lèvent par défaut et sont surchargés au démarrage ; un
  test les remplace par deux boîtes Hive temporaires. Le réseau se remplace de
  même via `scannerRepositoryProvider`.
- **Ne pas appeler `Hive.close()` dans un test d'interface.** Les écrans
  laissent des abonnements ouverts sur `box.watch()`, et la fermeture les
  attend indéfiniment — le test se fige sans message. Supprimer le dossier
  temporaire suffit.
- **Agrandir la surface plutôt que faire défiler** (`tester.view.physicalSize`)
  sur une page longue : une assertion qui dépend d'un défilement dépend de la
  hauteur de tout ce qui la précède.
- **Envelopper toute écriture Hive de préparation dans `tester.runAsync`.**
  Dans un test de widget, l'horloge est simulée et n'avance qu'aux `pump` : une
  écriture attendue directement dans le corps du test ne se termine jamais, et
  le test se fige **sans message** au bout de plusieurs minutes. Le symptôme
  est reconnaissable — « did not complete », puis « Cannot close sink while
  adding stream ».

## Pièges connus

- La clé passe en paramètre d'URL. L'intercepteur de trace la masque, mais une
  capture de trafic la verrait : pour une mise en production, l'appel doit
  passer par un relais côté serveur.
- Les photos sont écrites dans le dossier temporaire du système. Une vignette
  d'historique peut disparaître alors que la fiche reste lisible — tous les
  widgets d'image prévoient ce cas, ne pas retirer leur `errorBuilder`.
- `NumberFormat` en `fr_FR` fonctionne d'office, mais les **dates** demandent
  `initializeDateFormatting('fr_FR')` dans `main.dart`. L'oubli ne se voit
  qu'en production, à la première date d'historique.
- Quick Look (iOS) ne lit que le `.usdz`. Un objet dont l'identification n'a
  renvoyé qu'un `.glb` est consultable en 3D sur iPhone mais pas posable dans
  la pièce ; l'interface le dit déjà, ne pas le masquer.
- L'historique est borné à soixante entrées, taillées à l'écriture.
- Sans serveur, un prix ne peut bouger qu'au rescan. Ne pas ajouter de
  vocabulaire d'alerte de fond (« notification », « surveillance permanente ») :
  l'architecture ne le permet pas.

## Git

Messages de commit en français, à l'infinitif, décrivant l'intention plutôt
que le fichier touché — par exemple « Rendre visibles les alertes de prix déjà
enregistrées ».
