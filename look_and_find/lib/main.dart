/// Démarrage de l'application.
///
/// Trois choses se règlent ici, et une seule fois :
///
/// 1. **Les boîtes Hive sont ouvertes avant le premier widget.** Chaque écran
///    qui lit un favori peut alors le faire de façon synchrone, sans traverser
///    un état de chargement pour une donnée déjà sur le disque. Elles entrent
///    dans l'arbre par surcharge de provider, ce qui rend aussi les tests
///    triviaux : une boîte en mémoire remplace tout le stockage.
/// 2. **Les symboles de date en français sont chargés.** `intl` ne les embarque
///    pas par défaut ; sans cet appel, la première date d'historique lève une
///    exception de locale non initialisée — en production seulement, ce qui est
///    le pire moment pour l'apprendre.
/// 3. **L'orientation est verrouillée en portrait.** Le viseur, la fiche et la
///    liste sont dessinés pour une colonne unique, et une caméra qui pivote
///    pendant une capture demande une gestion d'orientation qui n'apporterait
///    rien à ce parcours.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'app.dart';
import 'core/constants/app_config.dart';
import 'features/favorites/presentation/providers/favorites_providers.dart';
import 'features/scanner/presentation/providers/scanner_providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  await initializeDateFormatting('fr_FR');

  await Hive.initFlutter();
  final favorites = await Hive.openBox<String>(AppConfig.favoritesBox);
  final history = await Hive.openBox<String>(AppConfig.historyBox);
  final settings = await Hive.openBox<String>(AppConfig.settingsBox);

  runApp(
    ProviderScope(
      overrides: [
        favoritesBoxProvider.overrideWithValue(favorites),
        historyBoxProvider.overrideWithValue(history),
        settingsBoxProvider.overrideWithValue(settings),
      ],
      child: const LookAndFindApp(),
    ),
  );
}
