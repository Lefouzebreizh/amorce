/// Le client HTTP de l'application, monté une fois pour toutes.
///
/// `keepAlive` est délibéré : un `Dio` recréé à chaque écran perdrait son pool
/// de connexions, et la poignée de main TLS vers Google se repaierait à chaque
/// scan — plusieurs centaines de millisecondes visibles sur le viseur.
///
/// L'ordre des intercepteurs compte : la reprise est posée avant la trace,
/// pour que la trace montre chaque tentative réelle plutôt qu'un seul appel
/// mystérieusement long.
library;

import 'package:dio/dio.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../constants/app_config.dart';
import 'logging_interceptor.dart';
import 'retry_interceptor.dart';

part 'dio_client.g.dart';

@Riverpod(keepAlive: true)
Dio dio(Ref ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.geminiBaseUrl,
      connectTimeout: AppConfig.connectTimeout,
      receiveTimeout: AppConfig.receiveTimeout,
      headers: const {'Content-Type': 'application/json'},
      // Validation par défaut : tout code d'échec lève, donc tout passe par la
      // reprise puis par `AppException.from`. Le corps d'erreur renvoyé par
      // Gemini reste lisible dans `DioException.response` si on en a besoin.
    ),
  );

  dio.interceptors.addAll([
    RetryInterceptor(dio: dio),
    const LoggingInterceptor(),
  ]);

  ref.onDispose(dio.close);
  return dio;
}
