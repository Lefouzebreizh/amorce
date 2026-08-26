/// Trace des appels, en debug uniquement.
///
/// Le corps de la requête d'identification contient la photo en base64 :
/// plusieurs centaines de milliers de caractères qui noieraient la console et
/// ralentiraient le debug. Seule sa taille est tracée. La clé d'API est
/// masquée : une trace se colle dans un ticket sans y penser.
library;

import 'dart:developer' as developer;
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';

class LoggingInterceptor extends Interceptor {
  const LoggingInterceptor();

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (kDebugMode) {
      final size = options.data == null
          ? 0
          : utf8.encode(jsonEncode(options.data)).length;
      developer.log(
        '→ ${options.method} ${_redact(options.uri)} (${_ko(size)})',
        name: 'réseau',
      );
    }
    handler.next(options);
  }

  @override
  void onResponse(Response<dynamic> response, ResponseInterceptorHandler handler) {
    if (kDebugMode) {
      developer.log(
        '← ${response.statusCode} ${_redact(response.requestOptions.uri)}',
        name: 'réseau',
      );
    }
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (kDebugMode) {
      developer.log(
        '✗ ${err.type.name} ${_redact(err.requestOptions.uri)} — ${err.message}',
        name: 'réseau',
      );
    }
    handler.next(err);
  }

  String _redact(Uri uri) =>
      uri.replace(queryParameters: {
        for (final entry in uri.queryParameters.entries)
          entry.key: entry.key == 'key' ? '***' : entry.value,
      }).toString();

  String _ko(int bytes) => '${(bytes / 1024).round()} ko';
}
