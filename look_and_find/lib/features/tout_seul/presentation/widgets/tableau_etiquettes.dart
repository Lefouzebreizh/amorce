/// Ce que la sonde montre : les étiquettes brutes, en gros, et rien d'autre.
///
/// **Pourquoi un widget séparé de l'écran.** L'écran de sonde ouvre l'appareil
/// photo, donc il ne se monte pas sur une machine de vérification. Ce
/// tableau-ci n'ouvre rien : il reçoit une liste et l'affiche. C'est la partie
/// qui se relit, se trie, se copie — donc la partie qu'on veut éprouver — et la
/// séparer est ce qui rend cela possible.
///
/// **Rien n'est traduit ni filtré ici.** Le mot affiché est celui du moteur,
/// même s'il est absurde. Une sonde qui embellit ce qu'elle mesure ne mesure
/// plus rien.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../domain/reconnaissance.dart';
import '../releve_sonde.dart';

class TableauEtiquettes extends StatelessWidget {
  const TableauEtiquettes({super.key, required this.etiquettes});

  /// Déjà triées par le port, de la plus sûre à la moins sûre. L'ordre n'est
  /// pas refait ici : deux tris pour une même liste, c'est deux endroits où le
  /// départage peut diverger.
  final List<EtiquetteVue> etiquettes;

  static const String copier = 'Copier le relevé';
  static const String rienDeVu = 'Rien de reconnu pour l\'instant.';
  static const String copie = 'Relevé copié.';

  Future<void> _copier(BuildContext context) async {
    final messager = ScaffoldMessenger.maybeOf(context);
    await Clipboard.setData(ClipboardData(text: texteDuReleve(etiquettes)));
    messager?.showSnackBar(const SnackBar(content: Text(copie)));
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (etiquettes.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: Text(
              rienDeVu,
              style: TextStyle(fontSize: 20, color: Colors.white70),
            ),
          )
        else
          for (final vue in etiquettes)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  // Largeur fixe : la colonne des confiances doit s'aligner,
                  // sinon l'œil ne compare plus rien d'une ligne à l'autre.
                  SizedBox(
                    width: 92,
                    child: Text(
                      confianceLisible(vue.confiance),
                      textAlign: TextAlign.right,
                      style: const TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Text(
                      vue.texte,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 26,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: () => _copier(context),
          icon: const Icon(Icons.copy_rounded),
          label: const Text(copier),
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(56),
            textStyle: const TextStyle(fontSize: 18),
          ),
        ),
      ],
    );
  }
}
