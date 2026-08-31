/// Le moteur des tests : il ne regarde rien, il note ce qu'on lui a montré.
///
/// Contrepartie du port `Reconnaissance`, exactement comme `FausseVoix` l'est du
/// port `Voix`. Ce qu'elle rend permet d'éprouver toute la sonde — la boucle,
/// l'affichage, la copie, la panne — sans appareil photo et sans moteur natif.
///
/// Ce qu'elle ne remplace pas : la mesure elle-même. Aucune fausse
/// reconnaissance ne dira jamais ce que ML Kit répond devant un vrai lacet ;
/// c'est le propos de la sonde, et cela ne se lit que sur un téléphone.
///
/// Le fichier ne se termine pas par `_test.dart` à dessein : `flutter test`
/// exécute tout fichier dont le nom finit ainsi, et celui-ci n'a pas de `main`.
library;

import 'package:look_and_find/features/tout_seul/domain/reconnaissance.dart';

class FausseReconnaissance implements Reconnaissance {
  FausseReconnaissance({this.parChemin, this.partout, this.leve});

  /// Ce qu'elle rend pour une image donnée. C'est ce qui permet de prouver que
  /// deux lectures successives regardent bien deux images différentes.
  final Map<String, List<EtiquetteVue>>? parChemin;

  /// Ce qu'elle rend pour toutes les autres.
  final List<EtiquetteVue>? partout;

  /// De quoi éprouver la panne : un moteur qui refuse.
  final Object? leve;

  /// Les chemins observés, dans l'ordre.
  final List<String> observes = <String>[];

  int liberations = 0;

  @override
  Future<List<EtiquetteVue>> observer(String cheminImage) async {
    observes.add(cheminImage);
    final panne = leve;
    if (panne != null) throw panne;
    return parChemin?[cheminImage] ?? partout ?? const <EtiquetteVue>[];
  }

  @override
  Future<void> liberer() async {
    liberations++;
  }
}
