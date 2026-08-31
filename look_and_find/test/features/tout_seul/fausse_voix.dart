/// La voix des tests : elle ne parle pas, elle note.
///
/// C'est la contrepartie du port `Voix` : puisque la présentation ne connaît
/// que l'interface, toute la chaîne — arrivée sur une étape, appui sur
/// « suivant », retour, sortie — se vérifie sans téléphone et sans moteur de
/// synthèse. Ce qui reste invérifiable ici est écrit en tête de `voix.dart` :
/// qu'une phrase sorte réellement du haut-parleur.
///
/// Le fichier ne se termine pas par `_test.dart` à dessein : `flutter test`
/// exécute tout fichier dont le nom finit ainsi, et celui-ci n'a pas de `main`.
library;

import 'package:look_and_find/features/tout_seul/domain/voix.dart';

class FausseVoix implements Voix {
  /// Tout ce qu'on a demandé de dire, dans l'ordre. C'est la seule trace qui
  /// permette d'affirmer qu'une étape a été annoncée à l'enfant.
  final List<String> dites = <String>[];

  int preparations = 0;
  int silences = 0;

  @override
  Future<void> preparer() async {
    preparations++;
  }

  @override
  Future<void> dire(String phrase) async {
    dites.add(phrase);
  }

  @override
  Future<void> taire() async {
    silences++;
  }
}
