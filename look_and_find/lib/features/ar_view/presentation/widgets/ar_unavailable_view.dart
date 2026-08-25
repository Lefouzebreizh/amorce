/// Ce qui remplace la scène 3D quand aucun modèle n'a été trouvé.
///
/// Un écran vide serait une impasse. Les cotes et le volume, eux, répondent
/// déjà à la question posée — « est-ce que ça rentre » — sans réalité
/// augmentée. Une comparaison familière (une porte fait 200 cm) fait le reste.
library;

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../../product_detail/domain/entities/product.dart';

class ArUnavailableView extends StatelessWidget {
  const ArUnavailableView({super.key, required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final dims = product.dimensions;

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.view_in_ar_outlined,
              size: 48,
              color: AppColors.muted,
            ),
            const SizedBox(height: 20),
            Text(
              AppStrings.arUnavailable,
              textAlign: TextAlign.center,
              style: context.texts.titleLarge,
            ),
            const SizedBox(height: 10),
            Text(
              AppStrings.arUnavailableBody,
              textAlign: TextAlign.center,
              style: context.texts.bodySmall,
            ),
            if (!dims.isEmpty) ...[
              const SizedBox(height: 26),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.slab,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  children: [
                    Text(
                      Formatters.dimensions(
                        width: dims.width,
                        height: dims.height,
                        depth: dims.depth,
                        unit: dims.unit,
                      ),
                      style: context.texts.titleMedium,
                    ),
                    if (dims.height != null && dims.height! > 0) ...[
                      const SizedBox(height: 6),
                      Text(
                        _doorComparison(dims.height!, dims.unit),
                        textAlign: TextAlign.center,
                        style: context.texts.bodySmall,
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// Une porte standard fait 200 cm : c'est le repère de hauteur que tout le
  /// monde a sous les yeux, et il évite d'avoir à se représenter un nombre.
  String _doorComparison(double height, String unit) {
    final cm = switch (unit) {
      'mm' => height / 10,
      'm' => height * 100,
      _ => height,
    };
    final ratio = cm / 200;
    if (ratio >= 0.95) return 'presque la hauteur d\'une porte';
    return 'environ ${(ratio * 100).round()} % de la hauteur d\'une porte';
  }
}
