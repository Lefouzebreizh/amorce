/// Forme stockée d'un favori : le JSON de la fiche, plus les quelques champs
/// que l'utilisateur a ajoutés (date, prix de référence, seuil d'alerte).
///
/// Pas d'adaptateur Hive typé, et c'est délibéré : un `TypeAdapter` généré
/// fige un numéro de champ par propriété, et chaque évolution de la fiche
/// produit demanderait alors une migration binaire. Ici, la boîte contient des
/// chaînes JSON relues par le même parseur tolérant que la réponse du modèle —
/// un champ ajouté ou retiré ne casse rien.
library;

import 'dart:convert';

import '../../../product_detail/data/models/product_dto.dart';
import '../../domain/entities/favorite.dart';

class FavoriteDto {
  const FavoriteDto._();

  static String encode(Favorite favorite) => jsonEncode({
    'product': ProductDto.fromEntity(favorite.product).toJson(),
    'saved_at': favorite.savedAt.toIso8601String(),
    'reference_price': favorite.referencePrice,
    'alert_threshold': favorite.alertThreshold,
    'last_checked_at': favorite.lastCheckedAt?.toIso8601String(),
  });

  /// `null` si l'enregistrement est illisible : une entrée corrompue est
  /// ignorée, elle ne fait pas échouer la lecture des autres favoris.
  static Favorite? decode(String raw) {
    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      final product = ProductDto.fromJson(
        json['product'] as Map<String, dynamic>,
      ).toEntity();
      if (product == null) return null;

      return Favorite(
        product: product,
        savedAt:
            DateTime.tryParse(json['saved_at'] as String? ?? '') ??
            DateTime.now(),
        referencePrice: (json['reference_price'] as num?)?.toDouble() ??
            product.averagePrice,
        alertThreshold: (json['alert_threshold'] as num?)?.toDouble(),
        lastCheckedAt: DateTime.tryParse(
          json['last_checked_at'] as String? ?? '',
        ),
      );
    } catch (_) {
      return null;
    }
  }
}
