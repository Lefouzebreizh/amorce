/// Une ligne de « Mes fiches » : un objet déjà identifié, rouvert sans
/// reprendre de photo ni redépenser un appel au modèle.
///
/// **Ce que la ligne montre, et pourquoi ces trois-là.** La vignette dit de
/// quel objet il s'agit plus vite que n'importe quel mot ; le nom dit ce que
/// l'application en a compris ; la date relative situe le scan dans le souvenir
/// — « hier » situe, « 14:32 » ne situe rien. La catégorie et la couleur
/// tiennent sur la même ligne parce qu'elles répondent ensemble à « lequel
/// c'était », quand deux fiches portent le même nom.
///
/// La vignette peut manquer : les photos vivent dans le dossier temporaire du
/// système, qui se vide quand il veut. C'est le cas normal et non une panne —
/// la fiche reste entièrement lisible sans elle, donc l'absence se remplace par
/// une surface neutre, jamais par une icône d'erreur.
library;

import 'dart:io';

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/formatters.dart';
import '../../domain/entities/fiche_objet.dart';

class TuileFiche extends StatelessWidget {
  const TuileFiche({super.key, required this.fiche, required this.onOuvrir});

  final FicheObjet fiche;
  final VoidCallback onOuvrir;

  @override
  Widget build(BuildContext context) {
    final details = [
      fiche.categorie,
      fiche.couleur?.label,
    ].nonNulls.join(' · ');

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onOuvrir,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: SizedBox(
                  width: 46,
                  height: 46,
                  child: fiche.imagePath == null
                      ? const ColoredBox(color: AppColors.raised)
                      : Image.file(
                          File(fiche.imagePath!),
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) =>
                              const ColoredBox(color: AppColors.raised),
                        ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      fiche.nom,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.text,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (details.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        details,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (fiche.capturedAt != null) ...[
                const SizedBox(width: 12),
                Text(
                  Formatters.relativeDate(fiche.capturedAt!),
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
