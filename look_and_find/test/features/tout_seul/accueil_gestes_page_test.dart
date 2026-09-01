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
import 'package:look_and_find/features/tout_seul/domain/corpus/corpus_gestes.dart';
import 'package:look_and_find/features/tout_seul/presentation/emojis.dart';
import 'package:look_and_find/features/tout_seul/presentation/mots_enfant.dart';
import 'package:look_and_find/features/tout_seul/presentation/pages/accueil_gestes_page.dart';
import 'package:look_and_find/features/tout_seul/presentation/theme_enfant.dart';
import 'package:look_and_find/features/tout_seul/presentation/widgets/tuile_geste.dart';

import 'fausse_voix.dart';

void main() {
  late FausseVoix voix;

  setUp(() => voix = FausseVoix());

  Future<void> monter(
    WidgetTester tester, {
    bool sansAnimation = false,
    bool voixBloquante = false,
  }) async {
    if (voixBloquante) voix = FausseVoix(bloquante: true);

    tester.view.physicalSize = const Size(400, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeEnfant.clair,
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
    expect(voix.dites, [geste.nom, geste.etapes.first.phrase],
        reason: 'Le nom de la tuile touchée, puis la première étape à '
            'l\'arrivée — sans que l\'enfant ait à les demander.');
  });

  testWidgets('une tuile se touche largement — bien au-delà des 48 dp du dépôt',
      (tester) async {
    await monter(tester);

    final taille = tester.getSize(find.byType(TuileGeste).first);
    expect(taille.height, hauteurTuile);
    expect(taille.height, greaterThan(ThemeEnfant.cible * 2),
        reason: 'Les 48 dp du dépôt visent un pouce d\'adulte, et les 72 de '
            'ThemeEnfant.cible sont le plancher de l\'enfant ; une tuile est '
            'ce qu\'on vise le plus mal, faute de savoir ce qu\'elle dit.');
    expect(taille.width, greaterThan(ThemeEnfant.cible * 2));
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
    expect(voix.dites, [geste.nom, ...geste.etapes.map((e) => e.phrase)],
        reason: 'Le nom au moment du choix, puis chaque étape une fois et une '
            'seule, dans l\'ordre.');
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

  testWidgets('toucher une tuile dit son nom, avant même d\'ouvrir le geste',
      (tester) async {
    await monter(tester);

    // Un geste dont l'émoji ment : il n'existe pas d'émoji de fermeture
    // éclair, c'est un sac à dos qui la représente. Sans la voix, l'enfant ne
    // peut pas savoir qu'il a visé le bon geste.
    final geste = CorpusGestes.gestes.firstWhere(
      (g) => g.identifiant == 'fermer_une_fermeture_eclair',
    );

    await tester.tap(find.text(geste.nom));
    await tester.pump();

    expect(voix.dites.first, geste.nom,
        reason: 'Le nom se dit au moment du choix : après l\'ouverture, il '
            'arrive trop tard pour corriger une erreur de tuile.');
  });

  testWidgets('l\'ouverture n\'attend pas la fin de l\'énoncé',
      (tester) async {
    // Une voix qui ne rend jamais la main. Sur un vrai téléphone, `dire` ne
    // rend la main qu'à la fin de la phrase : un écran qui l'attendrait
    // resterait figé une seconde après chaque appui, ce qu'un enfant lit comme
    // une panne — et réappuie.
    await monter(tester, voixBloquante: true);

    final geste = CorpusGestes.gestes.first;
    await tester.tap(find.text(geste.nom));
    await tester.pumpAndSettle();

    expect(find.text(geste.etapes.first.phrase), findsOneWidget,
        reason: 'Le geste doit s\'ouvrir alors que le nom est encore en train '
            'd\'être dit.');
    expect(voix.dites, [geste.nom, geste.etapes.first.phrase],
        reason: 'Et la première étape part par-dessus : `dire` interrompt ce '
            'qui était en cours, c\'est écrit dans le port.');
  });
}
