/// Une photo où il n'y a rien à voir n'est pas une panne.
///
/// L'invite demande au modèle de renvoyer un nom vide quand la photo est floue,
/// trop sombre ou sans objet au centre. Cette réponse-là était traitée comme un
/// échec réessayable : l'écran proposait « Réessayer », c'est-à-dire de rejouer
/// **la même photo**, qui échouerait à l'identique en coûtant une requête de
/// plus. Ces tests verrouillent la distinction, du service jusqu'au bouton.
library;

import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/core/constants/app_strings.dart';
import 'package:look_and_find/core/network/app_exception.dart';
import 'package:look_and_find/core/theme/app_theme.dart';
import 'package:look_and_find/features/scanner/data/datasources/gemini_vision_datasource.dart';
import 'package:look_and_find/features/scanner/presentation/widgets/scan_status_sheet.dart';

class _FauxDio with DioMixin implements Dio {
  _FauxDio(this.corps) {
    options = BaseOptions();
    httpClientAdapter = _AdaptateurMuet();
  }

  final Map<String, dynamic> corps;

  @override
  Future<Response<T>> fetch<T>(RequestOptions options) async => Response<T>(
    requestOptions: options,
    statusCode: 200,
    data: corps as T,
  );
}

class _AdaptateurMuet implements HttpClientAdapter {
  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => throw UnimplementedError();
}

Map<String, dynamic> _reponseGemini(String texte) => {
  'candidates': [
    {
      'content': {
        'parts': [
          {'text': texte},
        ],
      },
    },
  ],
};

/// Un JPEG minuscule mais valide, pour que la compression aboutisse.
final _photo = Uint8List.fromList([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00,
]);

void main() {
  group('le service', () {
    test('un nom vide est une réponse, pas une réponse illisible', () async {
      // C'est exactement ce que l'invite demande sur une photo inexploitable.
      final source = GeminiVisionDataSource(
        _FauxDio(_reponseGemini('{"nom":"","categorie":"","usage":""}')),
        'AIzaTest',
      );

      await expectLater(
        source.decrire(_photo),
        throwsA(isA<ObjetNonReconnuException>()),
      );
    });

    test('une réponse vraiment illisible reste distincte', () async {
      // Les deux cas se ressemblent à l'écran et appellent deux gestes
      // opposés : reprendre la photo ici, réessayer là.
      final source = GeminiVisionDataSource(
        _FauxDio(_reponseGemini('Voici la fiche : {"nom": "Chaise",,}')),
        'AIzaTest',
      );

      await expectLater(
        source.decrire(_photo),
        throwsA(isA<UnreadableAnswerException>()),
      );
    });

    test('une photo refusée par les filtres a son propre échec', () async {
      final source = GeminiVisionDataSource(
        _FauxDio(const {
          'promptFeedback': {'blockReason': 'SAFETY'},
        }),
        'AIzaTest',
      );

      await expectLater(
        source.decrire(_photo),
        throwsA(isA<PhotoRefuseeException>()),
      );
    });
  });

  group('ce qu\'on a le droit de réessayer', () {
    test('rejouer la même photo ne sert à rien dans ces deux cas', () {
      expect(const ObjetNonReconnuException().isRetryable, isFalse);
      expect(const PhotoRefuseeException().isRetryable, isFalse);
    });

    test('une réponse tronquée, elle, peut aboutir au coup suivant', () {
      expect(const UnreadableAnswerException().isRetryable, isTrue);
    });

    test('aucun des deux messages ne parle de réessayer', () {
      // Le texte et le bouton doivent dire la même chose : un message qui
      // invite à réessayer sous un écran qui ne le propose pas laisse croire
      // à une commande manquante.
      for (final erreur in const [
        ObjetNonReconnuException(),
        PhotoRefuseeException(),
      ]) {
        expect(erreur.message.toLowerCase(), isNot(contains('réessay')));
      }
    });
  });

  group('l\'écran d\'échec', () {
    Future<void> monter(WidgetTester tester, AppException erreur) async {
      await tester.binding.setSurfaceSize(const Size(393, 873));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.dark,
          home: Scaffold(
            body: ScanStatusSheet.failed(
              error: erreur,
              onRetry: () {},
              onBack: () {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    testWidgets('ne propose pas de rejouer une photo sans objet',
        (tester) async {
      await monter(tester, const ObjetNonReconnuException());

      expect(find.text(AppStrings.retry), findsNothing);
      expect(find.text('Reprendre une photo'), findsOneWidget);
    });

    testWidgets('ne propose pas de rejouer une photo refusée', (tester) async {
      await monter(tester, const PhotoRefuseeException());

      expect(find.text(AppStrings.retry), findsNothing);
      expect(find.text('Reprendre une photo'), findsOneWidget);
    });

    testWidgets('propose bien de réessayer quand le réseau a lâché',
        (tester) async {
      await monter(tester, const NetworkException());

      expect(find.text(AppStrings.retry), findsOneWidget);
      expect(find.text('Reprendre une photo'), findsOneWidget);
    });
  });
}
