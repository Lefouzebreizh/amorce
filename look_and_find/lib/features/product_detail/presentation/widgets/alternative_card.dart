/// Une alternative moins chère, en liste horizontale.
///
/// Ne sont affichées que celles réellement sous la meilleure offre (voir
/// `BestOffer.cheaperThanBest`). L'écart est écrit en clair — « 60 € de moins »
/// se compare instantanément, là où deux prix côte à côte demandent une
/// soustraction mentale à chaque carte.
library;

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../domain/entities/product.dart';

class AlternativeCard extends StatelessWidget {
  const AlternativeCard({
    super.key,
    required this.alternative,
    required this.currency,
    required this.reference,
  });

  final ProductAlternative alternative;
  final String currency;
  final double reference;

  @override
  Widget build(BuildContext context) {
    final gap = reference - alternative.price;

    return Container(
      width: 190,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.slab,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (alternative.brand != null)
                Text(
                  alternative.brand!.toUpperCase(),
                  style: context.texts.bodySmall?.copyWith(
                    fontSize: 11,
                    letterSpacing: 0.8,
                  ),
                ),
              const SizedBox(height: 4),
              Text(
                alternative.title,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: context.texts.bodyMedium,
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            Formatters.price(alternative.price, currency),
            style: context.texts.titleMedium,
          ),
          const SizedBox(height: 2),
          Text(
            '${Formatters.price(gap, currency)} de moins',
            style: const TextStyle(
              color: AppColors.gain,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
