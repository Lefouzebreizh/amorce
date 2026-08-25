/// Ce que le format du modèle 3D autorise, plateforme par plateforme.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/ar_view/domain/entities/ar_model.dart';
import 'package:look_and_find/features/product_detail/domain/entities/product.dart';

Product _produit({String? modele, ProductCategory categorie = ProductCategory.furniture}) =>
    Product(
      id: 'x',
      title: 'Objet',
      category: categorie,
      averagePrice: 100,
      currency: 'EUR',
      model3dUrl: modele,
    );

void main() {
  group('ArModel', () {
    test('n\'existe pas sans modèle 3D', () {
      expect(ArModel.from(_produit()), isNull);
      expect(ArModel.from(_produit(modele: '')), isNull);
    });

    test('un .glb se pose sur Android mais pas avec Quick Look', () {
      final modele = ArModel.from(_produit(modele: 'https://a.fr/x.glb'))!;

      expect(modele.src, 'https://a.fr/x.glb');
      expect(modele.iosSrc, isNull);
      expect(modele.canPlaceOnIos, isFalse);
    });

    test('un .usdz alimente aussi Quick Look', () {
      final modele = ArModel.from(_produit(modele: 'https://a.fr/x.USDZ'))!;

      expect(modele.iosSrc, 'https://a.fr/x.USDZ');
      expect(modele.canPlaceOnIos, isTrue);
    });

    test('la décoration se pose au mur, le reste au sol', () {
      expect(
        ArModel.from(
          _produit(modele: 'https://a.fr/x.glb', categorie: ProductCategory.decor),
        )!.isWallMounted,
        isTrue,
      );
      expect(
        ArModel.from(_produit(modele: 'https://a.fr/x.glb'))!.isWallMounted,
        isFalse,
      );
    });
  });
}
