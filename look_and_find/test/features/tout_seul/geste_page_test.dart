/// L'écran d'un geste, monté sur le terrain de référence.
///
/// **393 × 873, la taille du Redmi Note 12 Plus du dépôt**, et non la surface
/// de test par défaut. Ce n'est pas de la coquetterie : dans un test de widget,
/// un débordement de mise en page **lève**. Monter l'écran à sa vraie taille
/// fait donc de chaque test un contrôle de débordement gratuit — et c'est le
/// défaut le plus probable ici, avec un texte à 34 points et un bouton de 96.
///
/// Ce qui reste hors de portée d'un banc de test et se vérifie sur l'appareil :
/// qu'une phrase sorte du haut-parleur, et qu'un enfant de cinq ans vise le bon
/// bouton.
library;

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/tout_seul/domain/corpus/corpus_gestes.dart';
import 'package:look_and_find/features/tout_seul/domain/entities/geste.dart';
import 'package:look_and_find/features/tout_seul/presentation/mots_enfant.dart';
import 'package:look_and_find/features/tout_seul/presentation/pages/geste_page.dart';
import 'package:look_and_find/features/tout_seul/presentation/theme_enfant.dart';

import 'fausse_voix.dart';

void main() {
  late FausseVoix voix;

  /// Les lacets : sept étapes, le geste le plus long du corpus. Un écran qui
  /// tient avec sept tient avec cinq.
  final geste = CorpusGestes.gestes.firstWhere(
    (g) => g.identifiant == 'nouer_ses_lacets',
  );

  setUp(() => voix = FausseVoix());

  Future<void> monter(WidgetTester tester, {Geste? autre}) async {
    final montre = autre ?? geste;
    tester.view.physicalSize = const Size(393, 873);
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
        // La clé force un état neuf d'un geste à l'autre. Sans elle, Flutter
        // réutilise l'état précédent — même type, même position — et le
        // parcours du geste suivant reprendrait au rang du précédent, hors
        // des étapes. Le défaut n'existe que dans ce banc : en vrai, chaque
        // geste arrive par une route neuve.
        home: GestePage(
          key: ValueKey<String>(montre.identifiant),
          geste: montre,
          voix: voix,
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> suivant(WidgetTester tester) async {
    await tester.tap(find.byType(FilledButton));
    await tester.pumpAndSettle();
  }

  /// Ce que l'écran montre, et surtout ce qu'il ne montre pas.
  void seuleEtapeVisible(int rang) {
    for (var i = 0; i < geste.etapes.length; i++) {
      expect(
        find.text(geste.etapes[i].phrase),
        i == rang ? findsOneWidget : findsNothing,
        reason: i == rang
            ? 'L\'étape ${i + 1} devrait être à l\'écran.'
            : 'L\'étape ${i + 1} ne doit pas être à l\'écran en même temps '
                'que l\'étape ${rang + 1} : un enfant qui voit deux phrases '
                'n\'en lit aucune, et personne ne les lui lit dans l\'ordre.',
      );
    }
  }

  testWidgets('une seule étape est à l\'écran, la première', (tester) async {
    await monter(tester);
    seuleEtapeVisible(0);
  });

  testWidgets('la première étape est dite dès l\'arrivée', (tester) async {
    await monter(tester);

    expect(voix.dites, [geste.etapes.first.phrase],
        reason: 'Sans annonce automatique, l\'enfant devrait trouver un '
            'bouton « écouter » pour accéder au seul canal qu\'il sait lire.');
  });

  testWidgets('« suivant » avance d\'une étape et dit la nouvelle',
      (tester) async {
    await monter(tester);

    await suivant(tester);
    seuleEtapeVisible(1);
    expect(voix.dites, [geste.etapes[0].phrase, geste.etapes[1].phrase]);

    await suivant(tester);
    seuleEtapeVisible(2);
    expect(voix.dites.last, geste.etapes[2].phrase);
  });

  testWidgets('le retour recule et redit l\'étape', (tester) async {
    await monter(tester);
    await suivant(tester);
    await suivant(tester);

    await tester.tap(find.byTooltip(MotsEnfant.retour));
    await tester.pumpAndSettle();

    seuleEtapeVisible(1);
    expect(voix.dites.last, geste.etapes[1].phrase,
        reason: 'Le retour n\'existe que pour réentendre : muet, il ramène à '
            'un écran que l\'enfant ne peut pas lire.');
  });

  testWidgets('sur la première étape, le retour ne fait rien', (tester) async {
    await monter(tester);

    await tester.tap(find.byTooltip(MotsEnfant.retour));
    await tester.pumpAndSettle();

    seuleEtapeVisible(0);
    expect(voix.dites, hasLength(1),
        reason: 'Un retour qui redit la première étape ou sort du geste par '
            'surprise apprend que le bouton est imprévisible.');
  });

  testWidgets('la dernière étape ne déborde pas', (tester) async {
    await monter(tester);

    for (var rang = 1; rang < geste.etapes.length; rang++) {
      await suivant(tester);
    }

    seuleEtapeVisible(geste.etapes.length - 1);
    expect(find.text(MotsEnfant.fini), findsOneWidget);
    expect(find.text(MotsEnfant.suivant), findsNothing,
        reason: 'Sur la dernière étape, « suivant » ne mènerait nulle part.');

    // L'appui de trop : sur un écran monté seul, il n'y a rien à dépiler, donc
    // rien ne doit se passer — surtout pas une lecture hors des étapes.
    await suivant(tester);
    expect(tester.takeException(), isNull);
    expect(voix.dites, hasLength(geste.etapes.length),
        reason: 'Une étape de plus que le corpus n\'existe pas : c\'est le '
            'dépassement d\'indice que ce test cherche.');
  });

  testWidgets('chaque étape de chaque geste est dite une fois, dans l\'ordre',
      (tester) async {
    for (final autre in CorpusGestes.gestes) {
      voix = FausseVoix();
      await monter(tester, autre: autre);

      for (var rang = 1; rang < autre.etapes.length; rang++) {
        await suivant(tester);
      }

      expect(voix.dites, autre.etapes.map((e) => e.phrase).toList(),
          reason: 'Parcours incomplet ou désordonné sur ${autre.identifiant}.');
    }
  });

  testWidgets('quitter le geste coupe la voix', (tester) async {
    await monter(tester);

    await tester.pumpWidget(const MaterialApp(home: SizedBox.shrink()));
    await tester.pumpAndSettle();

    expect(voix.silences, greaterThan(0));
  });

  testWidgets('le changement d\'étape est immédiat, sans fondu qui empile',
      (tester) async {
    await monter(tester);

    await tester.tap(find.byType(FilledButton));
    // Une seule image, sans `pumpAndSettle` : s'il y avait une transition,
    // les deux phrases coexisteraient ici — et coexisteraient donc aussi sous
    // les yeux de l'enfant.
    await tester.pump();

    expect(find.text(geste.etapes[1].phrase), findsOneWidget);
    expect(find.text(geste.etapes[0].phrase), findsNothing,
        reason: 'Deux consignes superposées en gros caractères, même pendant '
            'deux dixièmes de seconde, c\'est ce que cet écran promet de ne '
            'jamais faire.');
  });

  testWidgets('les cibles tactiles sont taillées pour un doigt d\'enfant',
      (tester) async {
    await monter(tester);

    final avancer = tester.getSize(find.byType(FilledButton));
    expect(avancer.height, greaterThanOrEqualTo(96),
        reason: 'Le double de la règle du dépôt, qui vise un adulte.');
    expect(avancer.width, greaterThan(200));

    for (final intitule in [MotsEnfant.retour, MotsEnfant.sortir]) {
      final taille = tester.getSize(find.byTooltip(intitule));
      expect(taille.height, greaterThanOrEqualTo(ThemeEnfant.cible),
          reason: intitule);
      expect(taille.width, greaterThanOrEqualTo(ThemeEnfant.cible),
          reason: intitule);
    }
  });

  testWidgets('la sortie ramène en arrière et se touche en haut à gauche',
      (tester) async {
    await monter(tester);

    final sortie = tester.getTopLeft(find.byTooltip(MotsEnfant.sortir));
    final avancer = tester.getTopLeft(find.byType(FilledButton));
    expect(sortie.dy, lessThan(avancer.dy),
        reason: 'La sortie est loin du grand bouton : c\'est le geste qu\'on '
            'ne veut pas déclencher en visant « suivant ».');
  });
}
