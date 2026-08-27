/// Le diagnostic qui désigne le fichier à corriger.
///
/// `tool/lecture_fiche.dart` répond à la question dont dépend tout le reste
/// quand une fiche est fausse : le modèle s'est-il trompé, ou l'avons-nous mal
/// lu ? On lui fait confiance pour choisir entre `gemini_prompt.dart` et
/// `product_dto.dart` — un verdict inversé fait durcir une invite déjà correcte,
/// ce qui dégrade l'identification de tous les autres objets.
///
/// Ces tests fixent donc la fidélité du diagnostic à la lecture réelle : il ne
/// doit rien signaler que le DTO accepte, et ne rien taire de ce qu'il écarte.
library;

import 'package:flutter_test/flutter_test.dart';

import '../../tool/lecture_fiche.dart';

void main() {
  group('Quand la lecture ne perd rien', () {
    test('le verdict renvoie vers l\'invite', () {
      final d = analyser({
        'title': 'Fauteuil STRANDMON',
        'brand': 'IKEA',
        'category': 'furniture',
        'average_price': 149.99,
        'currency': 'EUR',
        'dimensions': {'width': 82, 'height': 101, 'depth': 96, 'unit': 'cm'},
        'merchants': [
          {'name': 'IKEA', 'price': 149.99, 'url': 'https://www.ikea.com/fr'},
        ],
        'alternatives': [
          {'title': 'Équivalent', 'price': 89.99},
        ],
        'model_3d_url': 'https://exemple.fr/f.glb',
      });

      expect(d.concorde, isTrue);
      expect(d.fiche!.title, 'Fauteuil STRANDMON');
      expect(rapport(d), contains('gemini_prompt.dart'));
    });

    test('un prix à la française n\'est pas une perte', () {
      // Le DTO sait lire « 149,99 € ». Le signaler enverrait corriger une
      // lecture qui fait déjà son travail.
      final d = analyser({
        'title': 'Lampe',
        'average_price': '149,99 €',
        'merchants': [
          {'name': 'Boutique', 'price': '89,90 EUR', 'url': 'https://a.fr'},
        ],
      });

      expect(d.concorde, isTrue);
      expect(d.fiche!.averagePrice, 149.99);
    });

    test('une clé locale n\'est pas un champ inventé', () {
      // `id`, `captured_at` et `image_path` sont écrits par l'application après
      // coup ; leur absence du schéma est voulue.
      final d = analyser({
        'title': 'Objet',
        'id': 'abcd1234',
        'captured_at': '2026-01-01T00:00:00.000',
        'image_path': '/tmp/photo.jpg',
      });

      expect(d.concorde, isTrue);
    });
  });

  group('Quand la lecture écarte quelque chose', () {
    test('nomme le marchand tombé et pourquoi', () {
      final d = analyser({
        'title': 'Chaise',
        'merchants': [
          {'name': 'IKEA', 'price': 179, 'url': 'https://ikea.fr'},
          {'name': 'Conforama', 'price': 'à partir de', 'url': 'https://c.fr'},
          {'price': 149, 'url': 'https://x.fr'},
        ],
      });

      expect(d.fiche!.merchants.single.name, 'IKEA');
      expect(d.pertes, hasLength(2));
      expect(d.pertes.join(), contains('Conforama'));
      expect(d.pertes.join(), contains('« name » manquant'));
      expect(rapport(d), contains('product_dto.dart'));
    });

    test('signale une URL de modèle 3D écartée', () {
      final d = analyser({'title': 'Chaise', 'model_3d_url': 'chaise.glb'});

      expect(d.fiche!.canBeViewedInAr, isFalse);
      expect(d.pertes.single, contains('model_3d_url'));
    });

    test('signale un prix moyen retombé à zéro', () {
      final d = analyser({'title': 'Chaise', 'average_price': 'sur devis'});

      expect(d.fiche!.averagePrice, 0);
      expect(d.pertes.single, contains('sur devis'));
    });

    test('signale une catégorie hors énumération', () {
      final d = analyser({'title': 'Chaise', 'category': 'siège'});

      expect(d.pertes.single, contains('hors énumération'));
    });

    test('signale une clé que le schéma ne déclare pas', () {
      // Le modèle invente parfois un champ utile. Tant qu'il n'est pas au
      // schéma, personne ne le lit — et rien d'autre ne le dirait.
      final d = analyser({'title': 'Chaise', 'couleur': 'noir'});

      expect(d.pertes.single, contains('couleur'));
    });

    test('un titre absent est le seul échec fatal', () {
      final d = analyser({'brand': 'IKEA', 'average_price': 149});

      expect(d.fiche, isNull);
      expect(d.pertes.join(), contains('title'));
      expect(rapport(d), contains('Aucune fiche'));
    });

    test('des cotes illisibles laissent la projection sans repère', () {
      final d = analyser({
        'title': 'Chaise',
        'dimensions': {'width': 'inconnue', 'height': 'variable'},
      });

      expect(d.pertes.single, contains('dimensions'));
    });

    test('une cote noyée dans du texte reste une cote', () {
      // « environ 50 » vaut 50 pour la lecture, et c'est le bon comportement :
      // le signaler enverrait corriger un filtre qui fait son travail.
      final d = analyser({
        'title': 'Chaise',
        'dimensions': {'width': 'environ 50', 'height': '90 cm'},
      });

      expect(d.concorde, isTrue);
      expect(d.fiche!.dimensions.width, 50);
      expect(d.fiche!.dimensions.height, 90);
    });
  });
}
