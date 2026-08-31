/// Une tuile de la grille d'accueil : un émoji énorme, un nom en petit.
///
/// **La hiérarchie est inversée par rapport à toute autre liste de
/// l'application**, et c'est volontaire. Ailleurs, l'image illustre le texte ;
/// ici le texte légende l'image, parce que celui qui choisit ne sait pas lire.
/// L'émoji fait donc 64 points et le nom 18 — le minimum du dépôt — au lieu de
/// l'inverse.
///
/// **La tuile entière est la cible tactile**, pas un bouton posé dedans : un
/// doigt de cinq ans vise mal, et la règle des 48 dp du dépôt est écrite pour
/// un pouce d'adulte. Ici la surface touchable fait 176 dp de haut sur environ
/// 173 de large sur le terrain de référence, soit près de quinze fois l'aire
/// minimale.
library;

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../domain/entities/geste.dart';
import '../emojis.dart';

/// Hauteur fixe d'une tuile. Fixe, et non déduite de la largeur : sur une
/// tablette, un ratio ferait des tuiles de 300 dp de haut où l'émoji se perd.
const double hauteurTuile = 176;

class TuileGeste extends StatelessWidget {
  const TuileGeste({super.key, required this.geste, required this.onTouche});

  final Geste geste;
  final VoidCallback onTouche;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.slab,
      borderRadius: BorderRadius.circular(24),
      child: InkWell(
        onTap: onTouche,
        borderRadius: BorderRadius.circular(24),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                EmojisGestes.pour(geste.identifiant),
                style: const TextStyle(fontSize: 64),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                geste.nom,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 18,
                  height: 1.2,
                  fontWeight: FontWeight.w600,
                  color: AppColors.text,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
