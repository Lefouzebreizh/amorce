/// La traduction des échecs réseau, et surtout : lesquels valent la peine
/// d'être réessayés. Se tromper ici, c'est proposer « Réessayer » sur un quota
/// dépassé — un bouton qui ne peut qu'échouer.
library;

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/core/network/app_exception.dart';

DioException _erreur(DioExceptionType type, {int? statut}) => DioException(
  requestOptions: RequestOptions(path: '/x'),
  type: type,
  response: statut == null
      ? null
      : Response<void>(
          requestOptions: RequestOptions(path: '/x'),
          statusCode: statut,
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
