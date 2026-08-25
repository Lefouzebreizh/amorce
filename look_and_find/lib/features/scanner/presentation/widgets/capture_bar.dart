/// La barre du bas du viseur : galerie, déclencheur, accès à la liste.
///
/// Le déclencheur fait 76 px et se tient au centre, à portée du pouce : on
/// photographie souvent d'une seule main, l'autre tenant ou dégageant l'objet.
/// Les deux commandes secondaires restent volontairement plus petites et plus
/// discrètes.
///
/// Le flash n'est **pas** ici, et c'est un déplacement volontaire : à trois
/// commandes secondaires, la barre devient trop dense pour un pouce, et le
/// flash se déclenchait par erreur en visant la liste. Il est passé en haut à
/// droite, là où toutes les applications photo le mettent.
library;

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

class CaptureBar extends StatelessWidget {
  const CaptureBar({
    super.key,
    required this.onPickPhoto,
    required this.onCapture,
    required this.onOpenList,
    this.alertCount = 0,
    this.busy = false,
  });

  final VoidCallback onPickPhoto;
  final VoidCallback onCapture;
  final VoidCallback onOpenList;

  /// Nombre d'objets suivis passés sous leur seuil. Sans cette pastille, une
  /// baisse attendue depuis des semaines n'existe que pour qui pense à ouvrir
  /// la liste — c'est-à-dire pour personne.
  final int alertCount;

  final bool busy;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _RoundAction(
            icon: Icons.photo_library_outlined,
            label: 'Identifier une photo déjà prise',
            onTap: onPickPhoto,
          ),
          _Shutter(onTap: busy ? null : onCapture, busy: busy),
          _RoundAction(
            icon: Icons.bookmark_border_rounded,
            label: alertCount == 0
                ? 'Ma liste'
                : 'Ma liste, $alertCount alerte${alertCount > 1 ? 's' : ''}',
            badge: alertCount,
            onTap: onOpenList,
          ),
        ],
      ),
    );
  }

}

class _Shutter extends StatelessWidget {
  const _Shutter({required this.onTap, required this.busy});

  final VoidCallback? onTap;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Identifier l\'objet visé',
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: 76,
          height: 76,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 4),
          ),
          child: Padding(
            padding: const EdgeInsets.all(5),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: busy ? AppColors.muted : Colors.white,
              ),
              child: busy
                  ? const Padding(
                      padding: EdgeInsets.all(16),
                      child: CircularProgressIndicator(
                        strokeWidth: 3,
                        color: AppColors.ink,
                      ),
                    )
                  : null,
            ),
          ),
        ),
      ),
    );
  }
}

class _RoundAction extends StatelessWidget {
  const _RoundAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.badge = 0,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    final button = Semantics(
      button: true,
      label: label,
      child: InkResponse(
        onTap: onTap,
        radius: 32,
        child: Container(
          width: AppTheme.minTouchTarget,
          height: AppTheme.minTouchTarget,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.ink.withValues(alpha: 0.45),
          ),
          child: Icon(icon, size: 22, color: Colors.white),
        ),
      ),
    );

    if (badge == 0) return button;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        button,
        // La pastille porte l'accent « gain » et non l'accent « action » : ce
        // qu'elle annonce, c'est de l'argent économisé, pas un geste à faire.
        Positioned(
          right: -2,
          top: -2,
          child: Container(
            constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
            padding: const EdgeInsets.symmetric(horizontal: 5),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.gain,
              shape: BoxShape.circle,
              // Un liseré de la couleur du fond détache la pastille de l'icône
              // quelle que soit la scène derrière le viseur.
              border: Border.all(color: AppColors.ink, width: 2),
            ),
            child: Text(
              badge > 9 ? '9+' : '$badge',
              style: const TextStyle(
                color: AppColors.ink,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
