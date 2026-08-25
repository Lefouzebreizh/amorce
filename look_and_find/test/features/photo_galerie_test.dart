/// Identifier une photo déjà prise.
///
/// Ce parcours existe parce que le viseur suppose trois choses réunies —
/// l'objet devant soi, de la lumière, et une caméra qui s'ouvre. Ces tests
/// vérifient qu'il reste ouvert quand la caméra, elle, ne l'est pas : c'est
/// justement le cas où il sert le plus.
library;

import 'dart:io';
import 'dart:typed_data';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:look_and_find/core/constants/app_strings.dart';
import 'package:look_and_find/core/theme/app_theme.dart';
import 'package:look_and_find/core/utils/result.dart';
import 'package:look_and_find/features/favorites/presentation/providers/favorites_providers.dart';
import 'package:look_and_find/features/product_detail/domain/entities/product.dart';
import 'package:look_and_find/features/product_detail/presentation/pages/product_detail_page.dart';
import 'package:look_and_find/features/scanner/data/datasources/api_key_store.dart';
import 'package:look_and_find/core/network/app_exception.dart';
import 'package:look_and_find/features/scanner/data/datasources/photo_picker.dart';
import 'package:look_and_find/features/scanner/presentation/providers/camera_providers.dart';
import 'package:look_and_find/features/scanner/domain/repositories/scanner_repository.dart';
import 'package:look_and_find/features/scanner/presentation/pages/scanner_page.dart';
import 'package:look_and_find/features/scanner/presentation/providers/scanner_providers.dart';

/// Rend toujours la même photo, sans ouvrir la galerie du système.
class _FauxSelecteur implements PhotoPicker {
  _FauxSelecteur({this.reponse});

  final PickedPhoto? reponse;
  int appels = 0;

  @override
  Future<PickedPhoto?> pick() async {
    appels++;
    return reponse;
  }
}

/// Aucune caméra. C'est l'état réel d'un test — `availableCameras()` n'aboutit
/// jamais faute de plateforme — mais il faut le déclarer pour que le viseur
/// atteigne son écran d'échec au lieu de tourner indéfiniment.
class _CameraAbsente extends CameraSession {
  @override
  Future<CameraController> build() async =>
      throw const CameraUnavailableException('aucune caméra sur cet appareil');
}

class _FauxDepot implements ScannerRepository {
  _FauxDepot(this.reponse);

  final Result<Product> reponse;
  Uint8List? recue;

  @override
  Future<Result<Product>> identify(Uint8List photo) async {
    recue = photo;
    return reponse;
  }

  @override
  void abort() {}
}

const _produit = Product(
  id: 'lampe',
  title: 'Lampe Tolomeo',
  brand: 'Artemide',
  category: ProductCategory.decor,
  averagePrice: 200,
  currency: 'EUR',
);

final _photo = PickedPhoto(
  bytes: Uint8List.fromList([1, 2, 3, 4]),
  path: '/tmp/photo-choisie.jpg',
);

void main() {
  late Directory dossier;
  late Box<String> favoris;
  late Box<String> historique;
  late Box<String> reglages;

  setUpAll(() async {
    dossier = await Directory.systemTemp.createTemp('look_and_find_galerie');
    Hive.init(dossier.path);
    favoris = await Hive.openBox<String>('favoris_gal');
    historique = await Hive.openBox<String>('historique_gal');
    reglages = await Hive.openBox<String>('reglages_gal');
  });

  setUp(() async {
    await favoris.clear();
    await historique.clear();
    // Sans clé, le viseur affiche son écran de configuration et rien d'autre
    // n'est joignable.
    await ApiKeyStore(reglages).write('AIzaPourLeTest');
  });

  tearDownAll(() => dossier.delete(recursive: true));

  Future<ProviderContainer> monter(
    WidgetTester tester, {
    required PhotoPicker selecteur,
    required ScannerRepository depot,
  }) async {
    tester.view.physicalSize = const Size(1080, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final container = ProviderContainer(
      overrides: [
        favoritesBoxProvider.overrideWithValue(favoris),
        historyBoxProvider.overrideWithValue(historique),
        settingsBoxProvider.overrideWithValue(reglages),
        cameraSessionProvider.overrideWith(_CameraAbsente.new),
        photoPickerProvider.overrideWithValue(selecteur),
        scannerRepositoryProvider.overrideWithValue(depot),
      ],
    );
    addTearDown(container.dispose);

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
          home: const ScannerPage(),
        ),
      ),
    );
    await tester.pump();
    return container;
  }

  /// `pumpAndSettle` est inutilisable sur cet écran : l'ouverture de la caméra
  /// n'aboutit jamais dans un test, et son indicateur de chargement tourne sans
  /// fin. On avance donc l'horloge à la main.
  Future<void> stabiliser(WidgetTester tester) async {
    // `availableCameras()` passe par un canal de plateforme : seul l'horloge
    // réelle le fait aboutir (ici, en échec, faute de caméra).
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 100)),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
  }

  /// Le geste passe par l'horloge réelle : l'identification écrit dans Hive,
  /// et une écriture attendue sous horloge simulée ne se termine jamais.
  Future<void> toucher(WidgetTester tester, Finder cible) async {
    await tester.runAsync(() async {
      await tester.tap(cible);
      await Future<void>.delayed(const Duration(milliseconds: 80));
    });
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
  }

  testWidgets('sans caméra, la galerie reste proposée', (tester) async {
    // Aucune caméra n'existe dans un test : le viseur tombe sur son écran
    // d'échec, qui doit rester une porte et non une impasse.
    await monter(
      tester,
      selecteur: _FauxSelecteur(),
      depot: _FauxDepot(const Success(_produit)),
    );
    await stabiliser(tester);
    expect(find.text(AppStrings.pickPhoto), findsOneWidget);
  });

  testWidgets('une photo choisie mène à sa fiche', (tester) async {
    final selecteur = _FauxSelecteur(reponse: _photo);
    final depot = _FauxDepot(const Success(_produit));

    await monter(tester, selecteur: selecteur, depot: depot);
    await stabiliser(tester);
    await toucher(tester, find.text(AppStrings.pickPhoto));

    expect(selecteur.appels, 1);
    // La photo choisie est bien celle qui part à l'identification.
    expect(depot.recue, _photo.bytes);
    expect(find.byType(ProductDetailPage), findsOneWidget);
    expect(find.text('Lampe Tolomeo'), findsOneWidget);
  });

  testWidgets('renoncer à choisir ne déclenche rien', (tester) async {
    final selecteur = _FauxSelecteur();
    final depot = _FauxDepot(const Success(_produit));

    await monter(tester, selecteur: selecteur, depot: depot);
    await stabiliser(tester);
    await toucher(tester, find.text(AppStrings.pickPhoto));

    expect(selecteur.appels, 1);
    expect(depot.recue, isNull, reason: 'aucune identification lancée');
    expect(find.byType(ProductDetailPage), findsNothing);
  });

  testWidgets('la photo choisie est datée et rangée dans l\'historique', (
    tester,
  ) async {
    final container = await monter(
      tester,
      selecteur: _FauxSelecteur(reponse: _photo),
      depot: _FauxDepot(const Success(_produit)),
    );
    await stabiliser(tester);
    await toucher(tester, find.text(AppStrings.pickPhoto));

    final historiqueLu = container
        .read(favoritesLocalDataSourceProvider)
        .readHistory();
    expect(historiqueLu, hasLength(1));
    expect(historiqueLu.single.imagePath, _photo.path);
    expect(historiqueLu.single.capturedAt, isNotNull);
  });
}
