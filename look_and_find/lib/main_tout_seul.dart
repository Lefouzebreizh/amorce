/// Le second point d'entrée du projet : l'application **Tout seul**.
///
/// **Deux points d'entrée, un seul projet** — décision du 31/08/2026, gardée
/// par `test/features/tout_seul/cloison_test.dart`. `main.dart` monte Look &
/// Find et son chemin d'achat ; ce fichier-ci monte l'application de l'enfant,
/// et il ne connaît que `features/tout_seul`.
///
/// **Ce que cela achète, et qu'aucune discipline ne remplace :** l'élagage de
/// Dart ne conserve dans un binaire que ce qui est atteignable depuis son point
/// d'entrée. Tant que ce fichier n'atteint ni la fiche produit, ni les favoris,
/// ni le scanner marchand, le code du commerce **n'existe pas** dans
/// l'application que l'enfant tient — pas « désactivé », pas « masqué ».
///
/// ## Ce qui n'est pas ici, et pourquoi
///
/// * **Aucune boîte Hive.** *Tout seul* ne retient rien : ni le geste vu, ni
///   l'heure, ni un score. Il n'y a donc pas de collecte à encadrer, ni de
///   consentement à demander à un enfant qui ne peut pas le donner.
/// * **Aucun réseau, aucun compte, aucune publicité, aucun achat.** Le corpus
///   est écrit dans le binaire et la voix est une capacité du système : rien ne
///   sort de l'appareil, jamais.
/// * **Aucune date.** `initializeDateFormatting` n'est appelé que par Look &
///   Find, qui affiche un historique. Ici rien n'est daté.
///
/// ## Les trois choses qui se règlent ici
///
/// 1. **Le portrait verrouillé.** Le grand bouton du bas est posé pour un
///    pouce ; en paysage, l'écran se réduit à trois lignes et la phrase de
///    l'étape passe sous le clavier de gestes.
/// 2. **La voix, préparée une fois.** `Voix.preparer` doit précéder le premier
///    `dire` ; le faire ici évite qu'un écran ait à s'en souvenir, et c'est le
///    seul endroit du projet où `VoixSysteme` est construite.
/// 3. **Les icônes de la barre système en sombre.** Elles suivent le thème de
///    l'application précédente, pas le nôtre : laissées claires, elles
///    disparaissent purement et simplement sur le fond crème. Le défaut ne se
///    voit ni à l'analyse ni aux tests — la barre système n'appartient pas à
///    l'arbre de widgets — et arrive avec le passage au thème clair.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'features/tout_seul/data/voix_systeme.dart';
import 'features/tout_seul/domain/voix.dart';
import 'features/tout_seul/presentation/mots_enfant.dart';
import 'features/tout_seul/presentation/pages/accueil_gestes_page.dart';
import 'features/tout_seul/presentation/theme_enfant.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.dark);

  final voix = VoixSysteme();
  await voix.preparer();

  runApp(ToutSeulApp(voix: voix));
}

/// Racine de l'application enfant.
///
/// Le thème est celui de *Tout seul*, clair et chaud, et **non celui du
/// dépôt** : `AppTheme` est sombre parce que la moitié du parcours de Look &
/// Find est un viseur caméra, ce qui n'existe pas ici. Un écran noir se lit
/// « éteint » à cinq ans. Le détail des contrastes mesurés est dans
/// `theme_enfant.dart` ; le texte des étapes y tient 16,18:1.
class ToutSeulApp extends StatelessWidget {
  const ToutSeulApp({super.key, required this.voix});

  final Voix voix;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: MotsEnfant.titre,
      debugShowCheckedModeBanner: false,
      theme: ThemeEnfant.clair,
      locale: const Locale('fr', 'FR'),
      supportedLocales: const [Locale('fr', 'FR')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: AccueilGestesPage(voix: voix),
    );
  }
}
