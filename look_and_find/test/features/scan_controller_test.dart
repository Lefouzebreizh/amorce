/// Le parcours de scan, câblé pour de vrai mais sans réseau ni caméra.
///
/// L'intérêt de ce test n'est pas l'appel lui-même : c'est de vérifier que
/// **l'enchaînement** tient. Une identification réussie doit laisser une trace
/// dans l'historique et mettre à jour le favori correspondant avant que la
/// fiche ne s'affiche — sinon le cœur apparaît vide sur un objet déjà suivi.
///
/// Il montre aussi ce que la surcharge de providers permet : tout le stockage
/// est remplacé par deux boîtes Hive temporaires, et tout le réseau par une
/// implémentation de quelques lignes.
library;

import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:look_and_find/core/network/app_exception.dart';
import 'package:look_and_find/core/utils/result.dart';
import 'package:look_and_find/features/favorites/domain/entities/favorite.dart';
import 'package:look_and_find/features/favorites/presentation/providers/favorites_providers.dart';
import 'package:look_and_find/features/product_detail/domain/entities/product.dart';
import 'package:look_and_find/features/scanner/domain/repositories/scanner_repository.dart';
import 'package:look_and_find/features/scanner/presentation/providers/scanner_providers.dart';

/// Répond ce qu'on lui a dit de répondre, sans réseau.
class _FauxDepot implements ScannerRepository {
  _FauxDepot(this.reponse);

  final Result<Product> reponse;
  int abandons = 0;

  @override
  Future<Result<Product>> identify(Uint8List photo) async => reponse;

  @override
  void abort() => abandons++;
}

const _produit = Product(
  id: 'objet-1',
  title: 'Lampe Tolomeo',
  brand: 'Artemide',
  category: ProductCategory.decor,
  averagePrice: 200,
  currency: 'EUR',
  merchants: [
    Merchant(name: 'Boutique', price: 150, url: 'https://a.fr', inStock: true),
  ],
);

void main() {
  late Directory dossier;
  late Box<String> favoris;
  late Box<String> historique;

  setUpAll(() async {
    dossier = await Directory.systemTemp.createTemp('look_and_find_test');
    Hive.init(dossier.path);
  });

  setUp(() async {
    favoris = await Hive.openBox<String>('favoris_test');
    historique = await Hive.openBox<String>('historique_test');
    await favoris.clear();
    await historique.clear();
  });

  tearDown(() async {
    await favoris.close();
    await historique.close();
  });

  tearDownAll(() async {
    await Hive.close();
    await dossier.delete(recursive: true);
  });

  ProviderContainer conteneur(ScannerRepository depot) {
    final container = ProviderContainer(
      overrides: [
        favoritesBoxProvider.overrideWithValue(favoris),
        historyBoxProvider.overrideWithValue(historique),
        scannerRepositoryProvider.overrideWithValue(depot),
      ],
    );
    addTearDown(container.dispose);
    // Un abonnement tenu pendant tout le test, comme le ferait l'écran : sans
    // lui, le contrôleur `autoDispose` serait libéré entre deux lectures.
    addTearDown(container.listen(scanControllerProvider, (_, _) {}).close);
    return container;
  }

  test('une identification réussie laisse une trace dans l\'historique', () async {
    final container = conteneur(_FauxDepot(const Success(_produit)));

    final resultat = await container
        .read(scanControllerProvider.notifier)
        .identify(Uint8List(0));

    expect(resultat, isNotNull);
    expect(resultat!.title, 'Lampe Tolomeo');
    // La date est posée par le cas d'usage, pas par le modèle.
    expect(resultat.capturedAt, isNotNull);

    final historiqueLu = container
        .read(favoritesLocalDataSourceProvider)
        .readHistory();
    expect(historiqueLu, hasLength(1));
    expect(historiqueLu.single.id, 'objet-1');
  });

  test('un échec remonte en erreur affichable, sans trace', () async {
    final container = conteneur(_FauxDepot(const Failure(NetworkException())));

    final resultat = await container
        .read(scanControllerProvider.notifier)
        .identify(Uint8List(0));

    expect(resultat, isNull);
    expect(
      container.read(scanControllerProvider).appError,
      isA<NetworkException>(),
    );
    expect(
      container.read(favoritesLocalDataSourceProvider).readHistory(),
      isEmpty,
    );
  });

  test('rescanner un favori moins cher signale la baisse', () async {
    final container = conteneur(_FauxDepot(const Success(_produit)));

    // L'objet est suivi à 300 € ; le scan le retrouve à 150 €.
    await container.read(favoritesRepositoryProvider).save(
      Favorite(
        product: _produit,
        savedAt: DateTime.utc(2026),
        referencePrice: 300,
      ),
    );

    await container
        .read(scanControllerProvider.notifier)
        .identify(Uint8List(0));

    final baisse = container.read(scanJournalProvider);
    expect(baisse, isNotNull);
    expect(baisse!.amount, closeTo(150, 0.001));
    expect(baisse.isAlert, isFalse, reason: 'aucun seuil n\'a été posé');

    container.read(scanJournalProvider.notifier).consume();
    expect(container.read(scanJournalProvider), isNull);
  });

  test('rescanner un objet non suivi ne signale rien', () async {
    final container = conteneur(_FauxDepot(const Success(_produit)));

    await container
        .read(scanControllerProvider.notifier)
        .identify(Uint8List(0));

    expect(container.read(scanJournalProvider), isNull);
  });
}
