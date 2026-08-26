/// « Voir chez moi » : le modèle 3D posé dans la pièce, à l'échelle 1:1.
///
/// La visionneuse est `model_viewer_plus`, et non `arkit_plugin` /
/// `arcore_flutter_plugin`. Le choix se justifie par ce qu'il évite : deux
/// implémentations natives à maintenir, deux formats de scène à assembler, et
/// une gestion de session AR par plateforme. `<model-viewer>` délègue le
/// placement à Scene Viewer (Android) et Quick Look (iOS) — c'est-à-dire aux
/// composants système que l'utilisateur connaît déjà, et qui gèrent seuls la
/// détection de plan, l'ancrage et l'occlusion.
///
/// Ce que ce choix coûte : on ne peut pas dessiner par-dessus la scène AR
/// (pas de cotes flottantes, pas de mesure). Tant que la fonction répond à
/// « est-ce que ça rentre », le système suffit.
library;

import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:model_viewer_plus/model_viewer_plus.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../../product_detail/domain/entities/product.dart';
import '../../domain/entities/ar_model.dart';
import '../widgets/ar_unavailable_view.dart';

class ArViewPage extends StatelessWidget {
  const ArViewPage({super.key, required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final model = ArModel.from(product);

    return Scaffold(
      backgroundColor: AppColors.ink,
      appBar: AppBar(
        title: const Text(AppStrings.arTitle),
        backgroundColor: AppColors.ink,
      ),
      body: model == null
          ? ArUnavailableView(product: product)
          : _Viewer(model: model),
    );
  }
}

class _Viewer extends StatelessWidget {
  const _Viewer({required this.model});

  final ArModel model;

  /// Quick Look ne sait pas ouvrir un `.glb` : sur iPhone sans `.usdz`, le
  /// bouton de placement du composant système reste inactif. On prévient
  /// plutôt que de laisser l'utilisateur appuyer dans le vide.
  bool get _placementUnsupported =>
      !kIsWeb && Platform.isIOS && !model.canPlaceOnIos;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: ModelViewer(
            src: model.src,
            iosSrc: model.iosSrc,
            alt: model.product.displayTitle,
            ar: true,
            arModes: const ['scene-viewer', 'webxr', 'quick-look'],
            arScale: ArScale.fixed,
            arPlacement: model.isWallMounted
                ? ArPlacement.wall
                : ArPlacement.floor,
            autoRotate: true,
            cameraControls: true,
            backgroundColor: AppColors.ink,
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  model.product.displayTitle,
                  style: context.texts.titleMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  _placementUnsupported
                      ? 'Modèle consultable en 3D. Le placement dans la pièce '
                            'demande un fichier .usdz, absent de cette fiche.'
                      : _hint,
                  style: context.texts.bodySmall,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  String get _hint {
    final dims = model.product.dimensions;
    if (dims.isEmpty) return AppStrings.arHint;
    return '${AppStrings.arHint} Taille réelle : '
        '${Formatters.dimensions(width: dims.width, height: dims.height, depth: dims.depth, unit: dims.unit)}.';
  }
}
