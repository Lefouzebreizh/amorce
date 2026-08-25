# Look & Find

Photographiez un objet du quotidien, retrouvez-le au meilleur prix, et posez-le
chez vous en réalité augmentée avant de l'acheter.

L'application est écrite en Flutter (Dart 3), pour iOS et Android. Elle
n'embarque pas de serveur : l'identification passe par un appel direct à un
modèle multimodal, et tout le reste — favoris, historique, suivi de prix — vit
sur le téléphone.

---

## Le parcours

1. **Viser.** L'application s'ouvre sur le viseur. Pas de page d'accueil : le
   geste qu'elle propose est à un appui de l'ouverture.
2. **Identifier.** La photo est réduite, envoyée au modèle, et revient en fiche
   produit structurée : nom, marque, catégorie, prix moyen, dimensions,
   marchands, alternatives moins chères.
3. **Comparer.** Le comparateur met en avant **le moins cher parmi les
   marchands en stock**, et dit ce que cela fait économiser contre le prix
   moyen constaté.
4. **Essayer.** « Voir chez moi » pose le modèle 3D dans la pièce, à l'échelle
   1:1 — la fonction répond à « est-ce que ça rentre », pas « est-ce que c'est
   joli ». Sans modèle 3D, les cotes et le volume prennent le relais.
5. **Suivre.** Un cœur met l'objet dans la liste et fige le prix du jour. Chaque
   nouveau scan du même objet vaut relevé de prix, et signale la baisse.

---

## Démarrer

```bash
flutter pub get
dart run build_runner build          # providers Riverpod générés
flutter run --dart-define=GEMINI_API_KEY=votre_clé
```

**La clé n'est pas dans le dépôt, et n'a pas à y être.** Elle est injectée au
build par `--dart-define`. Sans elle, l'application démarre et explique quoi
faire plutôt que d'échouer devant l'utilisateur.

