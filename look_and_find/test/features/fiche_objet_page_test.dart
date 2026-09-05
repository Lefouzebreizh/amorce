/// La fiche de la version un, montée pour de vrai.
///
/// Ce qu'elle promet — nommer, décrire, dire de quoi c'est fait et de quelle
/// couleur, puis donner quelques gestes — et surtout **ce qu'elle ne montre
/// plus** : ni prix, ni marchand, ni suggestion d'achat. Ce dernier point n'est
/// pas une préférence d'affichage, c'est le périmètre décidé pour cette
/// version ; un test le tient, parce qu'un bloc réintroduit par mégarde se
/// verrait d'abord chez un utilisateur.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/core/theme/app_theme.dart';
import 'package:look_and_find/features/color_reader/domain/entities/color_reading.dart';
import 'package:look_and_find/features/fiche_objet/domain/entities/fiche_objet.dart';
import 'package:look_and_find/features/fiche_objet/presentation/pages/fiche_objet_page.dart';

Future<void> monter(WidgetTester tester, FicheObjet fiche) async {
  // La surface est réglée plutôt que la page enfermée dans une boîte : une
  // assertion de présence sur une page longue dépend sinon de ce qui la
  // précède.
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(theme: AppTheme.dark, home: FicheObjetPage(fiche: fiche)),
  );
  await tester.pump();
}

void main() {
  testWidgets('nomme l\'objet et sa catégorie', (tester) async {
    await monter(
      tester,
      const FicheObjet(nom: 'Couteau d\'office', categorie: 'ustensile de cuisine'),
    );

    expect(find.text('Couteau d\'office'), findsOneWidget);
    expect(find.text('ustensile de cuisine'), findsOneWidget);
  });

  testWidgets('dit la couleur, et dit quand elle hésite', (tester) async {
    // C'est la raison d'être du branchement sur `color_reader` plutôt que sur
    // le modèle : l'hésitation doit arriver jusqu'à l'écran, sinon autant
    // demander la couleur à Gemini.
    await monter(
      tester,
      const FicheObjet(
        nom: 'Pull',
        couleur: ColorReading(
          'rouge',
          alternative: 'blanc',
          nuance: 'selon l\'endroit visé',
        ),
      ),
    );

    expect(
      find.textContaining('rouge, ou blanc'),
      findsOneWidget,
      reason: 'Une couleur incertaine doit se lire comme telle.',
    );
  });

  testWidgets('montre la matière et ce qui se voit', (tester) async {
    await monter(
      tester,
      const FicheObjet(
        nom: 'Perceuse',
        matiere: 'semble être du plastique renforcé',
        caracteristiques: ['mandrin métallique', 'poignée caoutchoutée'],
      ),
    );

    expect(find.textContaining('semble être du plastique'), findsOneWidget);
    expect(find.text('mandrin métallique'), findsOneWidget);
    expect(find.text('poignée caoutchoutée'), findsOneWidget);
  });

  testWidgets('numérote les conseils', (tester) async {
    await monter(
      tester,
      const FicheObjet(
        nom: 'Râpe',
        conseils: ['Rincer aussitôt', 'Ranger lame vers le bas'],
      ),
    );

    expect(find.text('1.'), findsOneWidget);
    expect(find.text('2.'), findsOneWidget);
    expect(find.text('Ranger lame vers le bas'), findsOneWidget);
  });

  testWidgets('une fiche minimale n\'affiche aucun bloc vide', (tester) async {
    // Un intitulé de section suivi d'un cadre vide donne l'impression d'un
    // chargement qui n'aboutit pas.
    await monter(tester, const FicheObjet(nom: 'Objet'));

    expect(find.text('Objet'), findsOneWidget);
    expect(find.text('Ce qu\'on voit'), findsNothing);
    expect(find.text('À quoi ça sert'), findsNothing);
    expect(find.text('Bons gestes'), findsNothing);
  });

  testWidgets('ne montre ni prix ni marchand', (tester) async {
    await monter(
      tester,
      const FicheObjet(
        nom: 'Chaise',
        categorie: 'mobilier',
        usage: 'S\'asseoir.',
        matiere: 'bois',
        caracteristiques: ['assise garnie'],
        conseils: ['Resserrer les vis une fois par an'],
      ),
    );

    for (final mot in ['€', 'Prix', 'Acheter', 'Voir l\'offre', 'Moins cher']) {
      expect(
        find.textContaining(mot),
        findsNothing,
        reason: '« $mot » relève du comparateur, remis à la version deux.',
      );
    }
  });
}
