/// Le bloc de prix, en tête de fiche.
///
/// C'est la donnée pour laquelle l'utilisateur a pris la photo : elle est la
/// seule de l'écran à passer en `displaySmall`, et la seule à porter la couleur
/// [AppColors.gain]. Le prix moyen apparaît barré à côté, en petit — un repère,
/// pas une concurrence visuelle.
///
/// L'économie n'est affichée que si elle existe vraiment (voir
/// `BestOffer.savingAgainstAverage`) : un bandeau « 0 € d'économie » discrédite
/// tout le comparateur.
library;

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../domain/entities/product.dart';
import '../../domain/usecases/best_offer.dart';

class PriceHeader extends StatelessWidget {
  const PriceHeader({super.key, required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final best = BestOffer.of(product);
    final saving = BestOffer.savingAgainstAverage(product);
    final price = best?.price ?? product.averagePrice;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          best == null ? AppStrings.averagePrice : AppStrings.bestOffer,
          style: context.texts.bodySmall,
        ),
        const SizedBox(height: 6),
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Flexible(
              child: Text(
                Formatters.price(price, product.currency),
                style: context.texts.displaySmall?.copyWith(
                  color: saving != null ? AppColors.gain : AppColors.text,
                ),
              ),
            ),
            if (best != null && product.averagePrice > price) ...[
              const SizedBox(width: 12),
              Text(
                Formatters.price(product.averagePrice, product.currency),
                style: context.texts.bodySmall?.copyWith(
                  decoration: TextDecoration.lineThrough,
                ),
              ),
            ],
          ],
        ),
        if (best != null) ...[
          const SizedBox(height: 8),
          Text('chez ${best.name}', style: context.texts.bodySmall),
        ],
        if (saving != null) ...[
          const SizedBox(height: 14),
          _SavingBadge(
            label: Formatters.saving(saving, product.currency),
            ratio: saving / product.averagePrice,
          ),
        ],
      ],
    );
  }
}

class _SavingBadge extends StatelessWidget {
  const _SavingBadge({required this.label, required this.ratio});

  final String label;
  final double ratio;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: AppColors.gain.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.trending_down_rounded, size: 16, color: AppColors.gain),
          const SizedBox(width: 8),
          Text(
            '$label · ${Formatters.percent(ratio)}',
            style: const TextStyle(
              color: AppColors.gain,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
