/// Le cadre posé sur l'aperçu caméra — au pixel près là où la porte mesure.
///
/// **Ce n'est pas un repère décoratif, et c'est toute la différence avec celui
/// du scanner.** Accord ne devine plus si la personne a cadré une surface : il
/// le lui demande, et ne juge que le carré visé. Si le trait dessiné et la zone
/// mesurée ne coïncident pas, la personne aligne son mur sur l'un pendant que
/// l'application lit l'autre — et tout l'édifice s'écroule en silence, sans
/// qu'aucun test de la porte ne bronche.
///
/// La géométrie vient donc de `ZoneVisee.cadre()`, jamais d'un pourcentage
/// recopié ici. Un test monte le widget et compare le rectangle peint à ce que
/// `ZoneVisee` calcule sur la même taille.
///
/// Quatre équerres plutôt qu'un rectangle fermé, comme ailleurs dans
/// l'application : un cadre plein se lit comme « la surface doit tenir
/// exactement là-dedans », alors qu'on demande seulement de le remplir.
library;

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../color_reader/domain/usecases/zone_visee.dart';

class CadreVisee extends StatelessWidget {
  const CadreVisee({super.key, this.part = ZoneVisee.partParDefaut, this.aide});

  /// La part du petit côté occupée par le cadre. Par défaut celle que la porte
  /// mesure ; on ne la change que pour éprouver le widget.
  final double part;

  /// La phrase posée sous le cadre. Absente, rien ne s'affiche.
  final String? aide;

  /// Le carré visé, dans les coordonnées du widget. Public pour que le test
  /// puisse le confronter à `ZoneVisee.cadre()` sans relire de la peinture.
  static Rect carre(Size taille, [double part = ZoneVisee.partParDefaut]) {
    final (gauche, haut, cote) = ZoneVisee.cadre(
      taille.width.round(),
      taille.height.round(),
      part,
    );
    return Rect.fromLTWH(
      gauche.toDouble(),
      haut.toDouble(),
      cote.toDouble(),
      cote.toDouble(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: CustomPaint(
        painter: _EquerresPainter(part),
        child: aide == null
            ? const SizedBox.expand()
            : LayoutBuilder(
                // L'aide se pose **sous le carré**, pas à un alignement fixe.
                // Posée à une fraction de l'écran, elle passait sous le
                // déclencheur sur un format allongé — vu en rendant la page,
                // invisible dans les tests.
                builder: (context, contraintes) {
                  final carre = CadreVisee.carre(contraintes.biggest, part);
                  return Padding(
                    padding: EdgeInsets.only(
                      top: carre.bottom + 20,
                      left: 32,
                      right: 32,
                    ),
                    child: Align(
                      alignment: Alignment.topCenter,
                      child: DecoratedBox(
                    decoration: BoxDecoration(
                      // Le texte se pose sur un flux vidéo dont on ne connaît
                      // pas la luminosité : sans fond propre il devient
                      // illisible dès qu'on vise un mur blanc.
                      color: AppColors.ink.withValues(alpha: 0.55),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      child: Text(
                        aide!,
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
                  );
                },
              ),
      ),
    );
  }
}

class _EquerresPainter extends CustomPainter {
  const _EquerresPainter(this.part);

  final double part;

  static const double _bras = 28;
  static const double _rayon = 18;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = CadreVisee.carre(size, part);

    final trait = Paint()
      ..color = Colors.white.withValues(alpha: 0.85)
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    // Des bras plus longs que le côté déborderaient du cadre et le
    // dessineraient plus grand qu'il n'est mesuré.
    final bras = _bras.clamp(0.0, rect.width / 2);
    final rayon = _rayon.clamp(0.0, rect.width / 2);

    void equerre(Offset coin, double dx, double dy) {
      final chemin = Path()
        ..moveTo(coin.dx + dx * bras, coin.dy)
        ..lineTo(coin.dx + dx * rayon, coin.dy)
        ..arcToPoint(
          Offset(coin.dx, coin.dy + dy * rayon),
          radius: Radius.circular(rayon),
          clockwise: dx * dy < 0,
        )
        ..lineTo(coin.dx, coin.dy + dy * bras);
      canvas.drawPath(chemin, trait);
    }

    equerre(rect.topLeft, 1, 1);
    equerre(rect.topRight, -1, 1);
    equerre(rect.bottomLeft, 1, -1);
    equerre(rect.bottomRight, -1, -1);
  }

  @override
  bool shouldRepaint(covariant _EquerresPainter ancien) => ancien.part != part;
}
