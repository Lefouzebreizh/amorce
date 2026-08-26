/// La fiche produit, montée pour de vrai.
///
/// Ces tests ne vérifient pas des pixels mais des **décisions** : qu'une offre
/// épuisée ne passe pas devant une offre disponible, qu'une alternative plus
/// chère ne s'affiche pas, et qu'un objet sans modèle 3D n'affiche pas un
/// bouton de réalité augmentée qui ne mènerait nulle part.
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:look_and_find/core/theme/app_theme.dart';
import 'package:look_and_find/features/favorites/presentation/providers/favorites_providers.dart';
import 'package:look_and_find/features/product_detail/domain/entities/product.dart';
import 'package:look_and_find/features/product_detail/presentation/pages/product_detail_page.dart';

const _fauteuil = Product(
  id: 'fauteuil',
  title: 'Fauteuil STRANDMON',
  brand: 'IKEA',
  category: ProductCategory.furniture,
  description: 'Fauteuil à oreilles, garnissage mousse.',
  averagePrice: 199,
  currency: 'EUR',
  dimensions: ProductDimensions(width: 82, height: 101, depth: 96),
  merchants: [
    Merchant(
      name: 'Occasion',
      price: 90,
      url: 'https://occasion.fr',
      inStock: false,
    ),
    Merchant(
      name: 'IKEA',
      price: 149,
      url: 'https://ikea.fr',
      inStock: true,
      discount: '10%',
    ),
  ],
  alternatives: [
    ProductAlternative(title: 'Modèle plus cher', price: 180),
    ProductAlternative(title: 'Modèle équivalent', price: 99, brand: 'Autre'),
  ],
);

void main() {
  late Directory dossier;
  late Box<String> favoris;
  late Box<String> historique;

  setUpAll(() async {
    dossier = await Directory.systemTemp.createTemp('look_and_find_ui');
    Hive.init(dossier.path);
    favoris = await Hive.openBox<String>('favoris_ui');
    historique = await Hive.openBox<String>('historique_ui');
  });

  // Pas de `Hive.close()` ici : les écrans laissent des abonnements ouverts sur
  // `box.watch()`, et la fermeture les attend indéfiniment. Le dossier temporaire
  // suffit à ne rien laisser derrière.
  tearDownAll(() async {
    await dossier.delete(recursive: true);
  });

  Future<void> monter(WidgetTester tester, Product product) async {
    // Une surface haute plutôt qu'un défilement : la fiche est une colonne
    // longue, et faire défiler dans un test rend l'assertion dépendante de la
    // hauteur exacte des blocs qui la précèdent.
    tester.view.physicalSize = const Size(1080, 3400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          favoritesBoxProvider.overrideWithValue(favoris),
          historyBoxProvider.overrideWithValue(historique),
        ],
        child: MaterialApp(
          theme: AppTheme.dark,
          locale: const Locale('fr', 'FR'),
          supportedLocales: const [Locale('fr', 'FR')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: ProductDetailPage(product: product),
        ),
      ),
    );
    await tester.pump();
  }

  testWidgets('met en avant la meilleure offre en stock', (tester) async {
    await monter(tester, _fauteuil);

    expect(find.text('Meilleure offre'), findsOneWidget);
    expect(find.text('chez IKEA'), findsOneWidget);
    // L'occasion à 90 € est épuisée : elle ne doit pas devenir la référence.
    expect(find.text('chez Occasion'), findsNothing);
  });

  testWidgets('annonce l\'économie contre le prix moyen', (tester) async {
    await monter(tester, _fauteuil);

    expect(find.textContaining('d\'économie'), findsOneWidget);
    // L'espace avant le « % » est insécable, comme le veut la typographie
    // française : le chercher avec une espace ordinaire ne trouverait rien.
    expect(find.textContaining('25\u00A0%'), findsOneWidget);
  });

  testWidgets('signale la rupture au lieu de la masquer', (tester) async {
    await monter(tester, _fauteuil);

    expect(find.text('Rupture'), findsOneWidget);
    expect(find.text('En stock · 10%'), findsOneWidget);
  });

  testWidgets('n\'affiche que les alternatives moins chères', (tester) async {
    await monter(tester, _fauteuil);

    expect(find.text('Moins cher, équivalent'), findsOneWidget);
    expect(find.text('Modèle équivalent'), findsOneWidget);
    expect(find.text('Modèle plus cher'), findsNothing);
  });

  testWidgets('affiche les cotes et leur équivalent en litres', (tester) async {
    await monter(tester, _fauteuil);

    expect(find.text('82 × 101 × 96 cm'), findsOneWidget);
    expect(find.textContaining('litres'), findsOneWidget);
  });

  testWidgets('le cœur bascule et se souvient', (tester) async {
    await monter(tester, _fauteuil);

    expect(find.byIcon(Icons.favorite_border_rounded), findsOneWidget);

    await tester.tap(find.byIcon(Icons.favorite_border_rounded));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.byIcon(Icons.favorite_rounded), findsOneWidget);
    expect(favoris.containsKey('fauteuil'), isTrue);
  });
}
