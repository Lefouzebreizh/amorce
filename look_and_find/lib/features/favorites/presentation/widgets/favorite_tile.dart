/// Une ligne de la liste des favoris.
///
/// Elle montre le prix **et** son mouvement depuis la mise en favori : sans
/// l'écart, la liste ne serait qu'un marque-page, alors que c'est le suivi de
/// prix qui justifie de l'ouvrir. Une baisse s'affiche en [AppColors.gain],
/// une hausse en gris et non en rouge — la hausse est une information, pas une
/// alerte.
library;

import 'dart:io';

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../domain/entities/favorite.dart';

class FavoriteTile extends StatelessWidget {
  const FavoriteTile({
    super.key,
    required this.favorite,
    required this.onOpen,
    required this.onAlert,
    required this.onRemove,
  });

  final Favorite favorite;
  final VoidCallback onOpen;
  final VoidCallback onAlert;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final product = favorite.product;
    final delta = favorite.delta;

    return Dismissible(
      key: ValueKey(product.id),
      direction: DismissDirection.endToStart,
      onDismissed: (_) => onRemove(),
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 22),
        decoration: BoxDecoration(
          color: AppColors.alert.withValues(alpha: 0.18),
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Icon(Icons.delete_outline_rounded, color: AppColors.alert),
      ),
      child: Material(
        color: AppColors.slab,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onOpen,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                _Thumb(path: product.imagePath),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        product.displayTitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: context.texts.bodyMedium,
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Text(
                            Formatters.price(
                              favorite.currentPrice,
                              product.currency,
                            ),
                            style: context.texts.titleMedium?.copyWith(
                              color: favorite.hasDropped
                                  ? AppColors.gain
                                  : AppColors.text,
                            ),
                          ),
                          const SizedBox(width: 8),
                          if (delta.abs() > 0.01)
                            Text(
                              favorite.hasDropped
                                  ? '−${Formatters.price(delta.abs(), product.currency)}'
                                  : '+${Formatters.price(delta, product.currency)}',
                              style: context.texts.bodySmall?.copyWith(
                                color: favorite.hasDropped
                                    ? AppColors.gain
                                    : AppColors.muted,
                              ),
                            ),
                        ],
                      ),
                      if (favorite.alertThreshold != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          'Alerte sous ${Formatters.price(favorite.alertThreshold!, product.currency)}',
                          style: context.texts.bodySmall?.copyWith(
                            color: favorite.reachedThreshold
                                ? AppColors.gain
                                : AppColors.muted,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Régler l\'alerte prix',
                  onPressed: onAlert,
                  icon: Icon(
                    favorite.alertThreshold == null
                        ? Icons.notifications_none_rounded
                        : Icons.notifications_active_rounded,
                    color: favorite.alertThreshold == null
                        ? AppColors.muted
                        : AppColors.action,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Thumb extends StatelessWidget {
  const _Thumb({required this.path});

  final String? path;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        width: 60,
        height: 60,
        child: path == null
            ? const ColoredBox(color: AppColors.raised)
            : Image.file(
                File(path!),
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) =>
                    const ColoredBox(color: AppColors.raised),
              ),
      ),
    );
  }
}
