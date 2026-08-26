/// Accès aux deux boîtes Hive : les favoris et l'historique.
///
/// Les boîtes sont ouvertes une fois au démarrage (voir `main.dart`) plutôt
/// qu'à la demande : `Hive.openBox` est asynchrone, et l'ouvrir à la volée
/// obligerait chaque écran à afficher un chargement pour lire trois lignes
/// déjà sur le disque.
///
/// L'historique est **borné** à [historyLimit]. Sans borne, chaque scan ajoute
/// une fiche complète — quelques kilo-octets — et la liste finit par mettre une
/// seconde à s'afficher sur un téléphone modeste, pour des entrées que
/// personne ne fait défiler jusqu'en bas.
library;

import 'package:hive_flutter/hive_flutter.dart';

import '../../../product_detail/data/models/product_dto.dart';
import '../../../product_detail/domain/entities/product.dart';
import '../../domain/entities/favorite.dart';
import '../models/favorite_dto.dart';

class FavoritesLocalDataSource {
  const FavoritesLocalDataSource(this._favorites, this._history);

  final Box<String> _favorites;
  final Box<String> _history;

  static const int historyLimit = 60;

  // --- Favoris ---------------------------------------------------------

  List<Favorite> readFavorites() {
    final list = _favorites.values.map(FavoriteDto.decode).nonNulls.toList()
      ..sort((a, b) => b.savedAt.compareTo(a.savedAt));
    return list;
  }

  /// Émet immédiatement, puis à chaque écriture : un écran qui s'abonne ne
  /// doit pas attendre la prochaine modification pour afficher quelque chose.
  Stream<List<Favorite>> watchFavorites() async* {
    yield readFavorites();
    yield* _favorites.watch().map((_) => readFavorites());
  }

  Favorite? findFavorite(String id) {
    final raw = _favorites.get(id);
    return raw == null ? null : FavoriteDto.decode(raw);
  }

  Future<void> putFavorite(Favorite favorite) =>
      _favorites.put(favorite.product.id, FavoriteDto.encode(favorite));

  Future<void> deleteFavorite(String id) => _favorites.delete(id);

  // --- Historique ------------------------------------------------------

  List<Product> readHistory() {
    final list = _history.values
        .map((raw) {
          try {
            return ProductDto.decode(raw).toEntity();
          } catch (_) {
            return null;
          }
        })
        .nonNulls
        .toList()
      ..sort((a, b) {
        final da = a.capturedAt ?? DateTime(0);
        final db = b.capturedAt ?? DateTime(0);
        return db.compareTo(da);
      });
    return list;
  }

  Stream<List<Product>> watchHistory() async* {
    yield readHistory();
    yield* _history.watch().map((_) => readHistory());
  }

  /// La clé est l'identifiant du produit : rescanner le même objet met à jour
  /// son entrée au lieu d'en empiler une seconde.
  Future<void> pushHistory(Product product) async {
    await _history.put(
      product.id,
      ProductDto.fromEntity(product).encode(),
    );
    await _trimHistory();
  }

  Future<void> clearHistory() => _history.clear();

  Future<void> _trimHistory() async {
    final entries = readHistory();
    if (entries.length <= historyLimit) return;
    await _history.deleteAll(
      entries.skip(historyLimit).map((product) => product.id),
    );
  }
}
