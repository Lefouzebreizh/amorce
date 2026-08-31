/// Le second point d'entrée, monté pour de vrai — et la cloison là où
/// `cloison_test.dart` ne voit pas.
///
/// **Pourquoi ce fichier existe à côté de la cloison.** `cloison_test.dart`
/// parcourt `lib/features/tout_seul` : c'est là que vivent les sources du
/// module, et c'est le bon périmètre. Mais le point d'entrée, lui, est à la
/// racine de `lib/` — hors de ce parcours — et c'est **exactement** le fichier
/// où un import marchand atterrit : c'est lui qui monte l'application, donc lui
/// qu'on modifie le jour où l'on veut « juste ajouter un écran ».
///
/// Un import du commerce ici ramènerait tout le chemin d'achat dans le binaire
/// de l'enfant par l'élagage, sans qu'aucune source du module n'ait bougé, et
/// la cloison passerait au vert.
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/tout_seul/presentation/theme_enfant.dart';
import 'package:look_and_find/main_tout_seul.dart';

import 'fausse_voix.dart';

/// Les mêmes fonctionnalités que la cloison, nommées par fonctionnalité et non
/// par fichier : un renommage interne ne doit pas désarmer la garde.
const _interdits = <String, String>{
  'product_detail': 'la fiche produit, qui porte marchands et prix',
  'favorites': 'le suivi de prix',
  'scanner': "l'identification marchande",
  'ar_view': "la vue en réalité augmentée d'un meuble",
};

void main() {
  test('le point d\'entrée enfant n\'atteint aucune fonctionnalité marchande',
      () {
    final fichier = File('lib/main_tout_seul.dart');
    expect(fichier.existsSync(), isTrue,
        reason: 'lib/main_tout_seul.dart est le point d\'entrée de '
            'l\'application enfant ; sans lui, il n\'y a qu\'une application.');

    final fautes = <String>[];
    for (final ligne in fichier.readAsLinesSync()) {
      final texte = ligne.trim();
      if (!texte.startsWith('import ') && !texte.startsWith('export ')) {
        continue;
      }
      for (final entree in _interdits.entries) {
        if (texte.contains('/${entree.key}/')) {
          fautes.add('${entree.key} — ${entree.value}\n    $texte');
        }
      }
    }

    expect(fautes, isEmpty,
        reason: 'Un seul import ici ramène tout le magasin dans le binaire de '
            'l\'enfant :\n  ${fautes.join("\n  ")}');
  });

  testWidgets('l\'application enfant démarre sur la grille des gestes',
      (tester) async {
    tester.view.physicalSize = const Size(400, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(ToutSeulApp(voix: FausseVoix()));
    await tester.pumpAndSettle();

    final application = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(application.theme, ThemeEnfant.clair,
        reason: 'Le thème de l\'enfant, clair, et non `AppTheme.dark`, qui '
            'appartient à Look & Find et n\'est pas importé ici.');
    expect(application.theme?.brightness, Brightness.light);
    expect(application.locale, const Locale('fr', 'FR'),
        reason: 'Les textes sont écrits en français ; une locale anglaise '
            'donnerait des libellés Material à moitié traduits.');
    expect(application.debugShowCheckedModeBanner, isFalse);

    // Le geste que l'application propose est à un appui de l'ouverture : pas
    // d'écran d'accueil intermédiaire, pas de réglages, pas de connexion.
    expect(find.text('Nouer ses lacets'), findsOneWidget);
  });
}
