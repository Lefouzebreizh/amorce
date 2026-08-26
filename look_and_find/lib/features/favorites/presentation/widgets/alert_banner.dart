/// Le bandeau qui résume les baisses en attente, en tête de « Ma liste ».
///
/// Il porte un bouton « Vu » et non une simple croix : fermer sans acquitter
/// ferait réapparaître le même bandeau à la visite suivante, et l'alerte
/// deviendrait un élément de décor. Acquitter enregistre le prix du moment —
/// l'objet ne resignalera qu'en descendant encore.
library;

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../domain/entities/favorite.dart';

class AlertBanner extends StatelessWidget {
  const AlertBanner({
    super.key,
    required this.alerts,
    required this.onAcknowledge,
  });

  final List<Favorite> alerts;
  final VoidCallback onAcknowledge;

  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) return const SizedBox.shrink();

    final total = alerts.fold<double>(0, (sum, f) => sum + f.delta.abs());
    final currency = alerts.first.product.currency;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
      decoration: BoxDecoration(
        color: AppColors.gain.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          const Icon(Icons.trending_down_rounded, color: AppColors.gain),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  alerts.length == 1
                      ? 'Un objet est passé sous votre seuil'
                      : '${alerts.length} objets sont passés sous votre seuil',
                  style: context.texts.titleMedium?.copyWith(
                    color: AppColors.gain,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${Formatters.price(total, currency)} de moins qu\'à la mise en favori',
                  style: context.texts.bodySmall,
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: onAcknowledge,
            style: TextButton.styleFrom(foregroundColor: AppColors.gain),
            child: const Text('Vu'),
          ),
        ],
      ),
    );
  }
}
