/// Le troisième point d'entrée : **la sonde**, un instrument, pas une
/// application.
///
/// ```bash
/// flutter run -t lib/main_sonde.dart
/// ```
///
/// **Pourquoi un point d'entrée de plus.** Le projet en portait déjà deux, et
/// pour une raison qui vaut ici mot pour mot : l'élagage de Dart ne conserve
/// dans un binaire que ce qui est atteignable depuis son point d'entrée. Un
/// écran de diagnostic branché dans `main_tout_seul.dart` entrerait dans
/// l'application de l'enfant — avec l'appareil photo, le moteur de
/// reconnaissance et un écran plein de mots anglais qu'il ne peut pas lire.
///
/// Il ne suffit pas de « ne pas mettre de bouton » : c'est l'`import` qui décide
/// de ce qui existe dans le binaire, pas la navigation.
///
/// **Ce qu'elle fait, et pourquoi elle existe.** Elle relève ce que ML Kit voit
/// réellement — les mots bruts et leur confiance — pour que la table de
/// correspondance entre ces mots et les dix-sept gestes du corpus s'écrive à
/// partir de mesures. Tant que ces relevés n'existent pas, cette table ne
/// s'écrit pas : c'est tout le propos de ce lot.
///
/// **Rien ne sort de l'appareil.** ML Kit étiquette sur le téléphone, sans
/// réseau ; la sonde n'enregistre rien et n'envoie rien. Le seul chemin de
/// sortie est le presse-papier, et c'est un geste humain.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'features/tout_seul/data/reconnaissance_mlkit.dart';
import 'features/tout_seul/domain/reconnaissance.dart';
import 'features/tout_seul/presentation/pages/sonde_page.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);

  runApp(AppSonde(reconnaissance: ReconnaissanceMlkit()));
}

/// Racine de la sonde.
///
/// Elle n'emprunte **ni** le thème de Look & Find **ni** celui de *Tout seul* :
/// un instrument posé par-dessus un flux caméra se lit en blanc sur noir, et
/// lui donner l'identité de l'une des deux applications ferait dériver cette
/// identité au premier réglage de lisibilité.
class AppSonde extends StatelessWidget {
  const AppSonde({super.key, required this.reconnaissance});

  final Reconnaissance reconnaissance;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Sonde',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(useMaterial3: true),
      locale: const Locale('fr', 'FR'),
      supportedLocales: const [Locale('fr', 'FR')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: SondePage(reconnaissance: reconnaissance),
    );
  }
}
