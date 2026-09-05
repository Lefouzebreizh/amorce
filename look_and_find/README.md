# Look & Find

Photographiez un objet du quotidien, et sachez ce que c'est, de quoi il est
fait, et comment vous en servir.

L'application est écrite en Flutter (Dart 3), pour iOS et Android. Elle
n'embarque pas de serveur : la description passe par un appel direct à un
modèle multimodal, la couleur est mesurée sur le téléphone, et rien ne quitte
l'appareil hors la photo envoyée pour être décrite.

---

## Le parcours

1. **Viser.** L'application s'ouvre sur le viseur. Pas de page d'accueil : le
   geste qu'elle propose est à un appui de l'ouverture. Une photo déjà prise
   fait aussi bien l'affaire — utile quand l'objet a été vu ailleurs, quand la
   pièce est sombre, ou quand la caméra ne s'ouvre pas.
2. **Décrire.** La photo est réduite et envoyée au modèle, qui rend le nom
   courant de l'objet, sa catégorie, à quoi il sert, la matière apparente et ce
   qui se voit dessus. **Ni marque ni référence** : une catégorie suffit à
   choisir la notice, et c'est précisément la demande d'une référence exacte qui
   pousse un modèle de langage à en inventer une.
3. **Nommer la couleur.** Elle n'est pas demandée au modèle : elle est mesurée
   sur la photo, dans le cadre visé, et **dit quand elle hésite** — « rouge, ou
   blanc selon l'endroit visé » sur un pull bicolore. Un modèle répondrait
   « rose » avec le même aplomb, et personne ne pourrait le vérifier.
4. **Se servir de l'objet.** Quelques gestes utiles pour sa catégorie — usage,
   entretien, sécurité — numérotés pour se retrouver après avoir levé les yeux.

---

## Ce que la version un ne fait pas

Le comparateur de prix, le suivi des baisses et la projection en réalité
augmentée **sont écrits et testés**, et ne sont pas dans le parcours : ils
reviendront en version deux. Ce n'est pas un chantier inachevé mais un périmètre
choisi — une application qui décrit bien vaut mieux qu'une application qui
compare mal.

---

## Démarrer

```bash
flutter pub get
dart run build_runner build          # providers Riverpod générés
flutter run
```

**La clé n'est pas dans le dépôt, et n'a pas à y être.** Elle a deux origines
possibles, dans cet ordre :

1. **saisie dans l'application** — au premier lancement, ou plus tard depuis
   « Ma liste » ▸ 🔑 ;
2. **injectée au build** par `flutter run --dart-define=GEMINI_API_KEY=…`.

La saisie l'emporte, et ce n'est pas un détail de confort : une clé compilée
est une chaîne **en clair dans le binaire**, récupérable par qui obtient l'APK,
et sa rotation impose de tout reconstruire. Pouvoir la remplacer sans rebâtir
est la seule façon de réagir vite à une clé fuitée.

Sans aucune des deux, l'application démarre et explique quoi faire plutôt que
d'échouer devant l'utilisateur.

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

**La réponse brute reste consultable.** Quand une fiche affiche un prix
fantaisiste ou un marchand inventé, une seule question compte : le modèle l'a-t-il
dit, ou l'avons-nous mal lu ? La réponse décide de ce qu'il faut corriger —
l'invite ou la lecture. L'icône `{}` en tête de fiche montre ce que Gemini a
réellement renvoyé, et le bouton « Copier » sert au geste réel : coller cette
réponse dans une conversation pour faire corriger l'invite. Seule la dernière
est retenue, en mémoire, et elle ne survit pas à la fermeture — c'est assez pour
le moment où l'on s'en sert, et cela n'occupe pas le stockage.

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
Promettre une notification de fond serait mentir sur ce que l'architecture
permet. Chaque scan vaut donc relevé, et le prix de référence — celui du jour
de la mise en favori — reste figé pour que la baisse soit mesurable.

