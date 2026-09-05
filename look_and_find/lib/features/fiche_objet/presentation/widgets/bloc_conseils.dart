/// La notice condensée : quelques gestes utiles pour la catégorie d'objet.
///
/// **Numérotée, et c'est le seul endroit de la fiche qui l'est.** Une liste à
/// puces se parcourt du regard ; une liste numérotée se suit. Ces conseils
/// s'appliquent en tenant l'objet, souvent d'une main, et le numéro sert à
/// retrouver où l'on en était après avoir levé les yeux.
///
/// L'accent `action` les désigne, parce que c'est exactement ce qu'ils sont :
/// ce qu'il y a à faire.
library;

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/extensions.dart';

class BlocConseils extends StatelessWidget {
  const BlocConseils({super.key, required this.conseils});

  final List<String> conseils;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Bons gestes',
          style: context.texts.titleSmall?.copyWith(color: AppColors.muted),
        ),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          decoration: BoxDecoration(
            color: AppColors.slab,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            children: [
              for (final (index, conseil) in conseils.indexed)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 24,
                        child: Text(
                          '${index + 1}.',
                          style: context.texts.bodyLarge?.copyWith(
                            color: AppColors.action,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      Expanded(
                        child: Text(conseil, style: context.texts.bodyLarge),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
