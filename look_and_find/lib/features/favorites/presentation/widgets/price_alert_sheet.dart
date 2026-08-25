/// Réglage du seuil d'alerte d'un favori.
///
/// Le seuil est proposé **sous** le prix actuel (–10 % par défaut) : un seuil
/// au-dessus du prix du jour déclencherait l'alerte immédiatement et pour
/// toujours, ce qui la rendrait inutile dès la première fois.
///
/// Un curseur plutôt qu'un champ de saisie : on choisit ici une intention
/// (« quand ça baisse vraiment »), pas un montant au centime. Le clavier
/// numérique demanderait trois gestes de plus pour une précision dont personne
/// ne se sert.
library;

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../domain/entities/favorite.dart';

class PriceAlertSheet extends StatefulWidget {
  const PriceAlertSheet({super.key, required this.favorite});

  final Favorite favorite;

  /// Renvoie le seuil choisi, ou `null` si l'utilisateur a retiré l'alerte.
  /// La distinction avec « annulé » se fait sur le booléen de premier rang.
  static Future<(bool changed, double? threshold)> show(
    BuildContext context,
    Favorite favorite,
  ) async {
    final result = await showModalBottomSheet<(bool, double?)>(
      context: context,
      isScrollControlled: true,
      builder: (_) => PriceAlertSheet(favorite: favorite),
    );
    return result ?? (false, favorite.alertThreshold);
  }

  @override
  State<PriceAlertSheet> createState() => _PriceAlertSheetState();
}

class _PriceAlertSheetState extends State<PriceAlertSheet> {
  late double _threshold =
      widget.favorite.alertThreshold ?? widget.favorite.currentPrice * 0.9;

  double get _current => widget.favorite.currentPrice;

  /// La borne basse est à la moitié du prix : en dessous, l'alerte ne se
  /// déclenchera jamais sur un produit neuf, et le curseur perdrait toute sa
  /// précision utile sur les dix derniers pour cent.
  double get _min => _current * 0.5;

  @override
  Widget build(BuildContext context) {
    final currency = widget.favorite.product.currency;
    final drop = _current - _threshold;

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        bottom: 20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(AppStrings.priceAlert, style: context.texts.titleLarge),
          const SizedBox(height: 6),
          Text(AppStrings.priceAlertBody, style: context.texts.bodySmall),
          const SizedBox(height: 24),
          Text(
            Formatters.price(_threshold, currency),
            textAlign: TextAlign.center,
            style: context.texts.displaySmall?.copyWith(color: AppColors.gain),
          ),
          const SizedBox(height: 4),
          Text(
            'soit ${Formatters.price(drop, currency)} sous le prix actuel',
            textAlign: TextAlign.center,
            style: context.texts.bodySmall,
          ),
          const SizedBox(height: 12),
          Slider(
            value: _threshold.clamp(_min, _current),
            min: _min,
            max: _current,
            onChanged: (value) => setState(() => _threshold = value),
          ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: () => Navigator.of(context).pop((true, _threshold)),
            child: const Text('Activer l\'alerte'),
          ),
          if (widget.favorite.alertThreshold != null) ...[
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => Navigator.of(context).pop((true, null)),
              child: const Text('Retirer l\'alerte'),
            ),
          ],
        ],
      ),
    );
  }
}
