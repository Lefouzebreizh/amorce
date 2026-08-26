/// La clé Gemini : d'où elle vient, et laquelle gagne.
///
/// L'ordre de priorité n'est pas un détail de confort. Une clé compilée est
/// une chaîne en clair dans le binaire ; pouvoir la remplacer sans reconstruire
/// est la seule façon de réagir vite à une clé fuitée. Ces tests verrouillent
/// donc que la saisie l'emporte, et qu'on peut revenir en arrière.
library;

import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:look_and_find/core/constants/app_config.dart';
import 'package:look_and_find/features/scanner/data/datasources/api_key_store.dart';
import 'package:look_and_find/features/scanner/presentation/providers/scanner_providers.dart';

void main() {
  late Directory dossier;
  late Box<String> reglages;

  setUpAll(() async {
    dossier = await Directory.systemTemp.createTemp('look_and_find_cle');
    Hive.init(dossier.path);
    reglages = await Hive.openBox<String>('reglages_test');
  });

  setUp(() => reglages.clear());

  tearDownAll(() => dossier.delete(recursive: true));

  ProviderContainer conteneur() {
    final container = ProviderContainer(
      overrides: [settingsBoxProvider.overrideWithValue(reglages)],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('ApiKeyStore', () {
    test('ne rend rien tant que rien n\'a été saisi', () {
      expect(ApiKeyStore(reglages).read(), isNull);
    });

    test('range et relit une clé', () async {
      final store = ApiKeyStore(reglages);
      await store.write('AIzaTest123');
      expect(store.read(), 'AIzaTest123');
    });

    test('rogne les espaces d\'un collage', () async {
      final store = ApiKeyStore(reglages);
      await store.write('  AIzaTest123\n');
      expect(store.read(), 'AIzaTest123');
    });

    test('traite une saisie vide comme une absence de clé', () async {
      final store = ApiKeyStore(reglages);
      await store.write('   ');
      expect(store.read(), isNull);
    });

    test('efface ce qui a été rangé', () async {
      final store = ApiKeyStore(reglages);
      await store.write('AIzaTest123');
      await store.clear();
      expect(store.read(), isNull);
    });
  });

  group('geminiApiKey', () {
    test('sans rien de saisi, retombe sur la clé du build', () {
      final container = conteneur();
      expect(container.read(geminiApiKeyProvider), AppConfig.compiledApiKey);
    });

    test('une clé saisie l\'emporte, et immédiatement', () async {
      final container = conteneur();

      await container.read(geminiApiKeyProvider.notifier).save('AIzaSaisie');

      expect(container.read(geminiApiKeyProvider), 'AIzaSaisie');
      // Le rangement a bien eu lieu : ce n'est pas qu'un état en mémoire.
      expect(ApiKeyStore(reglages).read(), 'AIzaSaisie');
    });

    test('l\'oublier revient à la clé du build', () async {
      final container = conteneur();

      await container.read(geminiApiKeyProvider.notifier).save('AIzaSaisie');
      await container.read(geminiApiKeyProvider.notifier).forget();

      expect(container.read(geminiApiKeyProvider), AppConfig.compiledApiKey);
      expect(ApiKeyStore(reglages).read(), isNull);
    });

    test('une clé saisie survit à un redémarrage de l\'application', () async {
      await ApiKeyStore(reglages).write('AIzaPersistee');

      // Un conteneur neuf, comme au lancement suivant.
      expect(conteneur().read(geminiApiKeyProvider), 'AIzaPersistee');
    });
  });
}
