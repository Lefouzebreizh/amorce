/// Identifier l'objet d'une photo.
///
/// Le cas d'usage ne se contente pas de relayer l'appel : il **date** la fiche
/// et lui attache le chemin de la photo locale. Ces deux champs ne viennent
/// pas du modèle, et les poser ici plutôt que dans le contrôleur garantit
/// qu'une fiche est toujours datée, y compris quand elle arrive par un autre
/// chemin (test, import, rejeu d'historique).
library;

import 'dart:typed_data';

import '../../../../core/utils/result.dart';
import '../../../product_detail/domain/entities/product.dart';
import '../repositories/scanner_repository.dart';

class IdentifyProduct {
  const IdentifyProduct(this._repository);

  final ScannerRepository _repository;

  Future<Result<Product>> call(Uint8List photo, {String? imagePath}) async {
    final result = await _repository.identify(photo);
    return switch (result) {
      Success(:final value) => Success(
        value.copyWith(capturedAt: DateTime.now(), imagePath: imagePath),
      ),
      Failure(:final error) => Failure(error),
    };
  }

  void abort() => _repository.abort();
}
