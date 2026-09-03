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

dart run tool/rejouer.dart reponse.json   # une réponse du modèle, passée par la lecture
GEMINI_API_KEY=… dart run tool/banc_invite.dart photo.jpg   # l'invite, sur une vraie photo
GEMINI_API_KEY=… dart run tool/banc_invite.dart --modeles   # ce que Google sert encore
```

Avant de pousser : `flutter analyze && flutter test`. Si le changement touche
au code annoté `@riverpod`, régénérer **et committer** les `.g.dart` — le
workflow `Look & Find` échoue si l'un d'eux a dérivé de sa source.

Ce que la machine de développement ne peut pas vérifier : le build Android
(SDK absent du conteneur), la caméra, la session de réalité augmentée. Le
workflow GitHub construit l'APK de debug à chaque poussée et le publie en
artéfact — c'est le chemin le plus court vers un vrai téléphone. Le protocole
d'essai correspondant est écrit dans `ESSAI-APPAREIL.md`, pensé pour être suivi
sans rien relire d'autre : le rédiger a coûté moins cher que de répondre trois
fois aux mêmes questions de sideload MIUI.

**Ce qu'elle peut vérifier depuis peu**, et qui demandait auparavant ce même
aller-retour de vingt minutes : la qualité de l'identification. Les deux
commandes de `tool/` éprouvent l'invite et la lecture hors appareil, en
important les constantes du dépôt plutôt qu'en les recopiant. Voir
`/identification-produit`, qui tient la boucle complète — de la fiche fausse au
correctif fusionné.

## Carte du code

```
lib/
├── main.dart        ouverture des boîtes Hive, surcharges, démarrage
├── app.dart         thème, langue, écran d'entrée
├── core/
│   ├── constants/   app_config (clé, endpoint, bornes), app_colors, app_strings
│   ├── network/     dio_client, retry_interceptor, logging_interceptor, app_exception
│   ├── theme/       app_theme — thème unique, sombre
│   └── utils/       result, formatters, extensions, iterables, image_compressor
└── features/
    ├── scanner/         viseur, capture, appel au modèle
    ├── product_detail/  fiche, comparateur, alternatives  ← propriétaire du produit
    ├── ar_view/         projection 3D et ancrage
    └── favorites/       stockage local, historique, alertes
