/// La règle du comparateur : le moins cher **en stock**.
///
/// C'est la décision produit la plus lourde de conséquences de l'application ;
/// elle est donc verrouillée par des tests plutôt que par un commentaire.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/product_detail/domain/entities/product.dart';
import 'package:look_and_find/features/product_detail/domain/usecases/best_offer.dart';

Product _produit({
  double moyen = 100,
  List<Merchant> marchands = const [],
  List<ProductAlternative> alternatives = const [],
}) => Product(
  id: 'x',
  title: 'Objet',
  category: ProductCategory.furniture,
  averagePrice: moyen,
  currency: 'EUR',
  merchants: marchands,
  alternatives: alternatives,
);

Merchant _marchand(String nom, double prix, {bool stock = true}) =>
    Merchant(name: nom, price: prix, url: 'https://$nom.fr', inStock: stock);

void main() {
  group('BestOffer', () {
    test('retient le moins cher parmi les marchands en stock', () {
      final produit = _produit(
        marchands: [
          _marchand('cher', 120),
          _marchand('epuise', 60, stock: false),
          _marchand('bon', 80),
        ],
      );

      expect(BestOffer.of(produit)!.name, 'bon');
    });

    test('retombe sur le moins cher quand rien n\'est en stock', () {
      final produit = _produit(
        marchands: [
          _marchand('a', 120, stock: false),
          _marchand('b', 60, stock: false),
        ],
      );

      expect(BestOffer.of(produit)!.name, 'b');
    });

    test('n\'a pas d\'offre à proposer sans marchand', () {
      expect(BestOffer.of(_produit()), isNull);
      expect(BestOffer.savingAgainstAverage(_produit()), isNull);
    });

    test('ne montre une économie que si elle existe', () {
      final gagnant = _produit(moyen: 100, marchands: [_marchand('a', 80)]);
      final perdant = _produit(moyen: 100, marchands: [_marchand('a', 110)]);
      final egal = _produit(moyen: 100, marchands: [_marchand('a', 100)]);

      expect(BestOffer.savingAgainstAverage(gagnant), closeTo(20, 0.001));
      expect(BestOffer.savingAgainstAverage(perdant), isNull);
      expect(BestOffer.savingAgainstAverage(egal), isNull);
    });

    test('classe les marchands en stock d\'abord, puis par prix', () {
      final produit = _produit(
        marchands: [
          _marchand('epuise-pas-cher', 10, stock: false),
          _marchand('dispo-cher', 90),
          _marchand('dispo-pas-cher', 50),
        ],
      );

      expect(
        BestOffer.ranked(produit).map((m) => m.name),
        ['dispo-pas-cher', 'dispo-cher', 'epuise-pas-cher'],
      );
    });

    test('ne propose que les alternatives sous la meilleure offre', () {
      final produit = _produit(
        moyen: 100,
        marchands: [_marchand('a', 70)],
        alternatives: const [
          ProductAlternative(title: 'plus chère', price: 85),
          ProductAlternative(title: 'moins chère', price: 40),
          ProductAlternative(title: 'la moins chère', price: 20),
        ],
      );

      expect(
        BestOffer.cheaperThanBest(produit).map((a) => a.title),
        ['la moins chère', 'moins chère'],
      );
    });

    test('compare au prix moyen quand aucun marchand n\'est connu', () {
      final produit = _produit(
        moyen: 50,
        alternatives: const [
          ProductAlternative(title: 'sous le moyen', price: 30),
          ProductAlternative(title: 'au-dessus', price: 60),
        ],
      );

      expect(BestOffer.cheaperThanBest(produit), hasLength(1));
    });
  });
}
