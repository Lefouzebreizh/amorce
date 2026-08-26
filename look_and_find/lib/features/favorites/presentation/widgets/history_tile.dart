/// Une ligne de l'historique : un objet déjà scanné, rouvert sans reprendre
/// de photo ni redépenser un appel au modèle.
///
/// La date relative est plus utile que l'heure exacte — « hier » situe le scan
/// dans le souvenir de l'utilisateur, « 14:32 » ne situe rien.
library;

import 'dart:io';

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../../product_detail/domain/entities/product.dart';
import '../../../product_detail/domain/usecases/best_offer.dart';

class HistoryTile extends StatelessWidget {
  const HistoryTile({super.key, required this.product, required this.onOpen});

  final Product product;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final price = BestOffer.of(product)?.price ?? product.averagePrice;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: SizedBox(
                  width: 46,
                  height: 46,
                  child: product.imagePath == null
                      ? const ColoredBox(color: AppColors.raised)
                      : Image.file(
                          File(product.imagePath!),
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) =>
                              const ColoredBox(color: AppColors.raised),
                        ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.displayTitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: context.texts.bodyMedium,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      product.capturedAt == null
                          ? product.category.label
                          : Formatters.relativeDate(product.capturedAt!),
                      style: context.texts.bodySmall,
                    ),
                  ],
                ),
              ),
              Text(
                Formatters.price(price, product.currency),
                style: context.texts.bodyMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
