/// La page d'Accord montée pour de vrai, et la chaîne complète d'une photo.
///
/// **Ce que ces tests ne font pas : ouvrir la caméra.** Le guide du sous-projet
/// l'écrit — un refus `MissingPluginException` voyage par la vraie boucle
/// d'événements, que l'horloge simulée n'avance jamais. Un test qui l'attendrait
/// conclurait que la panne n'est pas signalée alors qu'elle n'a pas encore eu
/// lieu, et on partirait corriger un écran qui va bien. La session est donc
/// surchargée.
library;

import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:look_and_find/core/network/app_exception.dart';
import 'package:look_and_find/features/accord/domain/entities/photo_verdict.dart';
import 'package:look_and_find/features/accord/domain/usecases/analyser_photo.dart';
import 'package:look_and_find/features/accord/presentation/pages/accord_page.dart';
import 'package:look_and_find/features/accord/presentation/widgets/cadre_visee.dart';
import 'package:look_and_find/features/scanner/presentation/providers/camera_providers.dart';

/// Une photo unie, encodée en JPEG comme en sortirait un appareil.
Uint8List _photo(int r, int g, int b, {int cote = 400}) {
  final image = img.Image(width: cote, height: cote);
  for (var y = 0; y < cote; y++) {
    for (var x = 0; x < cote; x++) {
      image.setPixelRgb(x, y, r, g, b);
    }
  }
  return Uint8List.fromList(img.encodeJpg(image, quality: 95));
}

void main() {
  group('la chaîne complète, des octets à la palette', () {
    test('un mur ocre rend son verdict et ses trois harmonies', () async {
      final resultat = await AnalyserPhoto.depuisOctets(_photo(198, 156, 109));
      expect(resultat.illisible, isFalse);
      expect(resultat.verdict.estAcceptee, isTrue,
          reason: resultat.verdict.toString());
      expect(resultat.harmonies, hasLength(3));
    });

    test('un mur gris est refusé, et sans harmonies', () async {
      final resultat = await AnalyserPhoto.depuisOctets(_photo(128, 128, 128));
      expect(resultat.verdict.estAcceptee, isFalse);
      expect(resultat.verdict.refus, PhotoRefus.surfaceDelavee);
      expect(resultat.harmonies, isEmpty,
          reason: 'calculer des harmonies sur un refus serait du travail perdu '
              'et un état que la page pourrait afficher par erreur');
    });

    test('des octets illisibles sont une panne, pas un refus', () async {
      // Les confondre afficherait « surface trop sombre » sur un fichier
      // corrompu, et enverrait la personne rallumer la lumière.
      final resultat = await AnalyserPhoto.depuisOctets(
        Uint8List.fromList(const [0, 1, 2, 3, 4, 5, 6, 7]),
      );
      expect(resultat.illisible, isTrue);
      expect(resultat.harmonies, isEmpty);
    });
  });

  group('la page', () {
    testWidgets('montre le cadre et le déclencheur quand la caméra est prête',
        (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            cameraSessionProvider.overrideWith(_SessionEnPanne.new),
          ],
          child: const MaterialApp(home: AccordPage()),
        ),
      );
      await tester.pump();

      // Le cadre est posé quoi qu'il arrive à la caméra : c'est lui qui dit à
      // quoi sert l'écran.
      expect(find.byType(CadreVisee), findsOneWidget);
      expect(find.textContaining('Remplissez le cadre'), findsOneWidget);
    });

    testWidgets("le déclencheur ne recouvre pas l'aide", (tester) async {
      // Le défaut que ce test fige, et il n'a été vu qu'en rendant la page en
      // image : l'aide était posée à une fraction fixe de la hauteur et le
      // déclencheur à une autre, si bien que le bouton mangeait le texte. Sept
      // tests verts ne le disaient pas — aucun ne regardait deux widgets
      // ensemble.
      await tester.binding.setSurfaceSize(const Size(420, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(
        ProviderScope(
          overrides: [cameraSessionProvider.overrideWith(_SessionEnPanne.new)],
          child: const MaterialApp(home: AccordPage()),
        ),
      );
      await tester.pump();

      final aide = tester.getRect(find.textContaining('Remplissez le cadre'));
      final declencheur =
          tester.getRect(find.byType(FloatingActionButton).first);
      expect(aide.overlaps(declencheur), isFalse,
          reason: 'aide $aide, déclencheur $declencheur');
    });

    testWidgets('une caméra refusée est expliquée, avec un « Réessayer »',
        (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            cameraSessionProvider.overrideWith(_SessionEnPanne.new),
          ],
          child: const MaterialApp(home: AccordPage()),
        ),
      );
      await tester.pump();

      expect(find.text("L'appareil photo est indisponible."), findsOneWidget);
      expect(find.text('Réessayer'), findsOneWidget);
    });
  });
}

/// Une session qui échoue tout de suite : c'est le seul moyen d'atteindre
/// l'écran d'échec sans ouvrir un vrai capteur.
class _SessionEnPanne extends CameraSession {
  @override
  Future<Never> build() async =>
      throw const CameraUnavailableException("L'appareil photo est indisponible.");
}
