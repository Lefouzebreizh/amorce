/// Mise en forme des prix et des dimensions.
///
/// Le prix est le chiffre que l'utilisateur compare d'un coup d'œil entre six
/// marchands : il doit toujours s'écrire pareil. `intl` avec la locale `fr_FR`
/// donne l'espace insécable avant le symbole et la virgule décimale, ce qu'un
/// `toStringAsFixed(2)` suivi d'un `+ ' €'` ne donne pas.
library;

import 'package:intl/intl.dart';

class Formatters {
  const Formatters._();

  static final Map<String, NumberFormat> _cache = {};

  static NumberFormat _currency(String code) => _cache.putIfAbsent(
    code,
    () => NumberFormat.simpleCurrency(locale: 'fr_FR', name: code),
  );

  static String price(double value, String currency) =>
      _currency(currency).format(value);

  /// Écart affiché comme une économie : toujours signé, jamais négatif à
  /// l'écran (« -20 € » et « 20 € d'économie » ne se lisent pas pareil).
  static String saving(double amount, String currency) =>
      '${_currency(currency).format(amount.abs())} d\'économie';

  /// L'espace avant le signe pour cent est **insécable** : c'est la règle
  /// typographique française. Il est écrit en échappement et non en caractère
  /// brut, sinon il reste invisible à la relecture d'un diff — et un jour
  /// quelqu'un le remplace par une espace ordinaire sans le voir.
  static String percent(double ratio) =>
      '${(ratio * 100).round()}\u00A0%';

  /// « 80 × 75 × 80 cm ». Les dimensions manquantes sont omises plutôt
  /// qu'affichées à zéro : un « 0 cm » se lit comme une mesure, pas comme un
  /// trou dans la réponse du modèle.
  static String dimensions({
    double? width,
    double? height,
    double? depth,
    String unit = 'cm',
  }) {
    final parts = [
      width,
      height,
      depth,
    ].where((v) => v != null && v > 0).map(_number).toList();
    if (parts.isEmpty) return '';
    return '${parts.join(' × ')} $unit';
  }

  static String _number(double? v) {
    final value = v!;
    return value == value.roundToDouble()
        ? value.round().toString()
        : value.toStringAsFixed(1).replaceAll('.', ',');
  }

  static String relativeDate(DateTime date) {
    final delta = DateTime.now().difference(date);
    if (delta.inMinutes < 1) return 'à l\'instant';
    if (delta.inHours < 1) return 'il y a ${delta.inMinutes} min';
    if (delta.inDays < 1) return 'il y a ${delta.inHours} h';
    if (delta.inDays == 1) return 'hier';
    if (delta.inDays < 7) return 'il y a ${delta.inDays} jours';
    return DateFormat('d MMMM', 'fr_FR').format(date);
  }
}
