/// L'écran d'Accord monté pour de vrai : le cadre, et ce qu'on lit dedans.
///
/// Le test qui compte ici est le premier : il attache le trait dessiné à la
/// zone mesurée. Si les deux se décollent, la personne aligne son mur sur un
/// cadre pendant que l'application en lit un autre, et rien d'autre ne le
/// signalerait — ni la porte, ni l'échantillonnage, ni l'œil.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/accord/domain/entities/harmonie.dart';
import 'package:look_and_find/features/accord/domain/entities/photo_verdict.dart';
import 'package:look_and_find/features/accord/domain/usecases/build_harmonies.dart';
import 'package:look_and_find/features/accord/domain/usecases/zone_visee.dart';
import 'package:look_and_find/features/accord/presentation/widgets/cadre_visee.dart';
import 'package:look_and_find/features/accord/presentation/widgets/panneau_accord.dart';

Widget _monte(Widget enfant, {Size taille = const Size(400, 800)}) {
  return MaterialApp(
    home: Scaffold(
      backgroundColor: const Color(0xFF0B0D10),
      body: Center(
        child: SizedBox(width: taille.width, height: taille.height, child: enfant),
      ),
    ),
  );
}

void main() {
  group('le cadre coïncide avec la zone mesurée', () {
    test('sur trois formats, au pixel près', () {
      for (final taille in const [
        Size(400, 800),
        Size(800, 400),
        Size(500, 500),
      ]) {
        final dessine = CadreVisee.carre(taille);
        final (gauche, haut, cote) = ZoneVisee.cadre(
          taille.width.round(),
          taille.height.round(),
        );
        expect(dessine.left, gauche.toDouble(), reason: 'sur $taille');
        expect(dessine.top, haut.toDouble(), reason: 'sur $taille');
        expect(dessine.width, cote.toDouble(), reason: 'sur $taille');
        expect(dessine.height, dessine.width,
            reason: 'le cadre est carré, sur $taille');
      }
    });

    testWidgets("l'aide se pose sous le carré, jamais dedans ni sous le "
        'déclencheur', (tester) async {
      // Ce test décrit l'ancrage, pas la collision : c'est le mécanisme du
      // correctif. Le défaut lui-même — le déclencheur qui recouvrait l'aide —
      // se produit à l'échelle de la page et se fige dans
      // `accord_page_test.dart`. Vérifié en retirant le correctif : ce test-ci
      // reste vert, celui de la page tombe.
      // La surface est réglée pour de vrai plutôt qu'enfermée dans un `Center` :
      // une boîte plus grande que la fenêtre de test déborde, et les positions
      // relevées ne sont alors celles d'aucun écran réel.
      await tester.binding.setSurfaceSize(const Size(420, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(body: CadreVisee(aide: 'Remplissez le cadre.')),
        ),
      );

      final cadre = tester.getRect(find.byType(CadreVisee));
      final carre = CadreVisee.carre(cadre.size);
      final aide = tester.getRect(find.text('Remplissez le cadre.'));

      expect(aide.top, greaterThan(cadre.top + carre.bottom),
          reason: "l'aide doit commencer sous le carré, pas dedans");
      expect(aide.bottom, lessThan(cadre.bottom),
          reason: "l'aide doit tenir dans l'écran");
    });

    testWidgets('il se monte et affiche son aide', (tester) async {
      await tester.pumpWidget(
        _monte(const CadreVisee(aide: 'Remplissez le cadre avec le mur.')),
      );
      expect(find.text('Remplissez le cadre avec le mur.'), findsOneWidget);
    });
  });

  group('un refus montre sa cause et son geste', () {
    testWidgets('les deux sont lisibles, pas seulement la cause',
        (tester) async {
      // Un refus sans geste est une impasse : la personne réessaie la même
      // photo et obtient le même refus.
      for (final refus in PhotoRefus.values) {
        await tester.pumpWidget(
          _monte(PanneauAccord(verdict: PhotoVerdict.refusee(refus))),
        );
        expect(find.text(refus.raison), findsOneWidget,
            reason: 'la cause de ${refus.name}');
        expect(find.text(refus.conseil), findsOneWidget,
            reason: 'le geste de ${refus.name}');
      }
    });
  });

  group('une palette montre le mur et ses trois harmonies', () {
    testWidgets('la dominante est annoncée comme le 60 %', (tester) async {
      const mur = PhotoVerdict.acceptee(150, 90, 60);
      await tester.pumpWidget(
        _monte(
          PanneauAccord(
            verdict: mur,
            harmonies: BuildHarmonies.pour(150, 90, 60),
          ),
        ),
      );
      expect(find.textContaining('#965A3C'), findsOneWidget);
      expect(find.textContaining('60\u00A0%'), findsOneWidget);
    });

    testWidgets('les trois harmonies sont nommées, chacune avec 30 et 10',
        (tester) async {
      await tester.pumpWidget(
        _monte(
          PanneauAccord(
            verdict: const PhotoVerdict.acceptee(150, 90, 60),
            harmonies: BuildHarmonies.pour(150, 90, 60),
          ),
        ),
      );
      for (final type in TypeHarmonie.values) {
        expect(find.text(type.nom), findsOneWidget, reason: type.nom);
      }
      // Trois harmonies, chacune un 30 % et un 10 % : jamais des proportions
      // réparties *entre* les harmonies, mais données *à chacune*.
      expect(find.textContaining('30\u00A0% ·'), findsNWidgets(3));
      expect(find.textContaining('10\u00A0% ·'), findsNWidgets(3));
    });

    testWidgets('chaque proposition nomme des objets, pas juste une couleur',
        (tester) async {
      // « Voici trois couleurs » laisse la personne devant son mur.
      await tester.pumpWidget(
        _monte(
          PanneauAccord(
            verdict: const PhotoVerdict.acceptee(150, 90, 60),
            harmonies: BuildHarmonies.pour(150, 90, 60),
          ),
        ),
      );
      expect(find.textContaining('tapis'), findsWidgets);
      expect(find.textContaining('coussin'), findsWidgets);
    });
  });
}
