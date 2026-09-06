/// Le grossissement courant, affiché pendant qu'on pince.
///
/// **Pourquoi il n'apparaît qu'au-delà de 1×.** Les applications photo
/// affichent un « 1× » permanent parce que leur pastille est aussi un bouton
/// qui change d'objectif. Ici, elle ne serait qu'un chiffre de plus posé sur
/// un viseur dont le §2 demande qu'il reste lisible d'un coup d'œil. Tant
/// qu'on n'a pas zoomé, il n'y a rien à dire.
///
/// **Pourquoi le nombre est arrondi au dixième.** Un pincement traverse des
/// dizaines de valeurs par seconde : au centième, le chiffre clignote et ne se
/// lit plus. Au dixième, il bouge assez pour confirmer le geste et reste
/// stable assez pour être lu.
library;

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';

class IndicateurZoom extends StatelessWidget {
  const IndicateurZoom({super.key, required this.niveau});

  final double niveau;

  /// La virgule et non le point : c'est un nombre lu par un francophone, pas
  /// une valeur sérialisée.
  static String formater(double niveau) =>
      '${niveau.toStringAsFixed(1).replaceAll('.', ',')}×';

  @override
  Widget build(BuildContext context) {
    final texte = formater(niveau);

    return IgnorePointer(
      child: Semantics(
        label: 'Grossissement $texte',
        child: DecoratedBox(
          decoration: BoxDecoration(
            // Même fond que le bouton de flash : la pastille se pose sur un
            // flux vidéo de luminosité inconnue et disparaîtrait sur un objet
            // clair.
            color: AppColors.ink.withValues(alpha: 0.55),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            child: Text(
              texte,
              style: const TextStyle(
                color: AppColors.text,
                fontSize: 15,
                fontWeight: FontWeight.w600,
                // Sans largeur fixe, « 1,9× » et « 10,0× » n'ont pas la même
                // taille et la pastille sautille pendant le geste.
                fontFeatures: [FontFeature.tabularFigures()],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
