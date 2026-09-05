/// Ce que la lecture de la fiche v1 doit encaisser sans perdre la fiche.
///
/// Ces formes ne sont pas théoriques : ce sont celles qu'un modèle de langage
/// rend quand on lui demande du JSON en français — liste rendue en une phrase,
/// « null » écrit en toutes lettres, clé absente, valeur vide.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/fiche_objet/data/models/fiche_objet_dto.dart';

void main() {
  group('FicheObjetDto', () {
    test('lit une fiche complète', () {
      final fiche = FicheObjetDto.fromJson({
        'nom': 'Couteau d\'office',
        'categorie': 'ustensile de cuisine',
        'usage': 'Éplucher et tailler les petits fruits et légumes.',
        'matiere': 'lame en inox, manche en polypropylène',
        'caracteristiques': ['lame courte et lisse', 'manche moulé'],
        'conseils': ['Laver à la main', 'Aiguiser régulièrement'],
      }).toEntity();

      expect(fiche, isNotNull);
      expect(fiche!.nom, 'Couteau d\'office');
      expect(fiche.categorie, 'ustensile de cuisine');
      expect(fiche.caracteristiques, hasLength(2));
      expect(fiche.aDesConseils, isTrue);
      // La couleur ne vient jamais du modèle : elle est mesurée sur la photo.
      expect(fiche.couleur, isNull);
    });

    test('sans nom, il n\'y a pas de fiche', () {
      expect(
        FicheObjetDto.fromJson({'usage': 'Sert à quelque chose'}).toEntity(),
        isNull,
      );
      expect(FicheObjetDto.fromJson({'nom': '   '}).toEntity(), isNull);
    });

    test('un nom seul suffit à montrer quelque chose', () {
      // Le reste manque, mais l'objet est nommé : refuser la fiche entière
      // priverait d'une information juste.
      final fiche = FicheObjetDto.fromJson({'nom': 'Tournevis'}).toEntity();

      expect(fiche!.nom, 'Tournevis');
      expect(fiche.caracteristiques, isEmpty);
      expect(fiche.aDesConseils, isFalse);
    });

    test('« null » écrit en toutes lettres ne devient pas un texte', () {
      final fiche = FicheObjetDto.fromJson({
        'nom': 'Marteau',
        'matiere': 'null',
        'usage': 'N/A',
      }).toEntity();

      expect(fiche!.matiere, isNull);
      expect(fiche.usage, isNull);
    });

    test('une liste rendue en une phrase est découpée', () {
      // Le modèle répond parfois en prose là où le schéma demande un tableau.
      // Garder la phrase entière comme unique élément afficherait une puce
      // interminable ; la jeter perdrait des observations justes.
      final fiche = FicheObjetDto.fromJson({
        'nom': 'Perceuse',
        'caracteristiques': 'mandrin métallique, poignée caoutchoutée',
        'conseils': 'Porter des lunettes ; vérifier le serrage',
      }).toEntity();

      expect(fiche!.caracteristiques, [
        'mandrin métallique',
        'poignée caoutchoutée',
      ]);
      expect(fiche.conseils, ['Porter des lunettes', 'vérifier le serrage']);
    });

    test('une virgule à l\'intérieur d\'un élément ne le coupe pas', () {
      // « Opinel, Laguiole » se découpe, « lame de 8 cm, aiguisée » aussi —
      // mais pas « manche en bois, type Nordique » dont la suite est un nom
      // propre. Le découpage ne s'applique qu'avant une minuscule.
      final fiche = FicheObjetDto.fromJson({
        'nom': 'Couteau',
        'caracteristiques': 'manche en bois, Nordique',
      }).toEntity();

      expect(fiche!.caracteristiques, ['manche en bois, Nordique']);
    });

    test('une entrée vide dans la liste est écartée', () {
      final fiche = FicheObjetDto.fromJson({
        'nom': 'Lampe',
        'conseils': ['Dépoussiérer', '', null, 'N/A'],
      }).toEntity();

      expect(fiche!.conseils, ['Dépoussiérer']);
    });

    test('relit ce qu\'elle a écrit', () {
      // Un aller-retour complet : c'est ce qui permettra de ranger une fiche
      // sans inventer un second format.
      final origine = FicheObjetDto.fromJson({
        'nom': 'Râpe à fromage',
        'categorie': 'ustensile de cuisine',
        'usage': 'Râper.',
        'caracteristiques': ['grille fine'],
        'conseils': ['Rincer aussitôt'],
      }).toEntity()!;

      final relu = FicheObjetDto.fromJson(
        FicheObjetDto.fromEntity(origine).toJson(),
      ).toEntity()!;

      expect(relu.nom, origine.nom);
      expect(relu.categorie, origine.categorie);
      expect(relu.conseils, origine.conseils);
    });
  });
}
