/// La réponse brute du modèle, telle qu'elle est arrivée.
///
/// Cet écran existe pour trancher une question et une seule : quand une fiche
/// affiche un prix fantaisiste ou un marchand inventé, est-ce le modèle qui l'a
/// dit, ou nous qui l'avons mal lu ? La réponse décide de ce qu'il faut
/// corriger — l'invite dans `gemini_prompt.dart`, ou la lecture dans
/// `product_dto.dart`. Sans elle, on corrige au hasard.
///
/// Le bouton « Copier » n'est pas décoratif : le geste réel est de coller cette
/// réponse dans une conversation pour faire corriger l'invite.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/extensions.dart';
import '../providers/scanner_providers.dart';

class RawAnswerPage extends ConsumerWidget {
  const RawAnswerPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reponse = ref.read(geminiVisionDataSourceProvider).lastRawAnswer;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Réponse du modèle'),
        actions: [
          if (reponse != null)
            IconButton(
              tooltip: 'Copier',
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: reponse));
                if (context.mounted) context.snack('Réponse copiée.');
              },
              icon: const Icon(Icons.copy_rounded),
            ),
          const SizedBox(width: 4),
        ],
      ),
      body: reponse == null
          ? _Vide(context: context)
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                Text(
                  'Ce que Gemini a renvoyé pour la dernière identification. '
                  'Si la fiche est fausse mais que cette réponse est juste, '
                  'c\'est la lecture qu\'il faut corriger ; si la réponse est '
                  'déjà fausse, c\'est l\'invite.',
                  style: context.texts.bodySmall,
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.slab,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: SelectableText(
                    reponse,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 12,
                      height: 1.5,
                      color: AppColors.text,
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}

class _Vide extends StatelessWidget {
  const _Vide({required this.context});

  final BuildContext context;

  @override
  Widget build(BuildContext _) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.code_off_rounded, size: 42, color: AppColors.muted),
            const SizedBox(height: 18),
            Text(
              'Aucune réponse en mémoire',
              textAlign: TextAlign.center,
              style: context.texts.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              'Seule la dernière identification est retenue, et elle ne survit '
              'pas à la fermeture de l\'application. Cette fiche vient de '
              'l\'historique : relancez un scan pour voir la réponse du modèle.',
              textAlign: TextAlign.center,
              style: context.texts.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}
