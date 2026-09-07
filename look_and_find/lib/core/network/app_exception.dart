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
/// Le service n'a pas rendu quelque chose qu'on sache lire.
///
/// Réponse tronquée, enveloppe sans texte, JSON malformé : la photo n'est pas
/// en cause, et la même requête peut très bien aboutir au coup suivant. C'est
/// donc le seul des trois échecs de réponse qui mérite « Réessayer ».
///
/// **Son message ne parle plus d'objet non identifié.** Il l'a fait longtemps,
/// et c'était la même phrase que celle du cas ci-dessous : quand une seule
/// formule couvre « je n'ai rien vu sur ta photo » et « je n'ai pas compris ce
/// que le serveur m'a répondu », on ne peut plus savoir lequel des deux geste
/// corrige la situation.
final class UnreadableAnswerException extends AppException {
  const UnreadableAnswerException([String? detail])
    : super(
        detail ?? 'Le service n\'a rien renvoyé d\'exploitable.',
      );
}

/// Le service a répondu, correctement, et n'a **rien reconnu**.
///
/// Ce n'est pas une panne : c'est une réponse, et c'est même celle que l'invite
/// demande explicitement sur une photo floue, trop sombre ou vide. Elle était
/// pourtant présentée comme un échec réessayable, si bien que le bouton
/// « Réessayer » proposait de rejouer **la même photo** — qui échouerait
/// exactement pareil, en coûtant une seconde requête. Le seul geste qui change
/// quelque chose est de reprendre la photo, et c'est celui que l'écran offre
/// désormais seul.
final class ObjetNonReconnuException extends AppException {
  const ObjetNonReconnuException()
    : super(
        'Aucun objet reconnu sur cette photo. Rapprochez-vous, éclairez, et '
        'dégagez l\'arrière-plan.',
      );

  @override
  bool get isRetryable => false;
}

/// La photo a été refusée par les filtres du service.
///
/// Visage, document personnel, contenu jugé sensible. Le refus est une
/// propriété de **cette photo-là** : la renvoyer telle quelle sera refusée à
/// l'identique, et le dire vaut mieux qu'un « Réessayer » qui consomme le quota
/// pour rien. Le message nomme la cause probable, parce que « refusée » sans
/// raison laisse croire à une panne du service.
final class PhotoRefuseeException extends AppException {
  const PhotoRefuseeException()
    : super(
        'Cette photo a été refusée par le service. Évitez les personnes et '
        'les documents personnels dans le cadre.',
      );

  @override
  bool get isRetryable => false;
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
