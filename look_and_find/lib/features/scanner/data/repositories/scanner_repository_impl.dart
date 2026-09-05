/// Implémentation du contrat d'identification.
///
/// Seule couche autorisée à connaître Dio : elle attrape tout ce qui remonte
/// de la source de données et le traduit en [AppException]. Un `catch (_)`
/// large est ici volontaire — un décodage d'image raté, un `TypeError` sur une
/// réponse inattendue ou un plantage de l'isolat de compression ne doivent pas
/// remonter en exception non gérée jusqu'au widget : ils deviennent une erreur
/// affichable, avec un bouton « Réessayer » quand cela a un sens.
library;

import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../../../../core/network/app_exception.dart';
import '../../../../core/utils/result.dart';
import '../../../fiche_objet/domain/entities/fiche_objet.dart';
import '../../../product_detail/domain/entities/product.dart';
import '../../domain/repositories/scanner_repository.dart';
import '../datasources/gemini_vision_datasource.dart';

class ScannerRepositoryImpl implements ScannerRepository {
  ScannerRepositoryImpl(this._dataSource);

  final GeminiVisionDataSource _dataSource;

  CancelToken? _current;

  @override
  Future<Result<FicheObjet>> decrire(Uint8List photo) =>
      _mener((token) => _dataSource.decrire(photo, cancelToken: token));

  @override
  Future<Result<Product>> identify(Uint8List photo) =>
      _mener((token) => _dataSource.identify(photo, cancelToken: token));

  /// L'annulation et la traduction des échecs, identiques pour les deux
  /// parcours. Un second déclenchement annule le premier : deux appels
  /// concurrents sont facturés tous les deux et l'utilisateur n'en lira qu'un.
  Future<Result<T>> _mener<T>(Future<T> Function(CancelToken) appel) async {
    abort();
    final token = _current = CancelToken();

    try {
      return Success(await appel(token));
    } catch (error) {
      return Failure(AppException.from(error));
    } finally {
      if (identical(_current, token)) _current = null;
    }
  }

  @override
  void abort() {
    _current?.cancel('scan abandonné');
    _current = null;
  }
}
