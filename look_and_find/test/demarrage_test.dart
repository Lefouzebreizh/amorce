/// Le démarrage de l'application, de bout en bout.
///
/// Rien ne couvrait `app.dart` jusqu'ici : ni l'analyse statique, ni les tests
/// d'écran, qui montent chacun une page isolée dans un `MaterialApp` fabriqué
/// pour l'occasion. Un câblage cassé — un thème mal formé, une locale sans
/// délégué, un provider oublié dans les surcharges — ne se serait vu qu'au
/// premier lancement sur un téléphone, c'est-à-dire au pire moment.
///
/// Ce que ce fichier ne couvre pas : `main.dart` lui-même, qui ouvre les boîtes
/// Hive et appelle `runApp`. Il n'est pas appelable depuis un test. Les
/// surcharges reproduites ici sont donc à tenir manuellement en accord avec
/// les siennes — c'est le seul endroit du dépôt où une duplication est
/// assumée, faute de mieux.
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:look_and_find/app.dart';
import 'package:look_and_find/features/favorites/presentation/providers/favorites_providers.dart';
import 'package:look_and_find/features/scanner/data/datasources/api_key_store.dart';
import 'package:look_and_find/features/scanner/presentation/pages/api_key_page.dart';
import 'package:look_and_find/features/scanner/presentation/providers/scanner_providers.dart';

void main() {
  late Directory dossier;
  late Box<String> favoris;
  late Box<String> historique;
  late Box<String> reglages;

  setUpAll(() async {
    dossier = await Directory.systemTemp.createTemp('look_and_find_demarrage');
    Hive.init(dossier.path);
    favoris = await Hive.openBox<String>('favoris_dem');
    historique = await Hive.openBox<String>('historique_dem');
    reglages = await Hive.openBox<String>('reglages_dem');
  });

  setUp(() => reglages.clear());

  // Voir look_and_find/CLAUDE.md : pas de `Hive.close()` dans un test
  // d'interface, les abonnements ouverts sur `box.watch()` le feraient
  // attendre sans fin.
  tearDownAll(() => dossier.delete(recursive: true));

  Future<void> demarrer(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          favoritesBoxProvider.overrideWithValue(favoris),
          historyBoxProvider.overrideWithValue(historique),
          settingsBoxProvider.overrideWithValue(reglages),
        ],
        child: const LookAndFindApp(),
      ),
    );
    await tester.pump();
  }

  testWidgets('l\'application démarre sans lever', (tester) async {
    await demarrer(tester);

    expect(tester.takeException(), isNull);
    expect(find.byType(MaterialApp), findsOneWidget);
  });

  testWidgets('sans clé, elle explique et propose de la saisir', (
    tester,
  ) async {
    await demarrer(tester);

    // C'est l'état de l'APK distribué sans secret : un écran qui donne la
    // marche à suivre, pas une caméra noire.
    expect(find.text('Clé Gemini absente'), findsOneWidget);
    expect(find.text('Saisir ma clé'), findsOneWidget);
  });

  testWidgets('le bouton mène à l\'écran de saisie', (tester) async {
    await demarrer(tester);

    await tester.tap(find.text('Saisir ma clé'));
    await tester.pumpAndSettle();

    expect(find.byType(ApiKeyPage), findsOneWidget);
    expect(find.text('Aucune clé'), findsOneWidget);
  });

  testWidgets('une clé saisie fait quitter l\'écran de configuration', (
    tester,
  ) async {
    await demarrer(tester);

    await tester.tap(find.text('Saisir ma clé'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'AIzaSaisieDepuisEcran');
    // L'écriture Hive passe par l'horloge réelle : dans un test de widget,
    // l'horloge simulée ne la ferait jamais aboutir.
    await tester.runAsync(() async {
      await tester.tap(find.text('Enregistrer'));
    });
    await tester.pumpAndSettle();

    expect(ApiKeyStore(reglages).read(), 'AIzaSaisieDepuisEcran');
    // Le viseur ne réaffiche plus « clé absente ». Il tente d'ouvrir la caméra,
    // qui n'existe pas ici : l'application doit alors le dire, pas planter.
    expect(find.text('Clé Gemini absente'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
