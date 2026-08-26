/// Le cercle qui confirme la mise au point à l'endroit touché.
///
/// C'est le seul retour immédiat dont dispose l'utilisateur : la mise au point
/// d'un capteur met plusieurs centaines de millisecondes, pendant lesquelles
/// rien ne bouge à l'écran. Sans ce cercle, on croit que l'appui n'a pas été
/// pris en compte et on tape trois fois.
library;

import 'package:flutter/material.dart';

class FocusRing extends StatefulWidget {
  const FocusRing({super.key, required this.position});

  /// Position en pixels, dans le repère de l'aperçu.
  final Offset position;

  @override
  State<FocusRing> createState() => _FocusRingState();
}

class _FocusRingState extends State<FocusRing>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..forward();

  @override
  void didUpdateWidget(covariant FocusRing oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.position != widget.position) _controller.forward(from: 0);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const size = 74.0;
    return Positioned(
      left: widget.position.dx - size / 2,
      top: widget.position.dy - size / 2,
      child: IgnorePointer(
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            final t = _controller.value;
            // Le cercle rétrécit puis s'efface : le mouvement dit « c'est ici »
            // mieux qu'un fondu seul, et il disparaît de lui-même pour ne pas
            // encombrer le viseur.
            final scale = 1.35 - 0.35 * Curves.easeOut.transform(t.clamp(0, 1));
            final opacity = t < 0.65 ? 1.0 : 1 - (t - 0.65) / 0.35;
            return Opacity(
              opacity: opacity.clamp(0, 1),
              child: Transform.scale(scale: scale, child: child),
            );
          },
          child: Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 2),
            ),
          ),
        ),
      ),
    );
  }
}
