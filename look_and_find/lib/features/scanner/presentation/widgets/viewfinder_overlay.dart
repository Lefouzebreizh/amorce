/// Le cadre de visée posé sur l'aperçu caméra.
///
/// Il ne sert pas à décorer : le modèle identifie beaucoup mieux un objet qui
/// occupe le centre du cadre, et l'invite le lui demande explicitement. Sans
/// repère visuel, l'utilisateur photographie la pièce entière et reçoit une
/// fiche pour le canapé du fond.
///
/// Quatre équerres plutôt qu'un rectangle plein : un cadre fermé se lit comme
/// une contrainte de recadrage (« l'objet doit tenir exactement là-dedans »),
/// alors qu'on veut seulement dire « visez au centre ».
library;

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';

class ViewfinderOverlay extends StatelessWidget {
  const ViewfinderOverlay({super.key, this.hint});

  final String? hint;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: CustomPaint(
        painter: _BracketsPainter(),
        child: hint == null
            ? const SizedBox.expand()
            : Align(
                alignment: const Alignment(0, 0.62),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 40),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      // Le texte se pose sur un flux vidéo dont on ne connaît
                      // pas la luminosité : sans fond propre, il devient
                      // illisible dès qu'on vise un objet clair.
                      color: AppColors.ink.withValues(alpha: 0.55),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      child: Text(
                        hint!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: AppColors.text,
                          fontSize: 13,
                          height: 1.35,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
      ),
    );
  }
}

class _BracketsPainter extends CustomPainter {
  static const double _inset = 0.12;
  static const double _armLength = 28;
  static const double _radius = 18;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTRB(
      size.width * _inset,
      size.height * 0.22,
      size.width * (1 - _inset),
      size.height * 0.66,
    );

    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.85)
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    void bracket(Offset corner, double dx, double dy) {
      final path = Path()
        ..moveTo(corner.dx + dx * _armLength, corner.dy)
        ..lineTo(corner.dx + dx * _radius, corner.dy)
        ..arcToPoint(
          Offset(corner.dx, corner.dy + dy * _radius),
          radius: const Radius.circular(_radius),
          clockwise: dx * dy < 0,
        )
        ..lineTo(corner.dx, corner.dy + dy * _armLength);
      canvas.drawPath(path, paint);
    }

    bracket(rect.topLeft, 1, 1);
    bracket(rect.topRight, -1, 1);
    bracket(rect.bottomLeft, 1, -1);
    bracket(rect.bottomRight, -1, -1);
  }

  @override
  bool shouldRepaint(covariant _BracketsPainter oldDelegate) => false;
}
