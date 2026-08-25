/// Câblage des couches du scanner et pilotage d'une identification.
///
/// La chaîne complète — source de données, dépôt, cas d'usage — est déclarée
/// ici et nulle part ailleurs : c'est le seul endroit où un test peut tout
/// remplacer par une fausse implémentation en surchargeant un unique provider.
///
/// [ScanController] tient l'état d'**une** identification, pas la liste des
/// scans passés. Il est `autoDispose` par défaut : quitter le viseur annule
/// l'appel en cours plutôt que de laisser courir une requête facturée dont
/// plus personne ne lira le résultat.
library;

import 'dart:typed_data';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../../core/network/app_exception.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/utils/result.dart';
import '../../../favorites/presentation/providers/favorites_providers.dart';
import '../../../product_detail/domain/entities/product.dart';
import '../../data/datasources/gemini_vision_datasource.dart';
import '../../data/repositories/scanner_repository_impl.dart';
import '../../domain/repositories/scanner_repository.dart';
import '../../domain/usecases/identify_product.dart';

part 'scanner_providers.g.dart';

@Riverpod(keepAlive: true)
GeminiVisionDataSource geminiVisionDataSource(Ref ref) =>
    GeminiVisionDataSource(ref.watch(dioProvider));

@Riverpod(keepAlive: true)
ScannerRepository scannerRepository(Ref ref) =>
    ScannerRepositoryImpl(ref.watch(geminiVisionDataSourceProvider));

@Riverpod(keepAlive: true)
IdentifyProduct identifyProduct(Ref ref) =>
    IdentifyProduct(ref.watch(scannerRepositoryProvider));

@riverpod
class ScanController extends _$ScanController {
  /// `null` = viseur au repos. Un état dédié « idle » n'apporterait rien de
  /// plus qu'un test de nullité, et obligerait chaque écran à traiter un
  /// quatrième cas.
  @override
  Future<Product?> build() async {
    // Le cas d'usage est capturé pendant la construction, pas relu au moment de
    // la libération : Riverpod interdit de toucher à `ref` dans un callback de
    // cycle de vie, et le conteneur est de toute façon peut-être déjà démonté.
    final identify = ref.watch(identifyProductProvider);
    ref.onDispose(identify.abort);
    return null;
  }

  Future<Product?> identify(Uint8List photo, {String? imagePath}) async {
    // Tout ce qui vient de `ref` est lu avant le premier `await` : au retour,
    // le contrôleur peut avoir été libéré (écran quitté) et `ref` n'est alors
    // plus utilisable.
    final identify = ref.read(identifyProductProvider);
    final journal = ref.read(scanJournalProvider.notifier);

    state = const AsyncValue.loading();

    final result = await identify.call(photo, imagePath: imagePath);

    // Le contrôleur peut avoir été jeté pendant l'appel (écran quitté) :
    // écrire dans `state` lèverait alors une erreur d'utilisation après
    // libération.
    if (!ref.mounted) return null;

    switch (result) {
      case Success(:final value):
        // Chaque identification vaut relevé de prix : l'historique et le
        // favori éventuel sont mis à jour avant que la fiche ne s'affiche,
        // pour qu'elle montre déjà le bon état du cœur.
        await journal.record(value);
        if (!ref.mounted) return null;
        state = AsyncValue.data(value);
        return value;

      case Failure(:final error):
        state = AsyncValue.error(error, StackTrace.current);
        return null;
    }
  }

  /// Retour au viseur après une erreur ou après lecture de la fiche.
  void reset() {
    ref.read(identifyProductProvider).abort();
    state = const AsyncValue.data(null);
  }
}

/// Petit confort de lecture : l'erreur du scan, déjà typée, sans passer par
/// `asError` et un transtypage à chaque widget.
extension ScanErrorX on AsyncValue<Product?> {
  AppException? get appError {
    final error = this.error;
    return error is AppException ? error : null;
  }
}
