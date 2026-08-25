/// Une ligne du comparateur.
///
/// Trois informations, dans l'ordre où elles se décident : chez qui, à quel
/// prix, et est-ce disponible. La rupture est écrite en toutes lettres et la
/// ligne est estompée — un badge coloré de plus au milieu des promotions se
/// lirait comme une mise en avant.
library;

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../domain/entities/product.dart';

class MerchantTile extends StatelessWidget {
  const MerchantTile({
    super.key,
    required this.merchant,
    required this.currency,
    required this.isBest,
    required this.onOpen,
  });

  final Merchant merchant;
  final String currency;
  final bool isBest;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    final dimmed = !merchant.inStock;

    return Opacity(
      opacity: dimmed ? 0.55 : 1,
      child: Material(
        color: AppColors.slab,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onOpen,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            constraints: const BoxConstraints(
              minHeight: AppTheme.minTouchTarget + 12,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              // La bordure ne sert qu'à désigner la meilleure offre : partout
              // ailleurs, la surface suffit à séparer les lignes.
              border: isBest
                  ? Border.all(color: AppColors.gain, width: 1.5)
                  : null,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(merchant.name, style: context.texts.titleMedium),
                      const SizedBox(height: 3),
                      Text(
                        merchant.inStock
                            ? (merchant.hasDiscount
                                  ? 'En stock · ${merchant.discount}'
                                  : 'En stock')
                            : AppStrings.outOfStock,
                        style: context.texts.bodySmall?.copyWith(
                          color: merchant.hasDiscount && merchant.inStock
                              ? AppColors.gain
                              : AppColors.muted,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  Formatters.price(merchant.price, currency),
                  style: context.texts.titleMedium?.copyWith(
                    color: isBest ? AppColors.gain : AppColors.text,
                  ),
                ),
                if (onOpen != null) ...[
                  const SizedBox(width: 6),
                  const Icon(
                    Icons.open_in_new_rounded,
                    size: 17,
                    color: AppColors.muted,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