Obtenir une clé : [Google AI Studio](https://aistudio.google.com/apikey).

### Vérifier

```bash
flutter analyze
flutter test
dart run build_runner watch          # pendant le développement
```

---

## Architecture

Clean Architecture par fonctionnalité. Chaque fonctionnalité porte ses trois
couches ; `core/` ne contient que ce qui est réellement transverse.

```text
lib/
├── core/
│   ├── constants/       # configuration, palette, textes
│   ├── network/         # client Dio, intercepteurs, échecs typés
│   ├── theme/           # thème unique, sombre
│   └── utils/           # Result, mise en forme, compression d'image
├── features/
│   ├── scanner/         # viseur, capture, appel au modèle
│   ├── product_detail/  # fiche, comparateur, alternatives
│   ├── ar_view/         # projection 3D et ancrage
│   └── favorites/       # stockage local, historique, alertes
├── app.dart             # thème, langue, écran d'entrée
└── main.dart            # ouverture des boîtes, surcharges, démarrage
```

### La règle de dépendance entre fonctionnalités

`product_detail` est propriétaire de la notion de produit. Tout le monde
importe son `domain` (et le DTO qui le sérialise) ; **il n'importe personne**.
Concrètement :

- `data` et `domain` d'une fonctionnalité n'importent jamais le `data` ni la
  `presentation` d'une autre ;
- la `presentation` peut importer la `presentation` d'une autre uniquement
  pour naviguer vers son écran, ou pour un composant explicitement partagé
  (`FavoriteButton`, qui appartient au suivi et non à la fiche).

Sans cette direction unique, les quatre fonctionnalités finiraient par se
référencer en cercle et plus aucune ne serait extractible.

---

## Décisions et ce qu'elles coûtent

**Sortie JSON contrainte plutôt qu'extraction de texte.** L'appel passe un
`responseSchema` avec `responseMimeType: application/json` : le décodage du
modèle est contraint, il ne peut plus produire de préambule ni de bloc de code.
Cela remplace une extraction par expression régulière, qui finit toujours par
se tromper sur un texte contenant une accolade. Le schéma est dans
`gemini_prompt.dart`, à côté de l'invite qu'il complète.

**Une lecture tolérante, un seul champ fatal.** Un modèle renvoie « 149,99 »,
`"149.99"`, `null` ou omet la clé, selon la photo. `ProductDto` ne lève sur
aucun champ : un marchand illisible est écarté, les six autres sont conservés.
Seule l'absence de titre fait échouer l'analyse — sans nom d'objet, il n'y a
pas de fiche à montrer.

**Un seul DTO pour le réseau et pour le disque.** Deux formats séparés
obligeraient à migrer la base à chaque champ ajouté à la fiche. Ici, la boîte
Hive contient les mêmes chaînes JSON, relues par le même parseur tolérant : un
favori enregistré hier se relit avec le code d'aujourd'hui. C'est aussi
pourquoi il n'y a **pas** de `TypeAdapter` généré.

**`model_viewer_plus` plutôt que `arkit_plugin` / `arcore_flutter_plugin`.**
Le placement est délégué à Scene Viewer (Android) et Quick Look (iOS) —
c'est-à-dire aux composants système qui gèrent seuls la détection de plan,
l'ancrage et l'occlusion, et que l'utilisateur connaît déjà. Ce que cela coûte :
on ne peut rien dessiner par-dessus la scène AR (pas de cotes flottantes, pas
de mesure). Et Quick Look ne lit que le `.usdz` : un objet dont
l'identification n'a renvoyé qu'un `.glb` est consultable en 3D sur iPhone,
mais pas posable dans la pièce. L'interface le dit, plutôt que de laisser un
bouton inactif.

**L'échelle AR est fixe.** L'intérêt de la fonction est de répondre à « est-ce
que ça rentre » : laisser agrandir le meuble au doigt donnerait une réponse
fausse et rassurante.

**Le suivi de prix se met à jour au rescan, et rien d'autre.** Sans serveur,
personne ne peut interroger les marchands pendant que le téléphone dort.
Promettre une alerte de fond serait mentir sur ce que l'architecture permet.
Chaque scan vaut donc relevé, et le prix de référence — celui du jour de la
mise en favori — reste figé pour que la baisse soit mesurable.

**La photo est réduite à 1024 px avant l'envoi.** Un cliché de capteur pèse 3 à
5 Mo : sur réseau mobile, c'est cinq à dix secondes d'attente **avant** que
l'inférence commence, pour une précision identique. La compression se fait dans
un isolat, sinon elle fait sauter des images juste au moment où l'utilisateur
attend le retour du déclencheur.

**La caméra est libérée à la mise en pause.** Sur Android, le capteur est une
ressource exclusive : la garder en arrière-plan empêche les autres applications
de l'ouvrir, et nous met nous-mêmes en échec au retour.

**Deux accents, deux rôles.** Le violet désigne l'action à faire, le vert
désigne uniquement l'argent économisé. Un accent qui sert à deux choses ne
signale plus rien.

---

## Ce qui est testé, et ce qui ne peut pas l'être

`flutter test` couvre ce qui se décide hors appareil :

| Fichier | Ce qu'il verrouille |
| --- | --- |
| `product_dto_test.dart` | Les formes réellement renvoyées par un modèle : prix à virgule, « null » écrit en toutes lettres, marchand incomplet, URL inventée, identifiant stable d'un scan à l'autre. |
| `best_offer_test.dart` | La règle du comparateur — le moins cher **en stock** — et le fait qu'une alternative plus chère ne soit jamais proposée. |
| `favorite_test.dart` | Ce qui compte comme une baisse, et ce qui déclenche l'alerte. |
| `app_exception_test.dart` | La traduction des échecs réseau, et lesquels méritent un bouton « Réessayer ». |
| `formatters_test.dart` | Cotes manquantes omises plutôt qu'affichées à zéro ; conversion du volume. |
| `ar_model_test.dart` | Ce que le format du modèle autorise, plateforme par plateforme. |
| `scan_controller_test.dart` | L'enchaînement complet d'un scan, réseau et caméra remplacés par surcharge de providers. |
| `product_detail_page_test.dart` | La fiche montée pour de vrai : hiérarchie des offres, alternatives filtrées, bascule du favori. |

Ce qui ne peut pas être testé ainsi et demande un appareil : le décodage
caméra, la mise au point, la session de réalité augmentée, et la qualité
d'identification du modèle lui-même.

---

## Pièges connus

- La clé passe en paramètre d'URL ; l'intercepteur de trace la masque, mais une
  capture de trafic la verrait. Pour une mise en production, l'appel doit
  passer par un relais côté serveur.
- Les photos sont écrites dans le dossier temporaire du système : une vignette
  d'historique peut disparaître alors que la fiche reste lisible. Les widgets
  d'image prévoient tous ce cas.
- L'historique est borné à soixante entrées ; au-delà, les plus anciennes sont
  supprimées à l'écriture.
- Modifier le schéma de `gemini_prompt.dart` sans modifier `product_dto.dart`
  fait silencieusement disparaître un champ de la fiche : les deux se tiennent.
- `NumberFormat` en `fr_FR` fonctionne d'office, mais les **dates** demandent
  `initializeDateFormatting('fr_FR')` — l'oubli ne se voit qu'en production, à
  la première date d'historique.
