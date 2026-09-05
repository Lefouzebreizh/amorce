/// La traduction des échecs réseau, et surtout : lesquels valent la peine
/// d'être réessayés. Se tromper ici, c'est proposer « Réessayer » sur un quota
/// dépassé — un bouton qui ne peut qu'échouer.
library;

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/core/constants/app_config.dart';
import 'package:look_and_find/core/network/app_exception.dart';

DioException _erreur(DioExceptionType type, {int? statut, Object? corps}) =>
    DioException(
      requestOptions: RequestOptions(path: '/x'),
      type: type,
      response: statut == null
          ? null
          : Response<Object?>(
              requestOptions: RequestOptions(path: '/x'),
              statusCode: statut,
              data: corps,
            ),
    );

void main() {
  group('AppException.from', () {
    test('reconnaît les délais dépassés', () {
      expect(
        AppException.from(_erreur(DioExceptionType.connectionTimeout)),
        isA<TimeoutException>(),
      );
      expect(
        AppException.from(_erreur(DioExceptionType.receiveTimeout)),
        isA<TimeoutException>(),
      );
    });

    test('reconnaît la coupure réseau', () {
      expect(
        AppException.from(_erreur(DioExceptionType.connectionError)),
        isA<NetworkException>(),
      );
    });

    test('distingue les codes de réponse', () {
      final cas = {
        400: isA<InvalidRequestException>(),
        401: isA<AuthException>(),
        403: isA<AuthException>(),
        404: isA<ModelUnavailableException>(),
        429: isA<QuotaException>(),
        500: isA<ServerException>(),
        503: isA<ServerException>(),
      };

      cas.forEach((statut, attendu) {
        expect(
          AppException.from(
            _erreur(DioExceptionType.badResponse, statut: statut),
          ),
          attendu,
          reason: 'statut $statut',
        );
      });
    });

    test('un 400 répète la raison que le service donne', () {
      // Sans elle, « reprenez la photo » invite à refaire un geste qui échouera
      // toujours : un 400 se reproduit à l'identique, et seul ce message dit
      // ce que la requête a de fautif.
      final erreur = AppException.from(
        _erreur(
          DioExceptionType.badResponse,
          statut: 400,
          corps: {
            'error': {
              'code': 400,
              'message': 'Invalid JSON payload received. Unknown name "couleur".',
              'status': 'INVALID_ARGUMENT',
            },
          },
        ),
      );

      expect(erreur, isA<InvalidRequestException>());
      expect(erreur.message, contains('Unknown name'));
    });

    test('sans raison lisible, le message reste celui de l\'utilisateur', () {
      // Une erreur sans corps exploitable ne doit pas afficher « null » ni du
      // JSON brut : on retombe sur la phrase qui dit quoi faire.
      final erreur = AppException.from(
        _erreur(DioExceptionType.badResponse, statut: 400),
      );

      expect(erreur.message, contains('Reprenez-la'));
    });

    test('une raison interminable est bornée', () {
      final erreur = AppException.from(
        _erreur(
          DioExceptionType.badResponse,
          statut: 400,
          corps: {
            'error': {'message': 'x' * 900},
          },
        ),
      );

      expect(erreur.message.length, lessThan(400));
      expect(erreur.message, endsWith('…'));
    });

    test('un 404 désigne le modèle, pas la photo', () {
      // Google arrête ses modèles à date annoncée. Le jour où celui d'AppConfig
      // s'éteint, tous les scans tombent en même temps : le message doit
      // envoyer vers la constante à changer, pas vers le réseau.
      final erreur = AppException.from(
        _erreur(DioExceptionType.badResponse, statut: 404),
      );
      expect(erreur.message, contains(AppConfig.geminiModel));
      expect(erreur.isRetryable, isFalse);
    });

    test('laisse passer une AppException déjà traduite', () {
      const origine = QuotaException();
      expect(identical(AppException.from(origine), origine), isTrue);
    });
  });

  group('isRetryable', () {
    test('vrai pour ce qu\'une seconde tentative peut résoudre', () {
      expect(const NetworkException().isRetryable, isTrue);
      expect(const TimeoutException().isRetryable, isTrue);
      expect(const ServerException().isRetryable, isTrue);
    });

    test('faux pour ce qui échouera à l\'identique', () {
      expect(const QuotaException().isRetryable, isFalse);
      expect(const AuthException().isRetryable, isFalse);
      expect(const MissingApiKeyException().isRetryable, isFalse);
      expect(const CancelledException().isRetryable, isFalse);
    });
  });
}
