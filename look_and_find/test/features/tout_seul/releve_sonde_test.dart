/// Le tri et le relevé : tout ce qui se décide sans appareil.
///
/// Ces deux-là portent l'essentiel de la valeur du lot — c'est ce texte-ci qui
/// voyagera jusqu'à celui qui écrira la table de correspondance. Un relevé mal
/// formé n'échoue pas : il se lit de travers, et l'on en tire une table fausse.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/tout_seul/domain/reconnaissance.dart';
import 'package:look_and_find/features/tout_seul/presentation/releve_sonde.dart';

void main() {
  group('le tri', () {
    test('range de la plus sûre à la moins sûre', () {
      final triees = EtiquetteVue.triees(const [
        EtiquetteVue('Textile', 0.61),
        EtiquetteVue('Shoe', 0.92),
        EtiquetteVue('Footwear', 0.88),
      ]);

      expect(triees.map((e) => e.texte), ['Shoe', 'Footwear', 'Textile']);
    });

    test('départage deux confiances égales par ordre alphabétique', () {
      final premier = EtiquetteVue.triees(const [
        EtiquetteVue('Sneaker', 0.5),
        EtiquetteVue('Boot', 0.5),
      ]);
      final second = EtiquetteVue.triees(const [
        EtiquetteVue('Boot', 0.5),
        EtiquetteVue('Sneaker', 0.5),
      ]);

      expect(premier.map((e) => e.texte), ['Boot', 'Sneaker']);
      expect(premier.map((e) => e.texte), second.map((e) => e.texte),
          reason: 'Sans départage, deux relevés du même objet sortiraient '
              'dans deux ordres différents et l\'on chercherait la cause dans '
              'l\'objet plutôt que dans le tri.');
    });

    test('ne rend rien de modifiable, et supporte le vide', () {
      final triees = EtiquetteVue.triees(const []);
      expect(triees, isEmpty);
      expect(() => triees.add(const EtiquetteVue('X', 1)), throwsUnsupportedError);
    });
  });

  group('le relevé', () {
    test('porte l\'en-tête, le compte, et une ligne par étiquette', () {
      final texte = texteDuReleve(const [
        EtiquetteVue('Shoe', 0.92),
        EtiquetteVue('Footwear', 0.88),
      ]);

      expect(texte, '$enteteReleve (2 étiquettes)\n'
          '0.92  Shoe\n'
          '0.88  Footwear');
    });

    test('accorde « étiquette » au singulier', () {
      expect(texteDuReleve(const [EtiquetteVue('Shoe', 0.9)]),
          contains('(1 étiquette)'),
          reason: '« 1 étiquettes » dans un relevé fait douter du reste de la '
              'mesure, et ce texte sera relu par quelqu\'un.');
    });

    test('écrit un point décimal, jamais une virgule', () {
      final texte = texteDuReleve(const [EtiquetteVue('Shoe', 0.925)]);

      expect(texte, contains('0.93'));
      expect(texte, isNot(contains(',')),
          reason: 'Un relevé est une mesure destinée à être relue et comparée, '
              'éventuellement collée dans un tableur : la virgule décimale y '
              'devient une colonne de texte.');
    });

    test('une lecture sans rien reconnu reste un relevé', () {
      final texte = texteDuReleve(const []);

      expect(texte, startsWith(enteteReleve));
      expect(texte, contains('aucune étiquette'),
          reason: 'C\'est la mesure la plus instructive du lot : celle qui dira '
              'si le moteur reste muet sur un lacet vu de près. Une chaîne '
              'vide l\'effacerait.');
    });

    test('l\'en-tête sépare deux relevés collés à la suite', () {
      final deux = '${texteDuReleve(const [EtiquetteVue('Shoe', 0.9)])}\n'
          '${texteDuReleve(const [EtiquetteVue('Toothbrush', 0.7)])}';

      expect(enteteReleve.allMatches(deux).length, 2);
    });
  });

  group('la confiance affichée', () {
    test('se lit en pourcentage entier', () {
      expect(confianceLisible(0.923), startsWith('92'));
      expect(confianceLisible(0.5), startsWith('50'));
    });

    test('porte une espace insécable avant le signe', () {
      expect(confianceLisible(0.92), '92\u00A0%',
          reason: 'Une espace ordinaire laisserait le « % » passer seul à la '
              'ligne dans une colonne étroite.');
    });
  });
}
