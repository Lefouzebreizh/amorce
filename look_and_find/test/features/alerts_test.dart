/// Les alertes de prix : ce qui doit être signalé, et ce qui doit se taire.
///
/// Le cœur du sujet est l'acquittement. Une alerte qui revient à chaque
/// ouverture cesse d'être lue, et c'est la suivante — la vraie — qui passe
/// alors inaperçue. Ces tests verrouillent donc autant le silence que le
/// signal.
library;

import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:look_and_find/features/favorites/data/models/favorite_dto.dart';
import 'package:look_and_find/features/favorites/domain/entities/favorite.dart';
import 'package:look_and_find/features/favorites/domain/usecases/acknowledge_alerts.dart';
import 'package:look_and_find/features/favorites/presentation/providers/favorites_providers.dart';
import 'package:look_and_find/features/product_detail/domain/entities/product.dart';

Favorite _favori({
  String id = 'x',
  required double reference,
  required double actuel,
  double? seuil,
  double? acquitte,
}) => Favorite(
  product: Product(
    id: id,
    title: 'Objet $id',
    category: ProductCategory.tech,
    averagePrice: actuel,
    currency: 'EUR',
  ),
  savedAt: DateTime.utc(2026),
  referencePrice: reference,
  alertThreshold: seuil,
  acknowledgedPrice: acquitte,
);

void main() {
  group('Favorite.isAlerting', () {
    test('se tait tant que le seuil n\'est pas franchi', () {
      expect(
        _favori(reference: 100, actuel: 85, seuil: 80).isAlerting,
        isFalse,
      );
    });

    test('signale au premier passage sous le seuil', () {
      expect(_favori(reference: 100, actuel: 80, seuil: 80).isAlerting, isTrue);
    });

    test('se tait après acquittement au même prix', () {
      expect(
        _favori(reference: 100, actuel: 80, seuil: 80, acquitte: 80).isAlerting,
        isFalse,
      );
    });

    test('resignale si le prix baisse encore après acquittement', () {
      expect(
        _favori(reference: 100, actuel: 70, seuil: 80, acquitte: 80).isAlerting,
        isTrue,
      );
    });

    test('un favori sans seuil ne signale jamais', () {
      expect(_favori(reference: 100, actuel: 10).isAlerting, isFalse);
    });

    test('changer le seuil rend son alerte audible à nouveau', () {
      final acquitte = _favori(
        reference: 100,
        actuel: 70,
        seuil: 80,
        acquitte: 70,
      );
      expect(acquitte.isAlerting, isFalse);

      // L'utilisateur remonte son seuil : l'acquittement portait sur l'ancien.
      expect(acquitte.copyWith(alertThreshold: 90).isAlerting, isTrue);
    });

    test('retirer le seuil efface l\'acquittement', () {
      final sansSeuil = _favori(
        reference: 100,
        actuel: 70,
        seuil: 80,
        acquitte: 70,
      ).copyWith(clearThreshold: true);

      expect(sansSeuil.alertThreshold, isNull);
      expect(sansSeuil.acknowledgedPrice, isNull);
      expect(sansSeuil.isAlerting, isFalse);
    });

    test('une modification sans rapport conserve l\'acquittement', () {
      final apres = _favori(
        reference: 100,
        actuel: 70,
        seuil: 80,
        acquitte: 70,
      ).copyWith(lastCheckedAt: DateTime.utc(2026, 6));

      expect(apres.acknowledgedPrice, 70);
    });
  });

  group('PendingAlerts', () {
    test('ne retient que ce qui alerte, plus forte baisse en tête', () {
      final liste = [
        _favori(id: 'petite', reference: 100, actuel: 90, seuil: 95),
        _favori(id: 'muette', reference: 100, actuel: 99),
        _favori(id: 'grosse', reference: 100, actuel: 40, seuil: 95),
        _favori(id: 'acquittee', reference: 100, actuel: 50, seuil: 95, acquitte: 50),
      ];

      expect(
        PendingAlerts.from(liste).map((f) => f.product.id),
        ['grosse', 'petite'],
      );
    });

    test('rien à signaler sur une liste vide', () {
      expect(PendingAlerts.from(const []), isEmpty);
    });
  });

  group('AcknowledgeAlerts', () {
    late Directory dossier;
    late Box<String> favoris;
    late Box<String> historique;

    setUpAll(() async {
      dossier = await Directory.systemTemp.createTemp('look_and_find_alertes');
      Hive.init(dossier.path);
      favoris = await Hive.openBox<String>('favoris_alertes');
      historique = await Hive.openBox<String>('historique_alertes');
    });

    setUp(() => favoris.clear());

    tearDownAll(() => dossier.delete(recursive: true));

    ProviderContainer conteneur() {
      final container = ProviderContainer(
        overrides: [
          favoritesBoxProvider.overrideWithValue(favoris),
          historyBoxProvider.overrideWithValue(historique),
        ],
      );
      addTearDown(container.dispose);
      return container;
    }

    test('acquitter tout fait taire la liste, et elle le reste', () async {
      final container = conteneur();
      final liste = [
        _favori(id: 'a', reference: 100, actuel: 40, seuil: 95),
        _favori(id: 'b', reference: 100, actuel: 90, seuil: 95),
      ];
      for (final f in liste) {
        await container.read(favoritesRepositoryProvider).save(f);
      }

      expect(PendingAlerts.from(liste), hasLength(2));

      await container.read(acknowledgeAlertsProvider).all(liste);

      final relus = container
          .read(favoritesLocalDataSourceProvider)
          .readFavorites();
      expect(PendingAlerts.from(relus), isEmpty);
      expect(relus.every((f) => f.acknowledgedPrice != null), isTrue);
    });

    test('l\'acquittement survit à un aller-retour sur le disque', () {
      final favori = _favori(
        reference: 100,
        actuel: 70,
        seuil: 80,
        acquitte: 75,
      );

      final relu = FavoriteDto.decode(FavoriteDto.encode(favori))!;

      expect(relu.acknowledgedPrice, 75);
      expect(relu.alertThreshold, 80);
    });

    test('un favori enregistré avant les alertes se relit sans acquittement', () {
      // Forme produite par la version précédente : la clé n'existait pas.
      final relu = FavoriteDto.decode(
        '{"product":{"title":"Objet","average_price":70,"currency":"EUR"},'
        '"saved_at":"2026-01-01T00:00:00.000Z","reference_price":100,'
        '"alert_threshold":80}',
      )!;

      expect(relu.acknowledgedPrice, isNull);
      expect(relu.isAlerting, isTrue);
    });
  });
}
