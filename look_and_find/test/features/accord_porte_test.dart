/// La porte d'Accord : ce qu'elle laisse passer, et surtout ce qu'elle arrête.
///
/// Les images sont fabriquées ici, pixel par pixel, parce qu'elles doivent
/// être **reproductibles** : un seuil se règle en déplaçant un chiffre et en
/// relançant, ce qu'une photo enregistrée ne permet pas de faire finement.
///
/// Ces cas reproduisent les trois causes relevées sur dix photos d'intérieur
/// réelles — contre-jour, surface trop sombre, dominante parasite. Ils ne
/// remplacent pas ces photos : ils fixent le comportement une fois les seuils
/// choisis. Le réglage, lui, demande les vraies.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/accord/domain/entities/photo_verdict.dart';
import 'package:look_and_find/features/accord/domain/usecases/judge_photo.dart';

/// Fabrique un échantillon : [combien] pixels de la couleur donnée, avec une
/// dispersion qui imite l'ombre et le reflet d'une vraie surface.
List<(int, int, int)> _surface(
  int r,
  int g,
  int b, {
  int combien = 600,
  int dispersion = 18,
}) {
  final pixels = <(int, int, int)>[];
  for (var i = 0; i < combien; i++) {
    final ecart = ((i % (dispersion * 2)) - dispersion);
    pixels.add((
      (r + ecart).clamp(0, 255),
      (g + ecart).clamp(0, 255),
      (b + ecart).clamp(0, 255),
    ));
  }
  return pixels;
}

void main() {
  group('la porte accepte une surface franche', () {
    test('un mur ocre', () {
      final verdict = JudgePhoto.juger(_surface(198, 156, 109));
      expect(verdict.estAcceptee, isTrue, reason: verdict.toString());
      expect(verdict.hexadecimal, startsWith('#'));
    });

    test('un canapé bleu', () {
      final verdict = JudgePhoto.juger(_surface(70, 100, 160));
      expect(verdict.estAcceptee, isTrue, reason: verdict.toString());
    });

    test("l'ombre et le reflet ne comptent pas comme des couleurs de plus", () {
      // Un mur vert, son coin d'ombre et son reflet de fenêtre. La dominante
      // doit rester le vert, pas la moyenne des trois.
      final pixels = [
        ..._surface(120, 160, 110, combien: 500),
        ..._surface(18, 24, 16, combien: 120), // l'ombre
        ..._surface(248, 250, 247, combien: 120), // le reflet
      ];
      final verdict = JudgePhoto.juger(pixels);
      expect(verdict.estAcceptee, isTrue, reason: verdict.toString());
      expect(verdict.vert, greaterThan(verdict.rouge));
      expect(verdict.vert, greaterThan(verdict.bleu));
    });
  });

  group('la porte refuse, et dit quoi faire', () {
    test('un contre-jour : fenêtre brûlée, pièce sombre', () {
      final pixels = [
        ..._surface(255, 255, 255, combien: 250, dispersion: 3),
        ..._surface(38, 40, 44, combien: 750),
      ];
      final verdict = JudgePhoto.juger(pixels);
      expect(verdict.refus, PhotoRefus.contreJour);
      expect(verdict.refus!.conseil, contains('dos'));
    });

    test('une surface brûlée par la lumière', () {
      final pixels = [
        ..._surface(253, 252, 250, combien: 400, dispersion: 2),
        ..._surface(210, 200, 190, combien: 600),
      ];
      expect(JudgePhoto.juger(pixels).refus, PhotoRefus.surexposee);
    });

    test('une surface trop sombre', () {
      expect(
        JudgePhoto.juger(_surface(28, 30, 34)).refus,
        PhotoRefus.tropSombre,
      );
    });

    test('la bâche verte au fond du jardin', () {
      // Un mur ocre qui occupe la moitié du cadre, une bâche verte l'autre.
      final pixels = [
        ..._surface(198, 156, 109, combien: 500),
        ..._surface(90, 170, 80, combien: 500),
      ];
      final verdict = JudgePhoto.juger(pixels);
      expect(verdict.refus, PhotoRefus.plusieursSurfaces);
      expect(verdict.refus!.conseil, contains('une surface à la fois'));
    });

    test('un mur gris : une harmonie y serait vraie et inutile', () {
      final verdict = JudgePhoto.juger(_surface(150, 151, 152));
      expect(verdict.refus, PhotoRefus.surfaceDelavee);
    });

    test('une image vide ne lève pas', () {
      expect(JudgePhoto.juger([]).estAcceptee, isFalse);
    });
  });

  group('chaque refus porte un geste à poser', () {
    test('aucune raison ne reste sans conseil', () {
      for (final refus in PhotoRefus.values) {
        expect(refus.raison, isNotEmpty);
        expect(refus.conseil, isNotEmpty);
        expect(refus.conseil, endsWith('.'),
            reason: '${refus.name} : le conseil est une phrase, pas un mot');
      }
    });
  });

  group('le code hexadécimal est prêt à afficher', () {
    test('deux chiffres par canal, en majuscules', () {
      expect(const PhotoVerdict.acceptee(15, 200, 8).hexadecimal, '#0FC808');
    });
  });
}
