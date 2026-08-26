/// Ce que le parseur doit encaisser sans perdre la fiche.
///
/// Ces cas ne sont pas théoriques : ce sont les formes réellement renvoyées par
/// un modèle de langage à qui l'on demande du JSON en français — prix à virgule,
/// clés absentes, « null » écrit en toutes lettres, URL inventée.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/product_detail/data/models/product_dto.dart';
import 'package:look_and_find/features/product_detail/domain/entities/product.dart';

void main() {
  group('ProductDto', () {
    test('lit une fiche complète', () {
      final product = ProductDto.fromJson({
        'title': 'Fauteuil STRANDMON',
        'brand': 'IKEA',
        'category': 'furniture',
        'average_price': 149.99,
        'currency': 'EUR',
        'dimensions': {
          'width': 82,
          'height': 101,
          'depth': 96,
          'unit': 'cm',
        },
        'merchants': [
          {
            'name': 'IKEA',
            'price': 149.99,
            'url': 'https://www.ikea.com/fr',
            'in_stock': true,
            'discount': '10%',
          },
        ],
        'alternatives': [
          {'title': 'Fauteuil équivalent', 'price': 89.99, 'brand': 'Autre'},
        ],
        'model_3d_url': 'https://exemple.fr/fauteuil.glb',
      }).toEntity();

      expect(product, isNotNull);
      expect(product!.title, 'Fauteuil STRANDMON');
      expect(product.category, ProductCategory.furniture);
      expect(product.merchants.single.discount, '10%');
      expect(product.alternatives.single.price, 89.99);
      expect(product.canBeViewedInAr, isTrue);
    });

    test('accepte un prix écrit à la française', () {
      final product = ProductDto.fromJson({
        'title': 'Lampe',
        'average_price': '149,99 €',
        'merchants': [
          {'name': 'Boutique', 'price': '89,90 EUR', 'url': 'https://a.fr'},
        ],
      }).toEntity();

      expect(product!.averagePrice, 149.99);
      expect(product.merchants.single.price, 89.90);
    });

    test('refuse la fiche quand le titre manque, et elle seule', () {
      expect(ProductDto.fromJson({'average_price': 12}).toEntity(), isNull);
      expect(ProductDto.fromJson({'title': '   '}).toEntity(), isNull);
      expect(ProductDto.fromJson({'title': 'Chaise'}).toEntity(), isNotNull);
    });

    test('traite « null » et « N/A » comme des champs absents', () {
      final product = ProductDto.fromJson({
        'title': 'Chaise',
        'brand': 'null',
        'description': 'N/A',
      }).toEntity();

      expect(product!.brand, isNull);
      expect(product.description, isNull);
    });

    test('écarte un marchand illisible sans perdre les autres', () {
      final product = ProductDto.fromJson({
        'title': 'Chaise',
        'merchants': [
          {'name': 'Complet', 'price': 20, 'url': 'https://a.fr'},
          {'name': 'Sans prix', 'url': 'https://b.fr'},
          'chaîne inattendue',
        ],
      }).toEntity();

      expect(product!.merchants, hasLength(1));
      expect(product.merchants.single.name, 'Complet');
    });

    test('suppose la disponibilité quand elle n\'est pas précisée', () {
      final product = ProductDto.fromJson({
        'title': 'Chaise',
        'merchants': [
          {'name': 'A', 'price': 20, 'url': 'https://a.fr'},
        ],
      }).toEntity();

      expect(product!.merchants.single.inStock, isTrue);
    });

    test('rejette les URL qui ne sont pas du web', () {
      final product = ProductDto.fromJson({
        'title': 'Chaise',
        'model_3d_url': 'javascript:alert(1)',
        'merchants': [
          {'name': 'A', 'price': 20, 'url': 'pas-une-url'},
        ],
      }).toEntity();

      expect(product!.model3dUrl, isNull);
      expect(product.merchants.single.url, isEmpty);
    });

    test('retombe sur « Autre » pour une catégorie hors liste', () {
      final product = ProductDto.fromJson({
        'title': 'Chaise',
        'category': 'Meubles',
      }).toEntity();

      expect(product!.category, ProductCategory.unknown);
    });

    test('donne le même identifiant au même objet rescanné', () {
      final premier = ProductDto.buildId(brand: 'IKEA', title: 'Strandmon');
      final second = ProductDto.buildId(brand: 'ikea', title: '  STRANDMON ');
      final autre = ProductDto.buildId(brand: 'IKEA', title: 'Poäng');

      expect(premier, second);
      expect(premier, isNot(autre));
    });

    test('fait un aller-retour sans perdre les champs locaux', () {
      final origine = ProductDto.fromJson({
        'title': 'Chaise',
        'average_price': 40,
        'currency': 'EUR',
        'merchants': [
          {'name': 'A', 'price': 30, 'url': 'https://a.fr', 'in_stock': false},
        ],
      }).toEntity()!.copyWith(
        capturedAt: DateTime.utc(2026, 3, 4, 10),
        imagePath: '/tmp/photo.jpg',
      );

      final relu = ProductDto.decode(
        ProductDto.fromEntity(origine).encode(),
      ).toEntity()!;

      expect(relu.id, origine.id);
      expect(relu.capturedAt, DateTime.utc(2026, 3, 4, 10));
      expect(relu.imagePath, '/tmp/photo.jpg');
      expect(relu.merchants.single.inStock, isFalse);
    });
  });
}
