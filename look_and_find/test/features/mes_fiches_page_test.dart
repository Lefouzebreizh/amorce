/// « Mes fiches » montée pour de vrai.
///
/// L'écran vide compte autant que l'écran plein : c'est le premier que voit
/// quelqu'un qui vient d'installer l'application, et une liste vide sans un mot
/// se lit comme une panne.
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:look_and_find/core/constants/app_strings.dart';
import 'package:look_and_find/core/theme/app_theme.dart';
import 'package:look_and_find/features/color_reader/domain/entities/color_reading.dart';
import 'package:look_and_find/features/fiche_objet/data/datasources/fiches_local_datasource.dart';
import 'package:look_and_find/features/fiche_objet/domain/entities/fiche_objet.dart';
import 'package:look_and_find/features/fiche_objet/presentation/pages/mes_fiches_page.dart';
import 'package:look_and_find/features/fiche_objet/presentation/providers/fiches_providers.dart';
import 'package:look_and_find/features/scanner/data/datasources/api_key_store.dart';
import 'package:look_and_find/features/scanner/presentation/providers/scanner_providers.dart';

void main() {
  late Directory dossier;
  late Box<String> boite;
  late Box<String> reglages;

  setUpAll(() async {
    dossier = await Directory.systemTemp.createTemp('mes_fiches_ui');
    Hive.init(dossier.path);
    boite = await Hive.openBox<String>('fiches_ui');
    reglages = await Hive.openBox<String>('reglages_fiches_ui');
  });

  setUp(() async {
    await boite.clear();
    await ApiKeyStore(reglages).write('AIzaPourLeTest');
  });

  // Pas de `Hive.close()` : l'écran laisse un abonnement ouvert sur
  // `box.watch()`, et la fermeture l'attend indéfiniment — le test se fige
  // alors sans message. Supprimer le dossier suffit.
  tearDownAll(() => dossier.delete(recursive: true));

  Future<void> monter(WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(393, 873));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          fichesBoxProvider.overrideWithValue(boite),
          settingsBoxProvider.overrideWithValue(reglages),
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
          home: const MesFichesPage(),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('sans fiche, elle dit quoi faire plutôt que de rester vide',
      (tester) async {
    await monter(tester);

    expect(find.text(AppStrings.noFiches), findsOneWidget);
    expect(find.text(AppStrings.noFichesBody), findsOneWidget);
  });

  testWidgets('une fiche gardée s\'affiche avec ce qui la distingue',
      (tester) async {
    // L'écriture passe par l'horloge réelle : sous horloge simulée, une
    // écriture Hive attendue directement ne se termine jamais et le test se
    // fige sans message.
    await tester.runAsync(
      () => FichesLocalDataSource(boite).enregistrer(
        FicheObjet(
          nom: 'Couteau d\'office',
          categorie: 'ustensile de cuisine',
          couleur: const ColorReading('brun'),
          capturedAt: DateTime.now(),
        ),
      ),
    );

    await monter(tester);

    expect(find.text('Couteau d\'office'), findsOneWidget);
    // Catégorie et couleur sur la même ligne : c'est ce qui départage deux
    // fiches portant le même nom.
    expect(find.text('ustensile de cuisine · brun'), findsOneWidget);
    expect(find.text(AppStrings.noFiches), findsNothing);
  });

  testWidgets('elle ouvre la fiche complète au toucher', (tester) async {
    await tester.runAsync(
      () => FichesLocalDataSource(boite).enregistrer(
        FicheObjet(
          nom: 'Perceuse sans fil',
          usage: 'Percer et visser sans être relié au secteur.',
          conseils: const ['Retirer la batterie avant de changer le foret'],
          capturedAt: DateTime.now(),
        ),
      ),
    );

    await monter(tester);
    await tester.tap(find.text('Perceuse sans fil'));
    await tester.pumpAndSettle();

    expect(
      find.text('Percer et visser sans être relié au secteur.'),
      findsOneWidget,
    );
    expect(
      find.text('Retirer la batterie avant de changer le foret'),
      findsOneWidget,
    );
  });

  testWidgets('la liste ne promet ni prix ni marchand', (tester) async {
    await tester.runAsync(
      () => FichesLocalDataSource(boite).enregistrer(
        FicheObjet(nom: 'Lampe', capturedAt: DateTime.now()),
      ),
    );

    await monter(tester);

    for (final mot in ['prix', 'Prix', '€', 'marchand', 'Acheter']) {
      expect(
        find.textContaining(mot),
        findsNothing,
        reason: '« $mot » annonce le comparateur, remis à la version deux.',
      );
    }
  });
}
