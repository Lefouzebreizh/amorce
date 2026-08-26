/// Ce qui s'affiche par-dessus le viseur pendant et après l'analyse.
///
/// La photo prise reste visible derrière : figer l'image pendant l'attente dit
/// « c'est cette photo-là qui est analysée » et permet à l'utilisateur de juger
/// lui-même du cadrage avant même le résultat. Un écran de chargement vide
/// laisse au contraire penser que la photo a été perdue.
///
/// L'échec distingue deux cas, parce qu'ils appellent deux gestes différents :
/// ce qui peut être réessayé tel quel (réseau) propose « Réessayer », le reste
/// (photo inexploitable, quota) renvoie au viseur.
library;

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/network/app_exception.dart';
import '../../../../core/utils/extensions.dart';

class ScanStatusSheet extends StatelessWidget {
  const ScanStatusSheet.analysing({super.key})
    : error = null,
      onRetry = null,
      onBack = null;

  const ScanStatusSheet.failed({
    super.key,
    required AppException this.error,
    required this.onRetry,
    required this.onBack,
  });

  final AppException? error;
  final VoidCallback? onRetry;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.ink.withValues(alpha: 0.72),
      alignment: Alignment.bottomCenter,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: error == null ? const _Analysing() : _Failure(this),
        ),
      ),
    );
  }
}

class _Analysing extends StatelessWidget {
  const _Analysing();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(
          width: 34,
          height: 34,
          child: CircularProgressIndicator(strokeWidth: 3),
        ),
        const SizedBox(height: 18),
        Text(AppStrings.scannerAnalysing, style: context.texts.titleMedium),
        const SizedBox(height: 6),
        Text(
          'Identification de l\'objet, recherche des prix et des marchands.',
          textAlign: TextAlign.center,
          style: context.texts.bodySmall,
        ),
        const SizedBox(height: 12),
      ],
    );
  }
}

class _Failure extends StatelessWidget {
  const _Failure(this.sheet);

  final ScanStatusSheet sheet;

  @override
  Widget build(BuildContext context) {
    final error = sheet.error!;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Icon(
          error.isRetryable
              ? Icons.wifi_tethering_off_rounded
              : Icons.image_not_supported_outlined,
          color: AppColors.warn,
          size: 34,
        ),
        const SizedBox(height: 14),
        Text(
          error.message,
          textAlign: TextAlign.center,
          style: context.texts.bodyMedium,
        ),
        const SizedBox(height: 20),
        if (error.isRetryable && sheet.onRetry != null)
          FilledButton(
            onPressed: sheet.onRetry,
            child: const Text(AppStrings.retry),
          ),
        if (error.isRetryable && sheet.onRetry != null)
          const SizedBox(height: 10),
        OutlinedButton(
          onPressed: sheet.onBack,
          child: const Text('Reprendre une photo'),
        ),
      ],
    );
  }
}
