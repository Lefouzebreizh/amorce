/// Le seul raccourci de collection dont le dépôt se sert, isolé du reste.
///
/// **Pourquoi un fichier à part.** `extensions.dart` importe
/// `flutter/material` pour ses raccourcis de thème ; le `domain` qui n'a besoin
/// que de `firstWhereOrNull` héritait de cette dépendance, ce qui contredit sa
/// règle — « immuable et sans dépendance à Flutter » — et rendait toute
/// exécution hors Flutter impossible, y compris pour les outils de `tool/`.
/// `extensions.dart` réexporte ce fichier : rien ne change côté widgets.
library;

extension IterableX<T> on Iterable<T> {
  /// `firstWhere` sans exception : le cas « aucun marchand en stock » est
  /// normal, il ne mérite pas un try/catch à chaque appel.
  T? firstWhereOrNull(bool Function(T element) test) {
    for (final element in this) {
      if (test(element)) return element;
    }
    return null;
  }
}
