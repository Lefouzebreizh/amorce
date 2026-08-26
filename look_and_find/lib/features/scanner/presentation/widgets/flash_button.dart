/// Le réglage du flash, posé en haut à droite de l'aperçu.
///
/// Il a quitté la barre du bas parce qu'à trois commandes secondaires autour du
/// déclencheur, on l'actionnait en visant la liste. En haut à droite, il est là
/// où toutes les applications photo le mettent, et hors du chemin du pouce qui
/// déclenche.
library;

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

class FlashButton extends StatelessWidget {
  const FlashButton({super.key, required this.mode, required this.onTap});

  final FlashMode mode;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final actif = mode != FlashMode.off;

    return Semantics(
      button: true,
      label: switch (mode) {
        FlashMode.off => 'Flash éteint',
        FlashMode.auto => 'Flash automatique',
        _ => 'Flash forcé',
      },
      child: InkResponse(
        onTap: onTap,
        radius: 30,
        child: Container(
          width: AppTheme.minTouchTarget,
          height: AppTheme.minTouchTarget,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            // Le bouton se pose sur un flux vidéo de luminosité inconnue :
            // sans fond propre, il disparaît dès qu'on vise un objet clair.
            color: AppColors.ink.withValues(alpha: 0.45),
          ),
          child: Icon(
            switch (mode) {
              FlashMode.off => Icons.flash_off_rounded,
              FlashMode.auto => Icons.flash_auto_rounded,
              _ => Icons.flash_on_rounded,
            },
            size: 22,
            color: actif ? AppColors.warn : Colors.white,
          ),
        ),
      ),
    );
  }
}
