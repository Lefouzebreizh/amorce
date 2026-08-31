/// Ce que la sonde montre, et ce qu'elle met dans le presse-papier.
///
/// Ce tableau est la moitié utile de la sonde : l'autre — l'appareil photo —
/// ne se monte sur aucune machine de vérification. Ici tout se mesure, y
/// compris le contenu exact de la copie, obtenu en interceptant le canal du
/// presse-papier plutôt qu'en faisant confiance au bouton.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/tout_seul/domain/reconnaissance.dart';
import 'package:look_and_find/features/tout_seul/presentation/releve_sonde.dart';
import 'package:look_and_find/features/tout_seul/presentation/widgets/tableau_etiquettes.dart';

void main() {
  late List<String> presspapier;

  setUp(() {
    presspapier = [];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (appel) async {
      if (appel.method == 'Clipboard.setData') {
        final donnees = appel.arguments as Map<Object?, Object?>;
        presspapier.add(donnees['text'] as String);
      }
      return null;
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null);
  });

  Future<void> monter(WidgetTester tester, List<EtiquetteVue> vues) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: TableauEtiquettes(etiquettes: vues)),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('chaque étiquette s\'affiche avec sa confiance, dans l\'ordre reçu',
      (tester) async {
    await monter(tester, const [
      EtiquetteVue('Shoe', 0.92),
      EtiquetteVue('Footwear', 0.88),
      EtiquetteVue('Textile', 0.61),
    ]);

    for (final attendu in ['Shoe', 'Footwear', 'Textile']) {
      expect(find.text(attendu), findsOneWidget);
    }
    expect(find.text(confianceLisible(0.92)), findsOneWidget);

    // L'ordre à l'écran est celui de la liste : le tableau ne retrie rien.
    // Deux tris pour une même liste, ce sont deux endroits où le départage
    // peut diverger.
    final premier = tester.getTopLeft(find.text('Shoe')).dy;
    final dernier = tester.getTopLeft(find.text('Textile')).dy;
    expect(premier, lessThan(dernier));
  });

  testWidgets('le mot du moteur est affiché tel quel, jamais traduit',
      (tester) async {
    await monter(tester, const [EtiquetteVue('Footwear', 0.88)]);

    expect(find.text('Footwear'), findsOneWidget);
    expect(find.text('Chaussure'), findsNothing,
        reason: 'Une sonde qui embellit ce qu\'elle mesure ne mesure plus '
            'rien : c\'est le mot brut qui décidera de la table.');
  });

  testWidgets('rien de reconnu se dit, plutôt que de laisser un vide',
      (tester) async {
    await monter(tester, const []);

    expect(find.text(TableauEtiquettes.rienDeVu), findsOneWidget);
  });

  testWidgets('le bouton copie le relevé entier dans le presse-papier',
      (tester) async {
    const vues = [
      EtiquetteVue('Shoe', 0.92),
      EtiquetteVue('Footwear', 0.88),
    ];
    await monter(tester, vues);

    await tester.tap(find.text(TableauEtiquettes.copier));
    await tester.pumpAndSettle();

    expect(presspapier, [texteDuReleve(vues)]);
    expect(presspapier.single, contains('0.92  Shoe'));
    expect(find.text(TableauEtiquettes.copie), findsOneWidget,
        reason: 'Sans retour visible, on ne sait pas si l\'appui a pris, et '
            'l\'on colle le relevé précédent dans le message.');
  });

  testWidgets('une lecture muette se copie quand même', (tester) async {
    await monter(tester, const []);

    await tester.tap(find.text(TableauEtiquettes.copier));
    await tester.pumpAndSettle();

    expect(presspapier.single, contains('aucune étiquette'),
        reason: 'C\'est le relevé le plus instructif : il dit que le moteur '
            'est resté muet devant l\'objet visé.');
  });
}
