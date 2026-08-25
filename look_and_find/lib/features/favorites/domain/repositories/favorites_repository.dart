/// Contrat du stockage local : favoris et historique.
///
/// Les lectures sont des flux, pas des `Future`. Le même favori est visible
/// depuis la fiche produit (le cœur en tête d'écran) et depuis la liste :
/// deux lectures ponctuelles finiraient par diverger, alors qu'un flux unique
/// tenu par Hive garde les deux écrans d'accord sans code de synchronisation.
library;

import '../../../../core/utils/result.dart';
import '../../../product_detail/domain/entities/product.dart';
import '../entities/favorite.dart';

abstract interface class FavoritesRepository {
  Stream<List<Favorite>> watchFavorites();

  Favorite? find(String productId);

  Future<Result<void>> save(Favorite favorite);

  Future<Result<void>> remove(String productId);

  Stream<List<Product>> watchHistory();

  Future<Result<void>> pushHistory(Product product);

  Future<Result<void>> clearHistory();
}