**Une alerte s'acquitte, et l'acquittement porte un prix.** Ce que le seuil
déclenche se voit sans ouvrir l'application en entier : une pastille sur le
bouton « Ma liste » du viseur. Mais un signal qui revient à chaque ouverture
cesse d'être lu — et c'est alors la suivante, la vraie, qui passe inaperçue.
« Vu » enregistre donc le prix du moment : l'objet ne resignale qu'en
descendant encore. Changer le seuil remet l'acquittement à zéro, puisqu'il
portait sur l'ancien.

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
| `alerts_test.dart` | Ce qui doit être signalé, et surtout ce qui doit se taire une fois acquitté. |
| `scan_controller_test.dart` | L'enchaînement complet d'un scan, réseau et caméra remplacés par surcharge de providers. |
| `product_detail_page_test.dart` | La fiche montée pour de vrai : hiérarchie des offres, alternatives filtrées, bascule du favori. |
| `favorites_page_test.dart` | « Ma liste » montée pour de vrai : bandeau d'alerte, cumul des baisses, acquittement. |
| `api_key_test.dart` | D'où vient la clé et laquelle gagne : la saisie l'emporte sur le build, et survit à un redémarrage. |
| `demarrage_test.dart` | L'application démarrée de bout en bout — le seul test qui couvre `app.dart` et le parcours « pas de clé → saisie → viseur ». |
| `photo_galerie_test.dart` | Identifier une photo déjà prise, y compris quand la caméra ne s'ouvre pas. |
| `reponse_brute_test.dart` | L'appel à Gemini de bout en bout, réseau simulé : la réponse est retenue même quand elle est inexploitable. |
| `requete_gemini_test.dart` | Ce qui **part** réellement vers Gemini : modèle visé, invite avant la photo, décodage contraint par le schéma. Le dernier maillon, qu'un faux `Dio` rendant une réponse toute faite ne regardait pas. |
| `contrat_invite_lecture_test.dart` | Le pacte entre le schéma de l'invite et la lecture du DTO : un champ ajouté d'un seul côté disparaîtrait en silence. |
| `fiche_objet_dto_test.dart` | Ce que la lecture de la fiche v1 encaisse : liste rendue en une phrase, « null » écrit en toutes lettres, clé absente. |
| `contrat_fiche_lecture_test.dart` | Le pacte de la version un — et le périmètre lui-même : l'invite doit continuer d'interdire marque et prix. |
| `fiche_objet_page_test.dart` | La fiche v1 montée pour de vrai, et ce qu'elle ne montre plus — ni « € », ni « Acheter ». |
| `diagnostic_reponse_test.dart` | La fidélité du diagnostic qui désigne le fichier à corriger — il décide entre l'invite et la lecture, et un verdict inversé coûte une correction au mauvais endroit. |

Ce qui ne peut pas être testé ainsi et demande un appareil : le décodage
caméra, la mise au point, la session de réalité augmentée, et la qualité
d'identification du modèle lui-même.

Ce dernier point est le seul inconnu qui reste, et il se lève en cinq minutes :
**[`ESSAI-APPAREIL.md`](ESSAI-APPAREIL.md)** dit quoi installer, quoi scanner,
ce qui compte comme réussite, et quoi renvoyer quand ça cloche. Entre-temps,
`tool/banc_invite.dart` éprouve l'invite depuis un terminal, sans appareil.

---

## Pièges connus

- La clé passe en paramètre d'URL ; l'intercepteur de trace la masque, mais une
  capture de trafic la verrait. Pour une mise en production, l'appel doit
  passer par un relais côté serveur.
- La clé saisie est rangée en clair dans le stockage privé de l'application.
  Les autres applications d'un téléphone non débridé n'y accèdent pas, et
  `android:allowBackup="false"` empêche sa remontée vers le nuage — mais un
  appareil débridé la lirait. Pour un secret de plus grande valeur, il faudrait
  le trousseau du système (`flutter_secure_storage`).
- Les photos sont écrites dans le dossier temporaire du système : une vignette
  d'historique peut disparaître alors que la fiche reste lisible. Les widgets
  d'image prévoient tous ce cas.
- L'historique est borné à soixante entrées ; au-delà, les plus anciennes sont
  supprimées à l'écriture.
- Dans un test de widget, une écriture Hive attendue hors de `tester.runAsync`
  ne se termine jamais : l'horloge y est simulée. Le test se fige sans message.
- Modifier le schéma de `gemini_prompt.dart` sans modifier `product_dto.dart`
  fait silencieusement disparaître un champ de la fiche : les deux se tiennent.
- `NumberFormat` en `fr_FR` fonctionne d'office, mais les **dates** demandent
  `initializeDateFormatting('fr_FR')` — l'oubli ne se voit qu'en production, à
  la première date d'historique.
