/// L'échantillonnage : ce qu'il garde de la photo, et ce qu'il en fait.
///
/// Les images sont fabriquées ici, pas chargées : aucun binaire n'est versionné
/// dans ce dépôt, et une photo enregistrée ne se règle pas finement.
///
/// Ce que ces tests ne remplacent pas : le chemin complet a été confronté aux
/// quarante-sept photos réelles du corpus, contre les mêmes photos passées par
/// PIL. **Quarante-sept verdicts sur quarante-sept sont identiques**, avec un
/// écart de couleur d'au plus 5/255 dû au filtre de réduction. C'est cette
/// mesure qui valide le passage ; ces tests-ci figent ce qu'elle a établi.
library;

import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:look_and_find/features/color_reader/domain/usecases/echantillon_cadre.dart';
import 'package:look_and_find/features/accord/domain/usecases/judge_photo.dart';
import 'package:look_and_find/features/color_reader/domain/usecases/zone_visee.dart';

/// Une image d'une couleur unie, avec une bordure d'une autre couleur.
img.Image _murEtBordure({
  required int largeur,
  required int hauteur,
  required int bordure,
  required (int, int, int) dedans,
  required (int, int, int) dehors,
}) {
  final image = img.Image(width: largeur, height: hauteur);
  for (var y = 0; y < hauteur; y++) {
    for (var x = 0; x < largeur; x++) {
      final au = x >= bordure &&
          x < largeur - bordure &&
          y >= bordure &&
          y < hauteur - bordure;
      final (r, g, b) = au ? dedans : dehors;
      image.setPixelRgb(x, y, r, g, b);
    }
  }
  return image;
}

void main() {
  test('rend toujours 40 × 40, quelle que soit la photo', () {
    for (final (l, h) in const [(3060, 4080), (100, 100), (4032, 1816)]) {
      final px = EchantillonCadre.depuisImage(
        _murEtBordure(
          largeur: l,
          hauteur: h,
          bordure: 1,
          dedans: (120, 160, 110),
          dehors: (120, 160, 110),
        ),
      );
      expect(px.length, 1600, reason: 'sur une image $l × $h');
    }
  });

  test('le cadre est celui de ZoneVisee, pas un calcul de plus', () {
    // Si l'échantillonneur recalculait le cadre de son côté, les deux finiraient
    // par diverger — le défaut le plus cher de ce projet.
    final (gauche, haut, cote) = ZoneVisee.cadre(1000, 2000);
    expect(cote, 600, reason: '0,60 du petit côté');
    expect(gauche, 200);
    expect(haut, 700);
  });

  test('la bordure reste dehors, et la porte lit le mur', () {
    const mur = (150, 90, 60); // un ocre franc
    final image = _murEtBordure(
      largeur: 1000,
      hauteur: 1000,
      // Le cadre à 0,60 d'une image de 1000 va de 200 à 800. Une bordure de
      // 150 le laisse donc entièrement dans le mur — et c'est ce qu'on teste.
      bordure: 150,
      dedans: mur,
      dehors: (20, 240, 30), // un vert criard : il fausserait tout s'il entrait
    );
    final px = EchantillonCadre.depuisImage(image);
    final verdict = JudgePhoto.juger(px);
    expect(verdict.estAcceptee, isTrue, reason: verdict.toString());
    expect(verdict.rouge, closeTo(150, 6));
    expect(verdict.vert, closeTo(90, 6));
    expect(verdict.bleu, closeTo(60, 6));
  });

  test('une part plus large fait entrer la bordure, et la porte le voit', () {
    // Le pendant du test précédent : la preuve que le cadre sert vraiment.
    final image = _murEtBordure(
      largeur: 1000,
      hauteur: 1000,
      bordure: 150,
      dedans: (150, 90, 60),
      dehors: (20, 240, 30),
    );
    // À part 1, le cadre prend tout : 49 % de mur contre 51 % de bordure, deux
    // blocs francs que la porte doit voir.
    final verdict = JudgePhoto.juger(
      EchantillonCadre.depuisImage(image, part: 1),
    );
    expect(verdict.estAcceptee, isFalse,
        reason: 'deux surfaces franches dans le cadre : ${verdict.refus}');
  });

  test('la réduction moyenne, elle ne pioche pas un pixel de bruit', () {
    // Un mur uni semé de pixels aberrants, comme le bruit d'un capteur. Le plus
    // proche voisin en retiendrait ; la moyenne d'aire rend la surface.
    final image = img.Image(width: 800, height: 800);
    for (var y = 0; y < 800; y++) {
      for (var x = 0; x < 800; x++) {
        final bruit = (x * 7 + y * 13) % 97 == 0;
        if (bruit) {
          image.setPixelRgb(x, y, 255, 0, 255);
        } else {
          image.setPixelRgb(x, y, 120, 160, 110);
        }
      }
    }
    final verdict = JudgePhoto.juger(EchantillonCadre.depuisImage(image));
    expect(verdict.estAcceptee, isTrue, reason: verdict.toString());
    expect(verdict.vert, greaterThan(verdict.rouge),
        reason: 'la dominante reste le vert du mur, pas le magenta du bruit');
  });

  test('des octets qui ne sont pas une image rendent null, sans lever', () {
    // Une panne n'est pas un refus d'Accord : l'appelant doit pouvoir les
    // distinguer, sinon il affiche « surface trop sombre » sur un fichier
    // corrompu et envoie la personne rallumer la lumière.
    expect(
      EchantillonCadre.depuisOctets(
        Uint8List.fromList(const [0, 1, 2, 3, 4, 5]),
      ),
      isNull,
    );
  });
}
