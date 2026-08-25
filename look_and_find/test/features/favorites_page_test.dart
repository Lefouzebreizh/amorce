/// « Ma liste », montée pour de vrai.
///
/// Ce qui est vérifié ici est exactement ce que la fonctionnalité promet :
/// qu'une baisse attendue se voit sans avoir à la chercher, et qu'elle se
/// taise une fois vue.
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:look_and_find/core/theme/app_theme.dart';
import 'package:look_and_find/features/favorites/domain/entities/favorite.dart';
import 'package:look_and_find/features/favorites/presentation/pages/favorites_page.dart';
import 'package:look_and_find/features/favorites/presentation/providers/favorites_providers.dart';
import 'package:look_and_find/features/product_detail/domain/entities/product.dart';

Favorite _favori({
  required String id,
  required String titre,
  required double reference,
  required double actuel,
  double? seuil,
}) => Favorite(
  product: Product(
    id: id,
    title: titre,
    category: ProductCategory.tech,
    averagePrice: actuel,
    currency: 'EUR',
  ),
  savedAt: DateTime.utc(2026),
  referencePrice: reference,
  alertThreshold: seuil,
);

void main() {
  late Directory dossier;
  late Box<String> favoris;
  late Box<String> historique;

  setUpAll(() async {
    dossier = await Directory.systemTemp.createTemp('look_and_find_liste');
    Hive.init(dossier.path);
    favoris = await Hive.openBox<String>('favoris_liste');
    historique = await Hive.openBox<String>('historique_liste');
  });

  setUp(() => favoris.clear());

  // Voir CLAUDE.md : pas de `Hive.close()` dans un test d'interface, les
  // abonnements ouverts sur `box.watch()` le feraient attendre sans fin.
  tearDownAll(() => dossier.delete(recursive: true));

  Future<ProviderContainer> monter(
    WidgetTester tester,
    List<Favorite> liste,
  ) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final container = ProviderContainer(
      overrides: [
        favoritesBoxProvider.overrideWithValue(favoris),
        historyBoxProvider.overrideWithValue(historique),
      ],
    );
    addTearDown(container.dispose);

    // `runAsync` est indispensable ici : dans un test de widget, l'horloge est
    // simulée et n'avance qu'aux `pump`. Une écriture Hive attendue directement
    // dans le corps du test ne se termine donc jamais — le test se fige sans
    // message. `runAsync` la fait passer par l'horloge réelle.
    await tester.runAsync(() async {
      for (final favori in liste) {
        await container.read(favoritesRepositoryProvider).save(favori);
      }
    });

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: AppTheme.dark,
          locale: const Locale('fr', 'FR'),
          supportedLocales: const [Locale('fr', 'FR')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: const FavoritesPage(),
        ),
      ),
    );
    await tester.pump();
    return container;
  }

  testWidgets('sans alerte, aucun bandeau ne s\'affiche', (tester) async {
    await monter(tester, [
      _favori(id: 'a', titre: 'Casque', reference: 100, actuel: 95, seuil: 80),
    ]);

    expect(find.textContaining('sous votre seuil'), findsNothing);
    expect(find.text('Casque'), findsOneWidget);
  });

  testWidgets('une baisse sous le seuil s\'annonce en tête', (tester) async {
    await monter(tester, [
      _favori(id: 'a', titre: 'Casque', reference: 100, actuel: 60, seuil: 80),
    ]);

    expect(find.text('Un objet est passé sous votre seuil'), findsOneWidget);
    expect(find.textContaining('de moins qu\'à la mise en favori'), findsOneWidget);
  });

  testWidgets('plusieurs baisses sont comptées et cumulées', (tester) async {
    await monter(tester, [
      _favori(id: 'a', titre: 'Casque', reference: 100, actuel: 60, seuil: 80),
      _favori(id: 'b', titre: 'Lampe', reference: 200, actuel: 150, seuil: 180),
      _favori(id: 'c', titre: 'Chaise', reference: 90, actuel: 89, seuil: 50),
    ]);

    expect(find.text('2 objets sont passés sous votre seuil'), findsOneWidget);
    // 40 € + 50 € : le bandeau annonce le total, pas la plus grosse baisse.
    expect(find.textContaining('90,00'), findsOneWidget);
  });

  testWidgets('« Vu » fait taire le bandeau et l\'état est enregistré', (
    tester,
  ) async {
    final container = await monter(tester, [
      _favori(id: 'a', titre: 'Casque', reference: 100, actuel: 60, seuil: 80),
    ]);

    await tester.tap(find.text('Vu'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.textContaining('sous votre seuil'), findsNothing);
    expect(
      container.read(favoritesRepositoryProvider).find('a')!.acknowledgedPrice,
      60,
    );
  });
}
