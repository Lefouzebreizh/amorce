/// La grille d'accueil, montée pour de vrai.
///
/// Ce qui est vérifié est ce que la grille promet à quelqu'un qui ne lit pas :
/// les dix-sept gestes sont là, chacun porte son image, et toucher une image
/// ouvre le geste qu'elle montre — pas son voisin.
///
/// **L'écran est agrandi à 400 × 2400.** Une `GridView` ne construit que ce
/// qu'elle affiche : sur les 800 × 600 par défaut, quatre tuiles existeraient
/// et le test compterait quatre gestes sur dix-sept, au vert. La consigne du
/// dépôt — agrandir la surface plutôt que faire défiler — est ici la différence
/// entre un test qui mesure et un test qui se ment.
library;

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/core/theme/app_theme.dart';
import 'package:look_and_find/features/tout_seul/domain/corpus/corpus_gestes.dart';
import 'package:look_and_find/features/tout_seul/presentation/emojis.dart';
import 'package:look_and_find/features/tout_seul/presentation/mots_enfant.dart';
import 'package:look_and_find/features/tout_seul/presentation/pages/accueil_gestes_page.dart';
import 'package:look_and_find/features/tout_seul/presentation/widgets/tuile_geste.dart';

import 'fausse_voix.dart';

void main() {
  late FausseVoix voix;

  setUp(() => voix = FausseVoix());

  Future<void> monter(WidgetTester tester, {bool sansAnimation = false}) async {
    tester.view.physicalSize = const Size(400, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.dark,
        locale: const Locale('fr', 'FR'),
        supportedLocales: const [Locale('fr', 'FR')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        // `copyWith` et non un `MediaQueryData` neuf : celui-ci effacerait la
        // taille de l'écran, et la grille se construirait dans le vide.
        home: Builder(
          builder: (context) => MediaQuery(
            data: MediaQuery.of(context)
                .copyWith(disableAnimations: sansAnimation),
            child: AccueilGestesPage(voix: voix),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('la grille montre les dix-sept gestes', (tester) async {
    await monter(tester);

    expect(CorpusGestes.gestes, hasLength(17),
        reason: 'Le corpus a changé de taille : la promesse du produit — '
            'dix-sept gestes — se dit ailleurs qu\'ici aussi.');
    expect(find.byType(TuileGeste), findsNWidgets(17));
  });

  testWidgets('chaque tuile porte son émoji et son nom', (tester) async {
    await monter(tester);

    for (final geste in CorpusGestes.gestes) {
      expect(find.text(EmojisGestes.pour(geste.identifiant)), findsOneWidget,
          reason: 'L\'image de ${geste.identifiant} manque à la grille ; '
              'c\'est la seule chose que l\'enfant sait lire.');
      expect(find.text(geste.nom), findsOneWidget,
          reason: 'Le nom de ${geste.identifiant} manque ; il est écrit pour '
              'l\'adulte assis à côté.');
    }
  });

  testWidgets('toucher une tuile ouvre ce geste-là, et dit sa première étape',
      (tester) async {
    await monter(tester);

    // Un geste pris au milieu du corpus, et non le premier : une navigation
    // qui ouvrirait toujours le premier geste passerait un test écrit sur le
    // premier.
    final geste = CorpusGestes.gestes.firstWhere(
      (g) => g.identifiant == 'ranger_ses_jouets',
    );

    await tester.tap(find.text(geste.nom));
    await tester.pumpAndSettle();

    expect(find.text(geste.etapes.first.phrase), findsOneWidget);
    expect(voix.dites, [geste.etapes.first.phrase],
        reason: 'La première étape doit être dite à l\'arrivée, sans que '
            'l\'enfant ait à la demander.');
  });

  testWidgets('une tuile se touche largement — bien au-delà des 48 dp du dépôt',
      (tester) async {
    await monter(tester);

    final taille = tester.getSize(find.byType(TuileGeste).first);
    expect(taille.height, hauteurTuile);
    expect(taille.height, greaterThan(AppTheme.minTouchTarget * 3),
        reason: 'La règle des 48 dp vise un pouce d\'adulte ; un doigt de '
            'cinq ans vise mal.');
    expect(taille.width, greaterThan(AppTheme.minTouchTarget * 3));
  });

  testWidgets('le parcours entier ramène à la grille', (tester) async {
    await monter(tester);

    final geste = CorpusGestes.gestes.first;
    await tester.tap(find.text(geste.nom));
    await tester.pumpAndSettle();

    for (var rang = 0; rang < geste.etapes.length; rang++) {
      expect(find.text(geste.etapes[rang].phrase), findsOneWidget);
      await tester.tap(find.byType(FilledButton));
      await tester.pumpAndSettle();
    }

    // Le dernier appui portait « J'ai fini » : il ramène à la grille au lieu
    // de laisser l'enfant sur une phrase sans suite.
    expect(find.text(MotsEnfant.choisir), findsOneWidget);
    expect(find.byType(TuileGeste), findsNWidgets(17));
    expect(voix.dites, geste.etapes.map((e) => e.phrase).toList(),
        reason: 'Chaque étape est dite une fois et une seule, dans l\'ordre.');
    expect(voix.silences, greaterThan(0),
        reason: 'En quittant le geste, la voix se tait : sinon la dernière '
            'étape continue par-dessus la grille.');
  });

  testWidgets('l\'ouverture d\'un geste est animée par défaut',
      (tester) async {
    await monter(tester);

    await tester.tap(find.text(CorpusGestes.gestes.first.nom));
    await tester.pump();

    expect(tester.hasRunningAnimations, isTrue,
        reason: 'Sans ce contrôle, le test suivant passerait aussi bien avec '
            'une application qui n\'anime jamais rien.');
    await tester.pumpAndSettle();
  });

  testWidgets('animations coupées, l\'ouverture ne bouge plus', (tester) async {
    await monter(tester, sansAnimation: true);

    await tester.tap(find.text(CorpusGestes.gestes.first.nom));
    await tester.pump();

    expect(tester.hasRunningAnimations, isFalse,
        reason: '`disableAnimations` est le prefers-reduced-motion du dépôt. '
            'Une transition qui survit au réglage système est une transition '
            'imposée à quelqu\'un qui a demandé le contraire.');
    expect(find.text(CorpusGestes.gestes.first.etapes.first.phrase),
        findsOneWidget);
  });
}
