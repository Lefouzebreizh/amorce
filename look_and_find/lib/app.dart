/// Racine de l'application : thème, langue, écran d'entrée.
///
/// L'écran d'entrée est le viseur, sans page d'accueil intermédiaire. Le geste
/// que l'application propose — photographier un objet — doit être à un appui de
/// l'ouverture, pas à trois ; tout le reste (fiche, liste, réalité augmentée)
/// se rejoint depuis là.
///
/// Le français est la seule langue déclarée : les textes sont écrits en dur en
/// français, et proposer des `MaterialLocalizations` anglaises à côté ne
/// donnerait qu'une interface à moitié traduite.
library;

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/constants/app_strings.dart';
import 'core/theme/app_theme.dart';
import 'features/scanner/presentation/pages/scanner_page.dart';

class LookAndFindApp extends StatelessWidget {
  const LookAndFindApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppStrings.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark,
      locale: const Locale('fr', 'FR'),
      supportedLocales: const [Locale('fr', 'FR')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: const ScannerPage(),
    );
  }
}