tool/                banc d'essai de l'invite et rejeu d'une réponse, hors Flutter
```

`tool/` s'exécute avec `dart run`, sans appareil ni émulateur — ce qui n'est
possible que parce que le `domain` et le `data` du produit sont sans dépendance
à Flutter. C'est la raison pour laquelle `iterables.dart` existe à côté
d'`extensions.dart` : le premier est pur, le second importe `material`.

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
| `tool/lecture_fiche.dart` | Ce qui se perd entre la réponse du modèle et la fiche — le diagnostic qui désigne le fichier à corriger. |

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
2. **La clé d'API n'entre jamais dans le dépôt**, et la **saisie l'emporte sur
   le build**. Une clé compilée est en clair dans le binaire et sa rotation
   impose de reconstruire ; l'ordre de priorité de `geminiApiKeyProvider` est
   ce qui permet d'y réagir en dix secondes. Sans aucune des deux,
   l'application démarre et explique quoi faire ; ne pas remplacer cet écran
   par un échec d'appel.
3. **`ProductDto` ne lève sur aucun champ, sauf l'absence de titre.** Un
   marchand illisible est écarté, les autres sont conservés. Rendre la lecture
   stricte ferait disparaître des fiches entières pour un prix mal typé.
4. **Un seul DTO pour le réseau et pour Hive.** Pas de `TypeAdapter` généré :
   la boîte contient du JSON relu par le même parseur tolérant, ce qui évite
   une migration binaire à chaque champ ajouté à la fiche.
5. **La réponse brute est retenue avant le décodage.** Une réponse illisible
   est justement celle qu'on a le plus besoin de pouvoir regarder ; l'enregistrer
   après un décodage réussi la perdrait dans le seul cas qui compte.
6. **Le schéma de `gemini_prompt.dart` et la lecture de `product_dto.dart` se
   tiennent.** Modifier l'un sans l'autre fait silencieusement disparaître un
   champ de la fiche, sans qu'aucun test ne l'attrape.
7. **Le prix de référence d'un favori ne bouge pas.** C'est lui qui rend une
   baisse mesurable ; le recalculer ferait glisser le repère avec le prix et
   aucune baisse ne serait jamais visible.
8. **Un seul chemin d'identification.** Le déclencheur et le choix d'une photo
   dans la galerie passent tous deux par `_identifier` : deux chemins
   divergeraient au premier changement d'invite ou de compression.
9. **Une alerte s'acquitte, et l'acquittement porte un prix.** Un objet acquitté
   à 80 € ne resignale qu'en passant sous 80 €. Sans cela, la même alerte
   revient à chaque ouverture, on apprend à ne plus la voir, et la suivante —
   la vraie — passe inaperçue.
10. **L'échelle en réalité augmentée est fixe** (`ArScale.fixed`). La fonction
   répond à « est-ce que ça rentre » : laisser agrandir au doigt donnerait une
   réponse fausse et rassurante.
11. **La caméra est libérée à la mise en pause.** Sur Android, le capteur est
   une ressource exclusive : la garder en arrière-plan empêche les autres
   applications de l'ouvrir, et nous met nous-mêmes en échec au retour.
12. **La photo est réduite hors du fil principal.** `ImageCompressor` passe par
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
- **`AsyncValue.when` cache les erreurs.** Un état peut être « en chargement »
  **et** porter une erreur : `when` teste le chargement en premier, donc
  l'erreur n'apparaît jamais. Passer par `render` (`core/utils/async_view.dart`),
  qui met l'erreur d'abord. Avant cette correction, une caméra refusée faisait
  tourner un indicateur indéfiniment au lieu d'expliquer quoi faire.
- **Riverpod réessaie tout seul un provider en échec**, en doublant l'attente.
  Bon pour un appel réseau, mauvais pour ce qui ne se débloque que par un geste
  de l'utilisateur : la reprise en boucle maintient l'état en « chargement ».
  `cameraSessionProvider` la désactive (`@Riverpod(retry: …)`) et laisse la
  reprise au bouton « Réessayer ».
- **Un provider `autoDispose` lu sans abonné est libéré aussitôt.** Deux
  `container.read` successifs repartent d'un état neuf, ce qui donne des tests
  qui « ne progressent jamais » sans message. Tenir un `container.listen`.
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
| `api_key_test.dart` | D'où vient la clé et laquelle gagne. |
| `demarrage_test.dart` | Le seul test qui monte `app.dart` : câblage du thème, de la locale et des surcharges. |
| `photo_galerie_test.dart` | Identifier une photo déjà prise, y compris quand la caméra ne s'ouvre pas. |
| `reponse_brute_test.dart` | L'appel à Gemini de bout en bout, réseau simulé. Le patron du faux `Dio` est là si un autre test en a besoin. |
| `contrat_invite_lecture_test.dart` | Le pacte entre le schéma de l'invite et la lecture du DTO : un champ ajouté d'un seul côté disparaîtrait en silence. |
| `requete_gemini_test.dart` | Ce qui part réellement vers Gemini, et l'égalité avec ce qu'enverrait `tool/banc_invite.dart`. |
| `diagnostic_reponse_test.dart` | La fidélité du diagnostic de `tool/lecture_fiche.dart` : ne rien signaler que le DTO accepte, ne rien taire de ce qu'il écarte. Un verdict inversé fait corriger le mauvais fichier. |

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
- **`pumpAndSettle` est inutilisable sur le viseur** : l'ouverture de la caméra
  n'aboutit jamais dans un test et son indicateur tourne sans fin. Avancer
  l'horloge à la main, et surcharger `cameraSessionProvider` pour atteindre
  l'écran d'échec.
- **Envelopper toute écriture Hive de préparation dans `tester.runAsync`.**
  Dans un test de widget, l'horloge est simulée et n'avance qu'aux `pump` : une
  écriture attendue directement dans le corps du test ne se termine jamais, et
  le test se fige **sans message** au bout de plusieurs minutes. Le symptôme
  est reconnaissable — « did not complete », puis « Cannot close sink while
  adding stream ».
- **La règle précédente vaut pour tout canal de plateforme, pas seulement Hive**
  — et le symptôme y est trompeur au lieu d'être bloquant. Un refus
  `MissingPluginException`, celui que rend `availableCameras()` sur une machine
  sans greffon, voyage par la **vraie** boucle d'événements : avancer l'horloge
  simulée ne le fait jamais arriver. L'écran reste donc sur son état d'attente,
  et le test conclut que la panne **n'est pas signalée** — alors qu'elle n'a
  simplement pas encore eu lieu. On part corriger un écran qui va bien.
  Mesuré le 31/08/2026 en éprouvant la sonde de reconnaissance.
- **Une boîte plus grande que la fenêtre de test déborde, et les positions
  relevées ne sont alors celles d'aucun écran réel.** Un `Center` autour d'un
  `SizedBox(420 × 900)` dans la fenêtre de test par défaut (800 × 600) a rendu
  un texte à `top: 456` là où le même écran, monté par
  `tester.binding.setSurfaceSize`, le pose à **606**. Le test lisait donc une
  géométrie qui n'existe nulle part, et concluait à un défaut absent. Pour
  toute assertion sur des positions : régler la surface, et rendre l'écran à sa
  taille — jamais l'enfermer dans une boîte. Mesuré le 03/09/2026 sur l'écran
  d'Accord.
- **Les clefs JSON de ML Kit ne portent pas le nom de leurs champs Dart.**
  `ImageLabel.fromJson` lit `json['text']`, **pas** `json['label']` ; et
  `InputImage.toJson` écrit le chemin sous `path`, **pas** `filePath` comme le
  nomme le champ. Une fausse réponse écrite avec le nom Dart rend des étiquettes
  vides et fait chercher le défaut dans l'adaptateur, qui est sain. Les deux
  clefs sont épinglées par un test dans `reconnaissance_mlkit_test.dart` :
  elles cassent en silence à la première montée de version.

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
- **Tout greffon qui touche à une ressource privée exige sa clé dans
  `ios/Runner/Info.plist`** — appareil photo, photothèque, position,
  micro. La politique de l'App Store la réclame par la seule présence du
  greffon, même quand le code ne demande jamais la permission. L'oubli ne se
  voit ni à l'analyse, ni aux tests, ni sur Android : il se découvre au rejet
  de la soumission. Ajouter un greffon, c'est lire son README avant de
  committer.
- Les surcharges de providers de `demarrage_test.dart` doublent celles de
  `main.dart`, qui n'est pas appelable depuis un test. Ajouter une boîte Hive
  sans les mettre à jour toutes les deux fait échouer le démarrage réel sans
  qu'aucun test ne bronche.
- **`AppConfig.geminiModel` est un alias (`gemini-flash-latest`), pas un
  numéro.** Google arrête ses modèles à date annoncée : la génération 1.5, sur
  laquelle l'application a pointé, répond déjà 404. Un modèle retiré ne dégrade
  rien, il fait échouer *tous* les scans d'un coup, sur tous les appareils, sans
  qu'une ligne du dépôt ait bougé — et la panne ressemble à un problème de
  réseau. L'alias supprime cette falaise au prix d'un comportement qui peut
  glisser quand Google avance la version ; c'est le bon côté du marché tant
  qu'une réponse douteuse se diagnostique en cinq secondes avec
  `tool/rejouer.dart`. Ne pas y substituer un numéro figé sans se donner un
  moyen d'apprendre l'extinction autrement que par un utilisateur. Filet :
  `ModelUnavailableException`. Ce qui est servi pour une clé :
  `dart run tool/banc_invite.dart --modeles`.
- Sans serveur, un prix ne peut bouger qu'au rescan. Ne pas ajouter de
  vocabulaire d'alerte de fond (« notification », « surveillance permanente ») :
  l'architecture ne le permet pas.

## Git

Messages de commit en français, à l'infinitif, décrivant l'intention plutôt
que le fichier touché — par exemple « Rendre visibles les alertes de prix déjà
enregistrées ».
