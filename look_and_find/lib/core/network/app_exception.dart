/// Les échecs que l'application sait expliquer à l'utilisateur.
///
/// Un `DioException` ne se montre pas : « DioExceptionType.connectionTimeout »
/// ne dit pas s'il faut réessayer, changer de réseau, ou abandonner. Chaque cas
/// porte donc son message en français **et** un [isRetryable] qui décide seul
/// si un bouton « Réessayer » a un sens — sans lui, on le propose sur un quota
/// dépassé, où il ne peut qu'échouer à nouveau.
library;

import 'package:dio/dio.dart';

import '../constants/app_config.dart';

sealed class AppException implements Exception {
  const AppException(this.message);

  final String message;

  bool get isRetryable => true;

  @override
  String toString() => '$runtimeType: $message';

  /// Point de traduction unique entre Dio et le domaine.
  static AppException from(Object error) {
    if (error is AppException) return error;
    if (error is! DioException) return UnknownException(error.toString());

    return switch (error.type) {
      DioExceptionType.connectionTimeout ||
      DioExceptionType.sendTimeout ||
      DioExceptionType.receiveTimeout ||
      DioExceptionType.transformTimeout => const TimeoutException(),
      DioExceptionType.connectionError => const NetworkException(),
      DioExceptionType.cancel => const CancelledException(),
      DioExceptionType.badResponse => _fromStatus(
        error.response?.statusCode,
        error.response?.data,
      ),
      _ => UnknownException(error.message ?? 'Erreur réseau inconnue'),
    };
  }

  static AppException _fromStatus(int? status, [Object? corps]) {
    if (status == null) {
      return const UnknownException('Réponse sans code de statut.');
    }
    return switch (status) {
      400 => InvalidRequestException(raisonDuServeur(corps)),
      401 || 403 => const AuthException(),
      404 => const ModelUnavailableException(),
      429 => const QuotaException(),
      >= 500 => const ServerException(),
      _ => UnknownException('Réponse inattendue du serveur ($status)'),
    };
  }
}

final class NetworkException extends AppException {
  const NetworkException()
    : super('Pas de connexion. Vérifiez le réseau et réessayez.');
}

final class TimeoutException extends AppException {
  const TimeoutException()
    : super('Le serveur met trop de temps à répondre.');
}

final class ServerException extends AppException {
  const ServerException()
    : super('Le service d\'identification est momentanément indisponible.');
}

final class QuotaException extends AppException {
  const QuotaException()
    : super('Trop de scans en peu de temps. Patientez une minute.');

  /// Réessayer immédiatement ne ferait que consommer le quota restant.
  @override
  bool get isRetryable => false;
}

final class AuthException extends AppException {
  const AuthException()
    : super('Clé d\'API refusée. Vérifiez GEMINI_API_KEY.');

  @override
  bool get isRetryable => false;
}

/// Le message que l'API a écrit, quand elle en a écrit un.
///
/// Les erreurs de Google suivent toutes la même forme —
/// `{"error": {"code": …, "message": …, "status": …}}` — et le `message` est
/// rédigé pour être lu. Borné à 300 caractères : au-delà, c'est une trace de
/// pile qui n'apprend rien de plus à l'écran.
String? raisonDuServeur(Object? corps) {
  if (corps is! Map) return null;
  final erreur = corps['error'];
  if (erreur is! Map) return null;
  final message = erreur['message']?.toString().trim();
  if (message == null || message.isEmpty) return null;
  return message.length <= 300 ? message : '${message.substring(0, 300)}…';
}

/// Le chemin est bon, le modèle n'existe plus.
///
/// Google arrête ses modèles à date annoncée, et l'API répond alors 404 sur une
/// requête par ailleurs correcte. Confondu avec une panne, ce cas coûte une
/// soirée : tous les scans échouent en même temps, sur tous les appareils, sans
/// qu'une ligne du dépôt ait bougé. Le message nomme donc le modèle et l'endroit
/// où le changer — le correctif tient en une constante.
final class ModelUnavailableException extends AppException {
  const ModelUnavailableException()
    : super(
        'Le modèle ${AppConfig.geminiModel} n\'est plus servi par Google. '
        'L\'application doit être mise à jour (AppConfig.geminiModel).',
      );

  /// Réessayer ne peut que répéter le même 404.
  @override
  bool get isRetryable => false;
}

/// Requête refusée par le service — et **la raison qu'il donne est reprise**.
///
/// Elle ne l'était pas, et c'est ce qui a coûté le plus cher : un 400 se répète
/// à l'identique à chaque essai, « reprenez la photo » invite à recommencer un
/// geste qui échouera toujours, et le seul texte capable de dire pourquoi —
/// « Unknown name X », « Invalid value at … » — était jeté à la traduction.
/// Google écrit des messages lisibles ; les taire revient à transformer un
/// diagnostic d'une seconde en une soirée.
final class InvalidRequestException extends AppException {
  InvalidRequestException([String? raison])
    : super(
        raison == null
            ? 'La photo n\'a pas pu être envoyée. Reprenez-la.'
            : 'Requête refusée par le service : $raison',
      );

  /// Une requête refusée l'est pour ce qu'elle contient, pas pour le moment où
  /// elle part : la rejouer telle quelle rend le même refus. Proposer
  /// « Réessayer » ici fait tourner l'utilisateur en rond — le geste utile est
  /// de reprendre la photo, que l'écran propose à part.
  @override
  bool get isRetryable => false;
}

final class CancelledException extends AppException {
  const CancelledException() : super('Identification annulée.');

  @override
  bool get isRetryable => false;
}

/// Le modèle a répondu, mais pas ce qu'on lui demandait. Distinct d'une erreur
/// réseau : ici c'est la photo qu'il faut refaire, pas la connexion.
final class UnreadableAnswerException extends AppException {
  const UnreadableAnswerException([String? detail])
    : super(
        detail ??
            'Objet non identifié. Rapprochez-vous et dégagez l\'arrière-plan.',
      );
}

final class MissingApiKeyException extends AppException {
  const MissingApiKeyException()
    : super('Aucune clé Gemini n\'a été fournie au build.');

  @override
  bool get isRetryable => false;
}

/// Aucun appareil photo exploitable, ou accès refusé par l'utilisateur.
/// Déclarée ici et non près du viseur : [AppException] est scellée, ce qui est
/// justement ce qui garantit qu'aucune couche ne peut inventer un échec que
/// l'interface ne saurait pas expliquer.
final class CameraUnavailableException extends AppException {
  const CameraUnavailableException(super.message);
}

final class CacheException extends AppException {
  const CacheException([String? detail])
    : super(detail ?? 'Le stockage local n\'a pas répondu.');
}

final class UnknownException extends AppException {
  const UnknownException(super.message);
}
