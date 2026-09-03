/// Ce que la lecture d'un cadre doit tenir.
///
/// Le cas qui compte est le dernier : un cadre bicolore ne doit **jamais**
/// rendre la moyenne des deux couleurs, parce qu'elle n'existe nulle part et
/// que la personne qui lit ne peut pas la corriger.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/color_reader/domain/usecases/lecture_cadre.dart';
import 'package:look_and_find/features/color_reader/domain/usecases/name_color.dart';

List<(int, int, int)> _uni((int, int, int) c, int combien) =>
    List.filled(combien, c);

List<(int, int, int)> _melange(
  (int, int, int) a,
  (int, int, int) b,
  int total,
  double partDeB,
) {
  final nb = (total * partDeB).round();
  return [..._uni(a, total - nb), ..._uni(b, nb)];
}

void main() {
  group('LectureCadre', () {
    test('un cadre vide ne fait pas tomber la lecture', () {
      expect(LectureCadre.lire(const []).label, 'noir');
    });

    test('une surface parfaitement unie rend ce que NameColor rend', () {
      const bleu = (40, 90, 200);
      expect(
        LectureCadre.lire(_uni(bleu, 400)),
        NameColor.of(bleu.$1, bleu.$2, bleu.$3),
      );
    });

    test('une surface unie avec son ombre reste une seule couleur', () {
      // C'est la cause qui a fait échouer les deux premières mesures : sans
      // neutralisation de la clarté, l'ombre gagne un nom à elle.
      final avecOmbre = [
        ..._uni((150, 150, 150), 300),
        ..._uni((90, 90, 90), 100),
      ];
      expect(LectureCadre.lire(avecOmbre).isCertain, isTrue);
    });

    test('un pull rouge et blanc à rayures annonce les deux couleurs', () {
      final raye = _melange((205, 40, 40), (245, 245, 245), 400, 0.5);
      final lecture = LectureCadre.lire(raye);

      expect(lecture.isCertain, isFalse);
      expect(lecture.nuance, 'deux couleurs dans le viseur');
      expect({lecture.label, lecture.alternative}, {'rouge', 'blanc'});
    });

    test('et surtout, il n\'annonce jamais le rose de la moyenne', () {
      final raye = _melange((205, 40, 40), (245, 245, 245), 400, 0.5);
      final moyenne = NameColor.of(225, 143, 143).label;

      final lecture = LectureCadre.lire(raye);
      expect(lecture.label, isNot(moyenne));
      expect(lecture.alternative, isNot(moyenne));
    });

    test('une trace minoritaire ne déclenche pas l\'hésitation', () {
      // Un liseré, quelques pixels de bord : la couleur du cadre reste une.
      final presqueUni = _melange((40, 90, 200), (245, 245, 245), 400, 0.05);
      expect(LectureCadre.lire(presqueUni).isCertain, isTrue);
    });

    test('la phrase énoncée porte la cause, pour une synthèse vocale', () {
      final raye = _melange((205, 40, 40), (245, 245, 245), 400, 0.5);
      expect(
        LectureCadre.lire(raye).spoken,
        contains('deux couleurs dans le viseur'),
      );
    });
  });
}
