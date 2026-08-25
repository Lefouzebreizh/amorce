/// Reprise automatique des appels qui ont échoué pour une raison passagère.
///
/// Sur réseau mobile, un appel sur quelques-uns meurt en coupure ou en délai
/// dépassé sans que rien ne soit cassé. Sans reprise, l'utilisateur voit une
/// erreur pour un incident d'une seconde, et reprend sa photo pour rien.
///
/// Deux règles délimitent la reprise :
/// — **seuls les échecs passagers** (coupure, délai, 5xx, 429). Un 400 ou un
///   403 se reproduira à l'identique : réessayer ne fait que retarder le
///   message d'erreur.
/// — **attente qui double** (800 ms, 1,6 s). Trois appels immédiats sur un
///   service déjà saturé aggravent la saturation.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:dio/dio.dart';

import '../constants/app_config.dart';

class RetryInterceptor extends Interceptor {
  RetryInterceptor({required this.dio, this.maxRetries = AppConfig.maxRetries});

  final Dio dio;
  final int maxRetries;

  static const String _attemptKey = 'retry_attempt';

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final attempt = (err.requestOptions.extra[_attemptKey] as int?) ?? 0;

    if (attempt >= maxRetries || !_isTransient(err)) {
      return handler.next(err);
    }

    await Future<void>.delayed(_delayFor(attempt));

    final options = err.requestOptions;
    options.extra = {...options.extra, _attemptKey: attempt + 1};

    try {
      final response = await dio.fetch<dynamic>(options);
      return handler.resolve(response);
    } on DioException catch (retried) {
      // La reprise a échoué à son tour : c'est cette erreur-là qui remonte,
      // pas la première, sinon le diagnostic porte sur un état périmé.
      return handler.next(retried);
    }
  }

  Duration _delayFor(int attempt) => Duration(
    milliseconds:
        AppConfig.retryBaseDelay.inMilliseconds * math.pow(2, attempt).toInt(),
  );

  bool _isTransient(DioException err) {
    switch (err.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
      case DioExceptionType.connectionError:
        return true;
      case DioExceptionType.badResponse:
        final status = err.response?.statusCode ?? 0;
        return status == 429 || status >= 500;
      case DioExceptionType.cancel:
      case DioExceptionType.badCertificate:
      case DioExceptionType.unknown:
        return false;
    }
  }
}
