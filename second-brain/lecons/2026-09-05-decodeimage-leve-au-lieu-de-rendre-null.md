# `decodeImage` lève au lieu de rendre `null`, et un registre plausible est faux

*05/09/2026 — trouvé en posant la fiche v1 de Look & Find.*

## Ce qui a été mesuré

**`img.decodeImage` (package `image`, Dart) lève un `RangeError` sur des octets
qui ne sont pas une image**, au lieu de rendre `null` comme sa signature
nullable le laisse croire. Il essaie les décodeurs l'un après l'autre, et celui
du PSD lit deux octets au-delà de la fin d'un tampon trop court **avant** d'avoir
pu conclure que ce n'est pas un PSD :

```
RangeError (length): Invalid value: Not in inclusive range 0..3: 4
  InputBuffer.readUint16 · PsdImage._readHeader · PsdDecoder.isValidFile
  findDecoderForData · decodeImage
```

Quatre octets suffisent à le déclencher. Un appelant qui écrit
`final image = decodeImage(bytes); if (image == null) return null;` croit avoir
traité le cas d'échec et ne l'a pas traité.

Conséquence réelle avant correction : une photo tronquée ne coûtait pas la
couleur de l'objet, elle faisait échouer **toute** la description — la partie que
le modèle avait pourtant rendue correctement.

## Ce qui a coûté un aller-retour

**Un `RichText` est invisible à `find.text` et à `find.textContaining`** dans un
test de widget. Les chercheurs de texte regardent les widgets `Text` ; un
`RichText` composé de `TextSpan` ne leur répond pas, et l'assertion échoue en
disant « 0 widget trouvé » alors que le texte est bien à l'écran.

La parade n'est pas `findRichText: true` mais de ne pas en écrire : deux `Text`
côte à côte se lisent séparément — par un test comme par une synthèse vocale,
qui restitue mal une suite de fragments stylés.

## Ce qui rendait une phrase du dépôt fausse

Le registre des accents du `CLAUDE.md` racine (§2 bis) donnait `look_and_find`
pour une « appli enfants, thème chaud clair ». Son `app.dart` monte
`AppTheme.dark` depuis toujours, sur des surfaces à `#0B0D10`. Le thème clair
existe dans ce projet, mais il appartient à `tout_seul` — **une fonctionnalité
parmi sept**.

La ligne n'était pas périmée : elle avait toujours été fausse, et sa
plausibilité l'a protégée de la vérification pendant des jours. D'où la règle,
qui vaut pour tout le registre : **une entrée de couleur se relit contre le code
qui la pose**, jamais contre l'idée qu'on a du produit. Le geste tient en un
`grep` sur le thème monté par `app.dart` ou sur les jetons du projet.

Même famille que le défaut d'Artisan Express noté le 03/09 — une mesure juste
sur le mauvais objet — mais un cran plus discret : ici il n'y avait pas de
mesure du tout, seulement une description qui sonnait vrai.
