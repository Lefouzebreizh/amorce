/// Le cœur de mise en favori, utilisable depuis n'importe quelle fiche.
///
/// Il vit dans `favorites` et non dans `product_detail` : c'est la
/// fonctionnalité « suivi » qui sait ce que suivre veut dire. La fiche
/// l'affiche, elle n'a pas à connaître le dépôt ni le seuil d'alerte.
///
/// Après une mise en favori, la proposition de seuil arrive dans un message
/// **facultatif** plutôt que dans une fenêtre : la plupart des gens veulent
/// juste garder l'objet sous la main, et une modale à chaque cœur ferait
/// abandonner la fonction.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/result.dart';
import '../../../product_detail/domain/entities/product.dart';
import '../providers/favorites_providers.dart';
import 'price_alert_sheet.dart';

class FavoriteButton extends ConsumerWidget {
  const FavoriteButton({super.key, required this.product});

  final Product product;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isFavorite = ref.watch(isFavoriteProvider(product.id));

    return IconButton(
      tooltip: isFavorite ? 'Retirer de ma liste' : 'Suivre le prix',
      onPressed: () => _toggle(context, ref, isFavorite),
      icon: Icon(
        isFavorite ? Icons.favorite_rounded : Icons.favorite_border_rounded,
        color: isFavorite ? AppColors.alert : AppColors.text,
      ),
    );
  }

  Future<void> _toggle(
    BuildContext context,
    WidgetRef ref,
    bool wasFavorite,
  ) async {
    final result = await ref.read(toggleFavoriteProvider).call(product);
    if (!context.mounted) return;

    switch (result) {
      case Failure(:final error):
        context.snack(error.message, isError: true);

      case Success(value: final nowFavorite):
        if (!nowFavorite) {
          context.snack('Retiré de ma liste');
          return;
        }
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(
              content: const Text('Ajouté à ma liste. Le prix sera suivi.'),
              behavior: SnackBarBehavior.floating,
              action: SnackBarAction(
                label: 'Alerte',
                onPressed: () => _openAlertSheet(context, ref),
              ),
            ),
          );
    }
  }

  Future<void> _openAlertSheet(BuildContext context, WidgetRef ref) async {
    final favorite = ref.read(favoritesRepositoryProvider).find(product.id);
    if (favorite == null || !context.mounted) return;

    final (changed, threshold) = await PriceAlertSheet.show(context, favorite);
    if (!changed) return;

    await ref
        .read(favoritesRepositoryProvider)
        .save(
          favorite.copyWith(
            alertThreshold: threshold,
            clearThreshold: threshold == null,
          ),
        );
  }
}
