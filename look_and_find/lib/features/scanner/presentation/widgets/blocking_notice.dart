/// Écran plein qui remplace le viseur quand celui-ci ne peut pas s'ouvrir :
/// accès caméra refusé, matériel absent, clé d'API manquante.
///
/// Une même mise en page pour ces trois cas, parce qu'ils partagent la même
/// forme — expliquer, puis proposer **le** geste qui débloque. Un message
/// d'erreur sans geste laisse l'utilisateur sur un écran noir.
library;

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/extensions.dart';

class BlockingNotice extends StatelessWidget {
  const BlockingNotice({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
    this.actionLabel,
    this.onAction,
    this.secondaryLabel,
    this.onSecondary,
  });

  final IconData icon;
  final String title;
  final String body;
  final String? actionLabel;
  final VoidCallback? onAction;

  /// La seconde issue, quand il y en a une. Une caméra qui ne s'ouvre pas ne
  /// laisse pas qu'un bouton « Réessayer » : la photo existe peut-être déjà
  /// dans la galerie.
  final String? secondaryLabel;
  final VoidCallback? onSecondary;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 46, color: AppColors.muted),
            const SizedBox(height: 20),
            Text(
              title,
              textAlign: TextAlign.center,
              style: context.texts.titleLarge,
            ),
            const SizedBox(height: 10),
            Text(
              body,
              textAlign: TextAlign.center,
              style: context.texts.bodySmall,
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 26),
              FilledButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
            if (secondaryLabel != null && onSecondary != null) ...[
              const SizedBox(height: 10),
              OutlinedButton(
                onPressed: onSecondary,
                child: Text(secondaryLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
