/// Ce que l'application a le droit de signaler, et comment on l'éteint.
///
/// Une alerte que l'on ne peut pas acquitter cesse d'être une alerte : elle
/// reste affichée, on apprend à ne plus la voir, et la suivante — la vraie —
/// passe inaperçue. « Vu » enregistre donc le prix du moment ; l'objet ne
/// resignalera qu'en descendant encore.
///
/// Rien ici n'interroge le réseau : tout se déduit de favoris déjà en mémoire.
/// C'est ce qui permet à la pastille du viseur d'être juste dès la première
/// image, sans écran de chargement.
library;

import '../../../../core/utils/result.dart';
import '../entities/favorite.dart';
import '../repositories/favorites_repository.dart';

class PendingAlerts {
  const PendingAlerts._();

  /// Les favoris passés sous leur seuil et non encore acquittés, du meilleur
  /// écart au moindre : si l'utilisateur n'en regarde qu'un, autant que ce
  /// soit celui qui lui fait gagner le plus.
  static List<Favorite> from(List<Favorite> favorites) {
    // `delta` est négatif quand le prix a baissé : trier par ordre croissant
    // met donc la plus forte baisse en tête.
    return favorites.where((f) => f.isAlerting).toList()
      ..sort((a, b) => a.delta.compareTo(b.delta));
  }
}

class AcknowledgeAlerts {
  const AcknowledgeAlerts(this._repository);

  final FavoritesRepository _repository;

  /// Acquitte un objet précis, au prix qu'il affiche à cet instant.
  Future<Result<void>> one(Favorite favorite) => _repository.save(
    favorite.copyWith(acknowledgedPrice: favorite.currentPrice),
  );

  /// Acquitte tout ce qui est en attente. Les écritures s'enchaînent plutôt
  /// que de partir en parallèle : Hive sérialise de toute façon, et un échec
  /// au milieu laisse alors un état cohérent — les premiers acquittés le
  /// restent.
  Future<Result<void>> all(List<Favorite> favorites) async {
    for (final favorite in PendingAlerts.from(favorites)) {
      final result = await one(favorite);
      if (result case Failure(:final error)) return Failure(error);
    }
    return const Success(null);
  }
}
