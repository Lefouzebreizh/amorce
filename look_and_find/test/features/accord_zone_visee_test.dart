/// Le cadre de visée : ce qu'il garde, ce qu'il jette.
///
/// Chaque cas fixe une décision prise en mesurant, pas en imaginant. Les
/// images sont fabriquées ici pour être reproductibles — un cadre se règle en
/// déplaçant un chiffre et en relançant.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/accord/domain/usecases/zone_visee.dart';

/// Une image où chaque pixel porte sa colonne dans le rouge et sa ligne dans
/// le vert : on peut donc dire d'où vient un pixel rendu.
List<(int, int, int)> _reperes(int largeur, int hauteur) => [
      for (var y = 0; y < hauteur; y++)
        for (var x = 0; x < largeur; x++) (x, y, 0),
    ];

void main() {
  group('le cadre est centré et carré', () {
    test('sur une image carrée, il garde le centre', () {
      final zone = ZoneVisee.extraire(
        _reperes(10, 10),
        largeur: 10,
        hauteur: 10,
        part: 0.6,
      );
      // 6 × 6, décalé de 2 : les colonnes et lignes vont de 2 à 7.
      expect(zone.length, 36);
      expect(zone.first, (2, 2, 0));
      expect(zone.last, (7, 7, 0));
    });

    test('sur une image haute, il se règle sur le petit côté', () {
      // Le piège : un cadre au format de l'image rattraperait du plafond et du
      // sol sur le grand côté — les surfaces de plus qu'on veut exclure.
      final zone = ZoneVisee.extraire(
        _reperes(10, 30),
        largeur: 10,
        hauteur: 30,
        part: 1,
      );
      expect(zone.length, 100, reason: 'un carré de 10, pas un 10 × 30');
      expect(zone.first, (0, 10, 0), reason: 'centré en hauteur');
      expect(zone.last, (9, 19, 0));
    });

    test('sur une image large, il se règle aussi sur le petit côté', () {
      final zone = ZoneVisee.extraire(
        _reperes(30, 10),
        largeur: 30,
        hauteur: 10,
        part: 1,
      );
      expect(zone.length, 100);
      expect(zone.first, (10, 0, 0), reason: 'centré en largeur');
    });
  });

  group('ce que le cadre exclut', () {
    test('une bordure de couleur ne passe pas dans le cadre', () {
      // Le cas qui motive tout : le mur au centre, la fenêtre et le sol autour.
      const mur = (120, 160, 110);
      const autour = (250, 250, 250);
      final image = <(int, int, int)>[
        for (var y = 0; y < 20; y++)
          for (var x = 0; x < 20; x++)
            (x >= 5 && x < 15 && y >= 5 && y < 15) ? mur : autour,
      ];
      final zone =
          ZoneVisee.extraire(image, largeur: 20, hauteur: 20, part: 0.5);
      expect(zone.length, 100);
      expect(zone.every((p) => p == mur), isTrue,
          reason: 'le cadre ne doit contenir que le mur');
    });
  });

  group('les bords du réglage', () {
    test('une part minuscule rend quand même un pixel', () {
      // Sans le plancher, le cadre serait vide et la porte rendrait « trop
      // sombre » sur une image parfaitement correcte — un refus qui ment.
      final zone = ZoneVisee.extraire(
        _reperes(4, 4),
        largeur: 4,
        hauteur: 4,
        part: 0.01,
      );
      expect(zone.length, 1);
    });

    test('la part par défaut est celle qui a été mesurée', () {
      expect(ZoneVisee.partParDefaut, 0.60);
    });

    test('des dimensions qui ne collent pas au compte lèvent', () {
      expect(
        () => ZoneVisee.extraire(_reperes(4, 4), largeur: 5, hauteur: 4),
        throwsArgumentError,
      );
    });

    test('une part hors de ]0, 1] lève', () {
      expect(
        () => ZoneVisee.extraire(_reperes(4, 4),
            largeur: 4, hauteur: 4, part: 0),
        throwsArgumentError,
      );
      expect(
        () => ZoneVisee.extraire(_reperes(4, 4),
            largeur: 4, hauteur: 4, part: 1.5),
        throwsArgumentError,
      );
    });
  });
}
