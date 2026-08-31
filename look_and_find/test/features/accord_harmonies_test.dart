/// Les trois harmonies d'un mur : ce qu'elles proposent, et ce qu'elles
/// refusent de proposer.
///
/// L'essentiel des tests porte sur les **bornes**, pas sur les angles. Calculer
/// un complément est trivial ; ce qui fait la valeur du module est que la
/// couleur rendue soit **vivable** — une couleur de nuancier qui n'existe dans
/// aucun magasin est une réponse fausse même quand l'angle est juste.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/accord/domain/entities/harmonie.dart';
import 'package:look_and_find/features/accord/domain/usecases/build_harmonies.dart';
import 'package:look_and_find/features/color_reader/domain/usecases/name_color.dart';

/// Saturation au sens TSV et clarté, pour éprouver les bornes.
(double, double) _satEtClarte(Proposition p) {
  final r = p.rouge / 255, g = p.vert / 255, b = p.bleu / 255;
  final max = [r, g, b].reduce((a, x) => a > x ? a : x);
  final min = [r, g, b].reduce((a, x) => a < x ? a : x);
  return (max == 0 ? 0 : (max - min) / max, (max + min) / 2);
}

void main() {
  // Un ocre de mur, la couleur la plus fréquente sur les photos d'intérieur.
  final ocre = BuildHarmonies.pour(198, 156, 109);

  group('les trois harmonies sont rendues, chacune expliquée', () {
    test('trois harmonies, ni plus ni moins', () {
      expect(ocre.map((h) => h.type), [
        TypeHarmonie.complementaire,
        TypeHarmonie.analogue,
        TypeHarmonie.triadique,
      ]);
    });

    test('chacune dit ce qu\'elle fait à une pièce', () {
      for (final h in ocre) {
        expect(h.type.explication, isNotEmpty);
        expect(h.type.explication.length, greaterThan(40),
            reason: '${h.type.nom} : une phrase, pas une étiquette');
      }
    });
  });

  group('le mur est le 60, jamais une proposition', () {
    test('chaque harmonie propose un 30 et un 10, et rien d\'autre', () {
      for (final h in ocre) {
        expect(h.propositions.map((p) => p.part), [30, 10],
            reason: h.type.nom);
      }
    });

    test('la plante n\'est proposée que là où sa couleur existe', () {
      // Une plante est verte, et c'est tout. La proposer sur une teinte
      // qu'aucun feuillage ne porte enverrait quelqu'un chercher ce qui
      // n'existe pas.
      var vertesTrouvees = 0;
      for (final mur in [
        [198, 156, 109],
        [70, 100, 160],
        [110, 125, 100],
      ]) {
        for (final h in BuildHarmonies.pour(mur[0], mur[1], mur[2])) {
          for (final p in h.propositions) {
            final estVert =
                NameColor.of(p.rouge, p.vert, p.bleu).label.startsWith('vert');
            final proposePlante = p.objets.any((o) => o.contains('plante'));
            expect(proposePlante, estVert,
                reason: 'mur $mur, ${h.type.nom}, ${p.part}% : '
                    '${NameColor.of(p.rouge, p.vert, p.bleu).label} '
                    '→ ${p.objets}');
            if (estVert) vertesTrouvees++;
          }
        }
      }
      expect(vertesTrouvees, greaterThan(0),
          reason: 'aucune proposition verte : le test ne prouve rien');
    });

    test('les quantités désignent les objets', () {
      for (final h in ocre) {
        expect(h.propositions[0].objets, contains('tapis'));
        expect(h.propositions[1].objets, contains('coussin'));
      }
    });
  });

  group('une couleur invivable est une réponse fausse', () {
    test('ce qui couvre 30 % reste discret', () {
      for (final h in ocre) {
        final (s, _) = _satEtClarte(h.propositions[0]);
        expect(s, lessThanOrEqualTo(0.46),
            reason: '${h.type.nom} : un tapis à $s crie');
      }
    });

    test('ce qui ponctue à 10 % est franc', () {
      for (final h in ocre) {
        final (s, _) = _satEtClarte(h.propositions[1]);
        expect(s, greaterThanOrEqualTo(0.44),
            reason: '${h.type.nom} : un coussin à $s passe pour une erreur');
      }
    });

    test('le 30 % ne coupe pas la pièce en deux', () {
      // Clarté du mur ocre ≈ 0,60 ; le 30 % doit rester dans son voisinage.
      for (final h in ocre) {
        final (_, l) = _satEtClarte(h.propositions[0]);
        expect((l - 0.60).abs(), lessThan(0.35), reason: h.type.nom);
      }
    });
  });

  group("l'analogue se distingue par la clarté, pas par le nom", () {
    // Écrit après avoir *regardé* les palettes : sur un mur vert, l'analogue
    // rendait « vert », angle juste et conseil nul. Écarter la teinte ne
    // corrige rien — la bande du vert fait quatre-vingts degrés. C'est la
    // valeur qui doit différer.
    test('un tapis analogue est franchement plus clair ou plus sombre', () {
      for (final mur in [
        [110, 125, 100], // un vert, le cas qui a révélé le défaut
        [198, 156, 109], // un ocre
        [70, 100, 160], // un bleu
      ]) {
        final clarteMur =
            (mur[0] * 0.2126 + mur[1] * 0.7152 + mur[2] * 0.0722) / 255;
        final tapis =
            BuildHarmonies.pour(mur[0], mur[1], mur[2])[1].propositions[0];
        final clarteTapis =
            (tapis.rouge * 0.2126 + tapis.vert * 0.7152 + tapis.bleu * 0.0722) /
                255;
        expect((clarteTapis - clarteMur).abs(), greaterThan(0.08),
            reason: 'mur $mur : le tapis se confondrait avec le mur');
      }
    });
  });

  group('les angles sont ceux qu\'on attend', () {
    test('la complémentaire est bien opposée', () {
      final complement = ocre[0].propositions[1];
      final nom = NameColor.of(
        complement.rouge,
        complement.vert,
        complement.bleu,
      );
      // Un ocre a une teinte autour de 30° : son opposé est dans les bleus.
      expect(nom.label, anyOf(contains('bleu'), contains('cyan')),
          reason: 'lu « ${nom.spoken} »');
    });

    test('l\'analogue reste dans la famille du mur', () {
      final analogue = ocre[1].propositions[0];
      final nom = NameColor.of(analogue.rouge, analogue.vert, analogue.bleu);
      expect(
        nom.label,
        anyOf(contains('jaune'), contains('orange'), contains('beige'),
            contains('marron'), contains('vert')),
        reason: 'lu « ${nom.spoken} »',
      );
    });
  });

  group('les cas limites ne lèvent pas', () {
    test('un mur très sombre', () {
      for (final h in BuildHarmonies.pour(30, 35, 40)) {
        for (final p in h.propositions) {
          expect(p.hexadecimal, matches(RegExp(r'^#[0-9A-F]{6}$')));
        }
      }
    });

    test('un mur très clair', () {
      for (final h in BuildHarmonies.pour(245, 240, 232)) {
        for (final p in h.propositions) {
          expect(p.hexadecimal, matches(RegExp(r'^#[0-9A-F]{6}$')));
        }
      }
    });

    test('toute la roue rend des couleurs valides', () {
      for (var t = 0; t < 360; t += 15) {
        final base = BuildHarmonies.pour(
          (128 + 100 * (t % 90) / 90).round(),
          (128 + 60 * ((t + 30) % 90) / 90).round(),
          (128 - 60 * ((t + 60) % 90) / 90).round(),
        );
        for (final h in base) {
          for (final p in h.propositions) {
            expect(p.rouge, inInclusiveRange(0, 255));
            expect(p.vert, inInclusiveRange(0, 255));
            expect(p.bleu, inInclusiveRange(0, 255));
          }
        }
      }
    });
  });
}
