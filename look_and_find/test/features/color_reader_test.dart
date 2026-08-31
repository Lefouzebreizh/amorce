/// Nommer une couleur, et surtout savoir dire qu'on hésite.
///
/// Les cas certains servent de garde-fou ; les vrais tests de cette
/// fonctionnalité sont les autres. Quelqu'un qui ne distingue pas les couleurs
/// ne peut pas corriger une réponse fausse, donc une réponse assurée qui se
/// trompe coûte plus cher qu'un aveu d'hésitation.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/color_reader/domain/usecases/name_color.dart';

void main() {
  group('les couleurs franches sont nommées sans hésiter', () {
    final cas = {
      'rouge pur': ([255, 0, 0], 'rouge'),
      'vert pur': ([0, 200, 0], 'vert'),
      'bleu pur': ([0, 0, 255], 'bleu'),
      'jaune pur': ([255, 240, 0], 'jaune'),
      'orange': ([255, 150, 0], 'orange'),
      'violet': ([150, 0, 220], 'violet'),
      'noir': ([0, 0, 0], 'noir'),
      'blanc': ([255, 255, 255], 'blanc'),
    };

    cas.forEach((nom, attendu) {
      test(nom, () {
        final (rgb, label) = attendu;
        final lecture = NameColor.of(rgb[0], rgb[1], rgb[2]);
        expect(lecture.label, label);
        expect(lecture.isCertain, isTrue, reason: 'lu « ${lecture.spoken} »');
      });
    });
  });

  group('les gris se distinguent par leur clarté', () {
    test('un gris moyen', () {
      expect(NameColor.of(128, 128, 128).label, 'gris');
    });

    test('un gris clair', () {
      expect(NameColor.of(200, 200, 200).label, 'gris clair');
    });

    test('un gris foncé', () {
      expect(NameColor.of(80, 80, 80).label, 'gris foncé');
    });
  });

  group('les familles chaudes changent de nom selon la clarté', () {
    test('un orange sombre est un marron, pas un « orange foncé »', () {
      expect(NameColor.of(139, 69, 19).label, 'marron');
    });

    test('un rouge sombre est un bordeaux', () {
      expect(NameColor.of(90, 10, 20).label, 'bordeaux');
    });

    test('un rouge clair et peu saturé est un rose', () {
      expect(NameColor.of(255, 180, 190).label, 'rose');
    });

    test('un bleu très sombre est un bleu marine', () {
      expect(NameColor.of(25, 25, 90).label, 'bleu marine');
    });
  });

  group("l'hésitation est dite, jamais tranchée en silence", () {
    test('un beige clair peut être un blanc sous lumière chaude', () {
      final lecture = NameColor.of(245, 235, 215);
      expect(lecture.isCertain, isFalse);
      expect(lecture.alternative, 'blanc');
      expect(lecture.nuance, 'sous lumière chaude');
      expect(lecture.spoken, contains('sous lumière chaude'));
    });

    test('une couleur à peine saturée propose aussi le gris', () {
      final lecture = NameColor.of(120, 128, 136);
      expect(lecture.isCertain, isFalse,
          reason: 'lu « ${lecture.spoken} »');
      expect(lecture.alternative, startsWith('gris'));
    });

    test('une teinte posée sur une frontière nomme les deux voisines', () {
      // Teinte ≈ 45°, exactement la bascule orange / jaune.
      final lecture = NameColor.of(255, 191, 0);
      expect(lecture.isCertain, isFalse, reason: 'lu « ${lecture.spoken} »');
      expect({lecture.label, lecture.alternative}, containsAll(['jaune']));
    });

    test('une phrase énoncée reste vraie lue à voix haute', () {
      final lecture = NameColor.of(245, 235, 215);
      expect(lecture.spoken, 'beige, ou blanc sous lumière chaude');
    });
  });

  group('couleurs réelles qui ont pris la règle en défaut', () {
    // Relevés sur un corpus de trente-quatre couleurs usuelles. Aucun de ces
    // quatre défauts n'apparaissait sur les couleurs franches : c'est le
    // corpus qui les a montrés, pas le raisonnement.

    test('un bordeaux reste un bordeaux, pas un rose sombre', () {
      // La bande « rose » (330–348°) porte aussi les rouges profonds ; sans
      // règle de clarté, elle rendait « rose, ou bordeaux ».
      expect(NameColor.of(128, 0, 32).label, 'bordeaux');
    });

    test('un anthracite est noir, pas bleu marine', () {
      // Dix points d'écart entre canaux portent la saturation à 0,20 dans les
      // tons sombres. Personne n'y voit du bleu.
      expect(NameColor.of(41, 44, 51).label, 'noir');
    });

    test('un bleu ciel est un bleu clair, pas un cyan', () {
      expect(NameColor.of(135, 206, 235).label, 'bleu clair');
    });

    test('un beige à 60° garde la nuance de lumière chaude', () {
      // La bande chaude s'arrêtait à 60° exclu ; un beige tombe pile dessus.
      final lecture = NameColor.of(245, 245, 220);
      expect(lecture.nuance, 'sous lumière chaude');
    });
  });

  group('les bornes ne lèvent pas', () {
    test('les huit coins du cube des couleurs', () {
      for (final r in [0, 255]) {
        for (final g in [0, 255]) {
          for (final b in [0, 255]) {
            expect(NameColor.of(r, g, b).label, isNotEmpty);
          }
        }
      }
    });

    test('toute la roue des teintes est nommée', () {
      for (var teinte = 0; teinte < 360; teinte += 3) {
        final rad = teinte * 3.14159265 / 180;
        final r = ((1 + _cos(rad)) * 127).round().clamp(0, 255);
        final g = ((1 + _cos(rad - 2.094)) * 127).round().clamp(0, 255);
        final b = ((1 + _cos(rad + 2.094)) * 127).round().clamp(0, 255);
        expect(NameColor.of(r, g, b).label, isNotEmpty,
            reason: 'teinte $teinte°');
      }
    });
  });
}

double _cos(double x) {
  // Série de Taylor : la fonction n'a pas besoin d'être exacte, seulement de
  // balayer la roue sans importer `dart:math` pour trois lignes de test.
  final t = x % 6.28318530;
  final u = t > 3.14159265 ? t - 6.28318530 : t;
  final u2 = u * u;
  return 1 - u2 / 2 + u2 * u2 / 24 - u2 * u2 * u2 / 720;
}
