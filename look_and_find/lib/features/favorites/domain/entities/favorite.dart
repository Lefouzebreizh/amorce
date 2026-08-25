/// Un objet suivi par l'utilisateur.
///
/// **Ce que le suivi de prix peut réellement faire ici.** L'application n'a
/// pas de serveur : personne ne peut interroger les marchands pendant que le
/// téléphone dort. Le prix d'un favori est donc réévalué au moment où l'objet
/// est **rescanné**, et [referencePrice] garde le prix du jour de la mise en
/// favori pour que la comparaison ait un sens. Promettre une alerte de fond
/// serait mentir sur ce que l'architecture permet ; ce que l'application
/// promet, elle le tient.
library;

import '../../../product_detail/domain/entities/product.dart';
import '../../../product_detail/domain/usecases/best_offer.dart';

class Favorite {
  const Favorite({
    required this.product,
    required this.savedAt,
    required this.referencePrice,
    this.alertThreshold,
    this.lastCheckedAt,
  });

  final Product product;
  final DateTime savedAt;

  /// Prix retenu le jour de la mise en favori. Sert de repère fixe : comparer
  /// au prix moyen courant ferait bouger le point de comparaison en même temps
  /// que le prix, et aucune baisse ne serait jamais visible.
  final double referencePrice;

  /// Seuil choisi par l'utilisateur. `null` = suivi sans seuil : la baisse est
  /// signalée, mais discrètement.
  final double? alertThreshold;

  final DateTime? lastCheckedAt;

  double get currentPrice => BestOffer.of(product)?.price ?? product.averagePrice;

  double get delta => currentPrice - referencePrice;

  bool get hasDropped => delta < -0.01;

  /// Seule une baisse **sous le seuil** mérite d'interrompre l'utilisateur.
  bool get reachedThreshold =>
      alertThreshold != null && currentPrice <= alertThreshold!;

  Favorite copyWith({
    Product? product,
    double? alertThreshold,
    bool clearThreshold = false,
    DateTime? lastCheckedAt,
  }) => Favorite(
    product: product ?? this.product,
    savedAt: savedAt,
    referencePrice: referencePrice,
    alertThreshold: clearThreshold ? null : (alertThreshold ?? this.alertThreshold),
    lastCheckedAt: lastCheckedAt ?? this.lastCheckedAt,
  );
}
