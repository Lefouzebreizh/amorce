/// Confronter une fiche fraîchement scannée au favori déjà enregistré.
///
/// C'est **le seul moment** où un prix peut bouger dans cette application :
/// sans serveur, rien n'interroge les marchands entre deux ouvertures. Chaque
/// scan est donc traité comme un relevé de prix, et l'objet déjà suivi voit sa
/// fiche remplacée par la nouvelle — le prix de référence, lui, ne bouge pas.
///
/// Renvoie la baisse constatée, ou `null` si l'objet n'était pas suivi ou si
/// le prix n'a pas baissé **depuis la mise en favori**. L'appelant décide quoi
/// en faire ; ce cas d'usage n'affiche rien.
library;

import '../../../product_detail/domain/entities/product.dart';
import '../entities/favorite.dart';
import '../repositories/favorites_repository.dart';

class PriceDrop {
  const PriceDrop(this.favorite);

  final Favorite favorite;

  /// Écart avec le prix du jour de la mise en favori. C'est **le** repère du
  /// suivi : comparer au relevé précédent ferait disparaître la baisse dès le
  /// second scan, alors que l'objet est toujours moins cher qu'au départ.
  double get amount => favorite.referencePrice - favorite.currentPrice;

  /// Vrai si l'utilisateur avait posé un seuil et qu'il est franchi : la seule
  /// baisse qui justifie de l'interrompre.
  bool get isAlert => favorite.reachedThreshold;
}

class RefreshFavoritePrice {
  const RefreshFavoritePrice(this._repository);

  final FavoritesRepository _repository;

  Future<PriceDrop?> call(Product scanned) async {
    final existing = _repository.find(scanned.id);
    if (existing == null) return null;

    // La fiche est remplacée par la nouvelle, le prix de référence ne bouge
    // pas : c'est lui qui rend la baisse mesurable.
    final updated = existing.copyWith(
      product: scanned,
      lastCheckedAt: DateTime.now(),
    );
    await _repository.save(updated);

    return updated.hasDropped ? PriceDrop(updated) : null;
  }
}
