/// Implémentation Hive du stockage local.
///
/// Les écritures renvoient un [Result] plutôt que de lever : un disque plein
/// ou une boîte verrouillée ne doit pas faire disparaître la fiche que
/// l'utilisateur est en train de lire, seulement afficher que la mise en
/// favori n'a pas pris.
///
/// Les lectures en flux, elles, ne sont pas enveloppées : Hive lit en mémoire
/// et un flux d'erreurs obligerait chaque écran à traiter un cas qui ne se
/// produit pas.
library;

import '../../../../core/network/app_exception.dart';
import '../../../../core/utils/result.dart';
import '../../../product_detail/domain/entities/product.dart';
import '../../domain/entities/favorite.dart';
import '../../domain/repositories/favorites_repository.dart';
import '../datasources/favorites_local_datasource.dart';

class FavoritesRepositoryImpl implements FavoritesRepository {
  const FavoritesRepositoryImpl(this._local);

  final FavoritesLocalDataSource _local;

  @override
  Stream<List<Favorite>> watchFavorites() => _local.watchFavorites();

  @override
  Favorite? find(String productId) => _local.findFavorite(productId);

  @override
  Future<Result<void>> save(Favorite favorite) =>
      _guard(() => _local.putFavorite(favorite));

  @override
  Future<Result<void>> remove(String productId) =>
      _guard(() => _local.deleteFavorite(productId));

  @override
  Stream<List<Product>> watchHistory() => _local.watchHistory();

  @override
  Future<Result<void>> pushHistory(Product product) =>
      _guard(() => _local.pushHistory(product));

  @override
  Future<Result<void>> clearHistory() => _guard(_local.clearHistory);

  Future<Result<void>> _guard(Future<void> Function() action) async {
    try {
      await action();
      return const Success(null);
    } catch (error) {
      return Failure(CacheException(error.toString()));
    }
  }
}
