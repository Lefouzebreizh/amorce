/// Les cotes de l'objet, et ce qu'elles représentent.
///
/// Le volume en litres est ajouté parce qu'un triplet « 80 × 75 × 80 cm » ne
/// dit rien à qui essaie d'imaginer l'encombrement dans son salon. C'est aussi
/// le seul repère qui reste quand aucun modèle 3D n'existe — d'où le renvoi
/// vers la réalité augmentée placé juste ici plutôt qu'en bas de fiche.
library;

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../domain/entities/product.dart';

class DimensionsCard extends StatelessWidget {
  const DimensionsCard({super.key, required this.product, this.onViewInAr});

  final Product product;
  final VoidCallback? onViewInAr;

  @override
  Widget build(BuildContext context) {
    final dims = product.dimensions;
    if (dims.isEmpty && onViewInAr == null) return const SizedBox.shrink();

    final litres = dims.litres;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.slab,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.straighten_rounded,
                size: 18,
                color: AppColors.muted,
              ),
              const SizedBox(width: 8),
              Text(AppStrings.dimensions, style: context.texts.bodySmall),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            dims.isEmpty
                ? 'Non communiquées'
                : Formatters.dimensions(
                    width: dims.width,
                    height: dims.height,
                    depth: dims.depth,
                    unit: dims.unit,
                  ),
            style: context.texts.titleMedium,
          ),
          if (litres != null && litres > 0) ...[
            const SizedBox(height: 4),
            Text(
              'soit environ ${litres.round()} litres d\'encombrement',
              style: context.texts.bodySmall,
            ),
          ],
          if (onViewInAr != null) ...[
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onViewInAr,
              icon: const Icon(Icons.view_in_ar_rounded, size: 20),
              label: const Text(AppStrings.seeInAr),
            ),
          ],
        ],
      ),
    );
  }
}
