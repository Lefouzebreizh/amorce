/// Mise en forme : les cas où un affichage naïf mentirait.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/core/utils/formatters.dart';
import 'package:look_and_find/features/product_detail/domain/entities/product.dart';

void main() {
  group('Formatters.dimensions', () {
    test('assemble les trois cotes', () {
      expect(
        Formatters.dimensions(width: 80, height: 75, depth: 80),
        '80 × 75 × 80 cm',
      );
    });

    test('omet les cotes manquantes plutôt que d\'écrire zéro', () {
      expect(Formatters.dimensions(width: 80, height: 0), '80 cm');
      expect(Formatters.dimensions(), '');
    });

    test('écrit les décimales à la française', () {
      expect(Formatters.dimensions(width: 12.5), '12,5 cm');
    });
  });

  group('ProductDimensions.litres', () {
    test('convertit un volume donné en centimètres', () {
      const dims = ProductDimensions(width: 10, height: 10, depth: 10);
      expect(dims.litres, closeTo(1, 0.001));
    });

    test('tient compte de l\'unité annoncée', () {
      const enMetres = ProductDimensions(
        width: 0.1,
        height: 0.1,
        depth: 0.1,
        unit: 'm',
      );
      const enMillimetres = ProductDimensions(
        width: 100,
        height: 100,
        depth: 100,
        unit: 'mm',
      );

      expect(enMetres.litres, closeTo(1, 0.001));
      expect(enMillimetres.litres, closeTo(1, 0.001));
    });

    test('ne calcule rien quand une cote manque', () {
      expect(const ProductDimensions(width: 10, height: 10).litres, isNull);
    });
  });
}
