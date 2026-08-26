/// Raccourcis d'accès au thème et aux messages, pour que les widgets restent
/// lisibles. Rien d'astucieux ici : uniquement ce qui revient partout.
library;

import 'package:flutter/material.dart';

extension BuildContextX on BuildContext {
  ThemeData get theme => Theme.of(this);
  TextTheme get texts => Theme.of(this).textTheme;
  ColorScheme get colors => Theme.of(this).colorScheme;

  /// La zone sûre du bas varie du simple au triple entre un iPhone à encoche
  /// et un Android à boutons : les barres d'action s'en servent au lieu d'une
  /// marge fixe qui serait fausse partout.
  double get bottomInset => MediaQuery.viewPaddingOf(this).bottom;

  void snack(String message, {bool isError = false}) {
    ScaffoldMessenger.of(this)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          behavior: SnackBarBehavior.floating,
          backgroundColor: isError ? Theme.of(this).colorScheme.error : null,
        ),
      );
  }
}

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
