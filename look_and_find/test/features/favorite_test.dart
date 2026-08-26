/// Le suivi de prix : ce qui compte comme une baisse, et ce qui déclenche
/// l'alerte.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/favorites/domain/entities/favorite.dart';
import 'package:look_and_find/features/product_detail/domain/entities/product.dart';

Favorite _favori({
  required double reference,
  required double actuel,
  double? seuil,
}) => Favorite(
  product: Product(
    id: 'x',
    title: 'Objet',
    category: ProductCategory.tech,
    averagePrice: actuel,
    currency: 'EUR',
    merchants: [
      Merchant(
        name: 'a',
        price: actuel,
        url: 'https://a.fr',
        inStock: true,
      ),
    ],
  ),
  savedAt: DateTime.utc(2026),
  referencePrice: reference,
  alertThreshold: seuil,
);

void main() {
  group('Favorite', () {
    test('constate une baisse par rapport au prix de mise en favori', () {
      expect(_favori(reference: 100, actuel: 80).hasDropped, isTrue);
      expect(_favori(reference: 100, actuel: 120).hasDropped, isFalse);
    });

    test('ignore une variation d\'un centime', () {
      expect(_favori(reference: 100, actuel: 99.995).hasDropped, isFalse);
    });

    test('ne déclenche l\'alerte qu\'au passage sous le seuil', () {
      expect(
        _favori(reference: 100, actuel: 85, seuil: 80).reachedThreshold,
        isFalse,
      );
      expect(
        _favori(reference: 100, actuel: 80, seuil: 80).reachedThreshold,
        isTrue,
      );
    });

    test('sans seuil, il n\'y a pas d\'alerte à déclencher', () {
      expect(_favori(reference: 100, actuel: 10).reachedThreshold, isFalse);
    });

    test('suit le meilleur prix marchand, pas le prix moyen', () {
      final favori = Favorite(
        product: const Product(
          id: 'x',
          title: 'Objet',
          category: ProductCategory.tech,
          averagePrice: 200,
          currency: 'EUR',
          merchants: [
            Merchant(
              name: 'a',
              price: 150,
              url: 'https://a.fr',
              inStock: true,
            ),
          ],
        ),
        savedAt: DateTime.utc(2026),
        referencePrice: 200,
      );

      expect(favori.currentPrice, 150);
      expect(favori.hasDropped, isTrue);
    });

    test('retirer le seuil demande un geste explicite', () {
      final avec = _favori(reference: 100, actuel: 100, seuil: 80);

      expect(avec.copyWith().alertThreshold, 80);
      expect(avec.copyWith(clearThreshold: true).alertThreshold, isNull);
    });
  });
}
