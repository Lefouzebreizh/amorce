/// Ce que le pincement fait du zoom, sans capteur.
///
/// Le calcul est le seul endroit vérifiable hors appareil : `setZoomLevel`
/// **lève** quand on lui passe une valeur hors bornes, si bien qu'un facteur
/// mal borné ne se traduit pas par un zoom un peu trop fort mais par un geste
/// qui échoue en silence — l'erreur étant avalée pour ne pas casser le viseur.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/scanner/presentation/providers/bornes_zoom.dart';
import 'package:look_and_find/features/scanner/presentation/widgets/indicateur_zoom.dart';

void main() {
  group('les bornes du capteur', () {
    const capteur = BornesZoom(min: 1, max: 8);

    test('un pincement multiplie le niveau du début de geste', () {
      expect(capteur.pincement(2, 1.5), 3);
    });

    test('un écartement démesuré s\'arrête au maximum du capteur', () {
      expect(capteur.pincement(4, 40), 8);
    });

    test('un resserrement ne descend jamais sous le minimum', () {
      expect(capteur.pincement(2, 0.01), 1);
    });

    test('un capteur sans zoom ramène tout à son unique niveau', () {
      expect(BornesZoom.neutre.possible, isFalse);
      expect(BornesZoom.neutre.pincement(1, 6), 1);
    });

    test('un capteur qui annonce un maximum plus petit que son minimum '
        'est remis à l\'endroit', () {
      // Vu sur des pilotes Android : sans cette remise à plat, `clamp` lève
      // et le viseur perd le zoom au lieu de s'en passer.
      final bornes = BornesZoom.duCapteur(min: 3, max: 1);
      expect(bornes.min, 3);
      expect(bornes.max, 3);
      expect(bornes.possible, isFalse);
    });

    test('un minimum nul ou infini est ignoré au profit de 1×', () {
      expect(BornesZoom.duCapteur(min: 0, max: 5).min, 1);
      expect(BornesZoom.duCapteur(min: double.nan, max: 5).min, 1);
    });

    test('un facteur aberrant laisse le niveau du début de geste', () {
      // `ScaleUpdateDetails.scale` vaut 0 le temps d'une image quand un doigt
      // se lève : sans ce garde-fou, le zoom retomberait brutalement à 1×.
      expect(capteur.pincement(3, 0), 3);
      expect(capteur.pincement(3, double.nan), 3);
      // L'infini n'est pas traité comme « le plus loin possible » : un facteur
      // non fini vient d'un calcul cassé, pas d'un geste, et le maximum du
      // capteur serait une valeur que personne n'a demandée.
      expect(capteur.pincement(3, double.infinity), 3);
    });
  });

  group('l\'indicateur', () {
    test('affiche un dixième et une virgule française', () {
      expect(IndicateurZoom.formater(2), '2,0×');
      expect(IndicateurZoom.formater(3.14159), '3,1×');
    });

    testWidgets('montre le grossissement courant', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(home: Scaffold(body: IndicateurZoom(niveau: 4.25))),
      );

      expect(find.text('4,3×'), findsOneWidget);
    });
  });
}
