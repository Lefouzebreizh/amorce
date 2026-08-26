/// Mettre ou retirer un objet de la liste suivie.
///
/// Le prix de référence est figé **au moment de la mise en favori** : c'est ce
/// qui rend une baisse mesurable plus tard. Le recalculer à chaque lecture
/// ferait glisser le repère avec le prix, et aucune baisse ne serait jamais
/// détectée.
library;

import '../../../../core/utils/result.dart';
import '../../../product_detail/domain/entities/product.dart';
import '../../../product_detail/domain/usecases/best_offer.dart';
import '../entities/favorite.dart';
import '../repositories/favorites_repository.dart';

class ToggleFavorite {
  const ToggleFavorite(this._repository);

  final FavoritesRepository _repository;

  /// Renvoie l'état voulu après l'appel : `true` si l'objet est désormais suivi.
  Future<Result<bool>> call(Product product) async {
    final existing = _repository.find(product.id);

    if (existing != null) {
      final removed = await _repository.remove(product.id);
      return switch (removed) {
        Success() => const Success(false),
        Failure(:final error) => Failure(error),
      };
    }

    final saved = await _repository.save(
      Favorite(
        product: product,
        savedAt: DateTime.now(),
        referencePrice:
            BestOffer.of(product)?.price ?? product.averagePrice,
        lastCheckedAt: DateTime.now(),
      ),
    );
    return switch (saved) {
      Success() => const Success(true),
      Failure(:final error) => Failure(error),
    };
  }
}
