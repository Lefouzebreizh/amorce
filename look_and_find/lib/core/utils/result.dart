/// Résultat d'une opération faillible, sans exception qui traverse les couches.
///
/// Le domaine ne connaît que [Result] : une couche `data` qui laisserait
/// remonter une `DioException` obligerait la présentation à connaître Dio pour
/// afficher un message. Ici, la traduction se fait une seule fois, au bord du
/// réseau, et tout le reste manipule des cas fermés.
library;

import '../network/app_exception.dart';

sealed class Result<T> {
  const Result();

  bool get isSuccess => this is Success<T>;

  /// Valeur si succès, `null` sinon. Pratique là où l'échec est déjà traité.
  T? get valueOrNull => switch (this) {
    Success<T>(:final value) => value,
    Failure<T>() => null,
  };

  R fold<R>(
    R Function(T value) onSuccess,
    R Function(AppException error) onFailure,
  ) => switch (this) {
    Success<T>(:final value) => onSuccess(value),
    Failure<T>(:final error) => onFailure(error),
  };
}

final class Success<T> extends Result<T> {
  const Success(this.value);
  final T value;
}

final class Failure<T> extends Result<T> {
  const Failure(this.error);
  final AppException error;
}
