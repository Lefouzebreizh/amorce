/// Une observation de la fiche : une icône, un libellé optionnel, une valeur.
///
/// Le libellé est optionnel parce que les deux usages ne se ressemblent pas :
/// « Couleur : bleu clair » a besoin d'être nommé, « manche moulé » se suffit.
/// Deux widgets pour ça auraient dupliqué l'alignement et l'espacement.
library;

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/extensions.dart';

class LigneCaracteristique extends StatelessWidget {
  const LigneCaracteristique({
    super.key,
    required this.icone,
    required this.libelle,
    required this.valeur,
  });

  final IconData icone;
  final String? libelle;
  final String valeur;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icone, size: 18, color: AppColors.muted),
          const SizedBox(width: 12),
          // Deux `Text` plutôt qu'un texte enrichi : le libellé et la valeur se
          // lisent alors séparément — par un test comme par une synthèse
          // vocale, qui restitue mal une suite de fragments stylés.
          if (libelle != null) ...[
            Text(
              libelle!,
              style: context.texts.bodyLarge?.copyWith(color: AppColors.muted),
            ),
            const SizedBox(width: 6),
          ],
          Expanded(child: Text(valeur, style: context.texts.bodyLarge)),
        ],
      ),
    );
  }
}
