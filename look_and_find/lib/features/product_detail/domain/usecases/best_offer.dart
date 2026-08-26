/// Choisir l'offre à mettre en avant, et dire ce qu'elle fait gagner.
///
/// La règle : **le moins cher parmi les marchands en stock**. Une offre
/// épuisée moins chère n'est pas une offre, et la mettre en tête ferait passer
/// l'application pour un comparateur qui ne vérifie rien. Si aucun marchand
/// n'a de stock, on retombe sur le moins cher tout court — mieux vaut un repère
/// signalé en rupture que pas de repère du tout.
library;

import '../../../../core/utils/extensions.dart';
import '../entities/product.dart';

class BestOffer {
  const BestOffer._();

  static Merchant? of(Product product) {
    if (product.merchants.isEmpty) return null;

    final sorted = [...product.merchants]
      ..sort((a, b) => a.price.compareTo(b.price));

    return sorted.firstWhereOrNull((m) => m.inStock) ?? sorted.first;
  }

  /// Économie par rapport au prix moyen constaté. Négative ou nulle, elle
  /// n'est pas affichée : « 0 € d'économie » occupe une ligne pour ne rien
  /// dire, et une économie négative se raconterait comme un surcoût.
  static double? savingAgainstAverage(Product product) {
    final best = of(product);
    if (best == null) return null;
    final saving = product.averagePrice - best.price;
    return saving > 0.01 ? saving : null;
  }

  /// Marchands ordonnés pour l'affichage : en stock d'abord, puis par prix.
  static List<Merchant> ranked(Product product) {
    final list = [...product.merchants];
    list.sort((a, b) {
      if (a.inStock != b.inStock) return a.inStock ? -1 : 1;
      return a.price.compareTo(b.price);
    });
    return list;
  }

  /// Alternatives réellement moins chères que la meilleure offre trouvée.
  /// Proposer « un modèle équivalent » plus cher que ce qu'on vient d'afficher
  /// est le meilleur moyen de faire fermer l'application.
  static List<ProductAlternative> cheaperThanBest(Product product) {
    final reference = of(product)?.price ?? product.averagePrice;
    final list = product.alternatives
        .where((a) => a.price < reference)
        .toList()
      ..sort((a, b) => a.price.compareTo(b.price));
    return list;
  }
}
