/// Câblage du stockage local et lecture des deux listes.
///
/// Les boîtes Hive arrivent par **surcharge** depuis `main.dart` : les ouvrir
/// ici obligerait chaque écran qui lit un favori à traverser un
/// `AsyncValue.loading`, pour une donnée qui est déjà en mémoire avant même
/// que le premier widget soit construit. La surcharge rend aussi les tests
/// triviaux — une boîte en mémoire suffit à remplacer tout le disque.
library;

import 'package:hive_flutter/hive_flutter.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../product_detail/domain/entities/product.dart';
import '../../data/datasources/favorites_local_datasource.dart';
import '../../data/repositories/favorites_repository_impl.dart';
import '../../domain/entities/favorite.dart';
import '../../domain/repositories/favorites_repository.dart';
import '../../domain/usecases/acknowledge_alerts.dart';
import '../../domain/usecases/refresh_favorite_price.dart';
import '../../domain/usecases/toggle_favorite.dart';

part 'favorites_providers.g.dart';

@Riverpod(keepAlive: true)
Box<String> favoritesBox(Ref ref) => throw UnimplementedError(
  'La boîte des favoris est surchargée au démarrage, dans main().',
);

@Riverpod(keepAlive: true)
Box<String> historyBox(Ref ref) => throw UnimplementedError(
  'La boîte d\'historique est surchargée au démarrage, dans main().',
);

@Riverpod(keepAlive: true)
FavoritesLocalDataSource favoritesLocalDataSource(Ref ref) =>
    FavoritesLocalDataSource(
      ref.watch(favoritesBoxProvider),
      ref.watch(historyBoxProvider),
    );

@Riverpod(keepAlive: true)
FavoritesRepository favoritesRepository(Ref ref) =>
    FavoritesRepositoryImpl(ref.watch(favoritesLocalDataSourceProvider));

@Riverpod(keepAlive: true)
ToggleFavorite toggleFavorite(Ref ref) =>
    ToggleFavorite(ref.watch(favoritesRepositoryProvider));

@Riverpod(keepAlive: true)
RefreshFavoritePrice refreshFavoritePrice(Ref ref) =>
    RefreshFavoritePrice(ref.watch(favoritesRepositoryProvider));

@riverpod
Stream<List<Favorite>> favorites(Ref ref) =>
    ref.watch(favoritesRepositoryProvider).watchFavorites();

@riverpod
Stream<List<Product>> history(Ref ref) =>
    ref.watch(favoritesRepositoryProvider).watchHistory();

/// Suivi ou non : dérivé du flux plutôt que lu à la demande, pour que le cœur
/// de la fiche produit change au moment même où la liste change, sans code de
/// synchronisation entre les deux écrans.
@riverpod
bool isFavorite(Ref ref, String productId) {
  final list = ref.watch(favoritesProvider).value ?? const <Favorite>[];
  return list.any((favorite) => favorite.product.id == productId);
}

/// Ce qu'un scan produit **en plus** de la fiche : une entrée d'historique, et
/// la mise à jour du favori correspondant s'il existe.
///
/// `keepAlive` est nécessaire, pas confortable : la baisse est constatée par le
/// viseur et lue par la fiche produit, deux écrans qui ne coexistent jamais. En
/// `autoDispose`, l'état serait libéré entre les deux et la baisse ne
/// s'afficherait jamais.
///
/// Le contrôleur de scan y délègue plutôt que d'appeler deux dépôts lui-même :
/// l'ordre des deux écritures compte (l'historique d'abord, pour qu'un échec
/// de mise à jour du favori ne fasse pas perdre la trace du scan) et il n'a
/// pas à être rappelé sur chaque site d'appel.
@Riverpod(keepAlive: true)
class ScanJournal extends _$ScanJournal {
  /// Dernière baisse constatée, consommée puis remise à `null` par l'écran qui
  /// l'affiche — sinon la même bannière réapparaît à chaque reconstruction.
  @override
  PriceDrop? build() => null;

  Future<void> record(Product product) async {
    // Les dépendances sont lues avant le premier `await`. Après une coupure
    // asynchrone, rien ne garantit que `ref` soit encore utilisable, et le
    // relevé de prix se perdrait sur une exception au lieu d'être enregistré.
    final repository = ref.read(favoritesRepositoryProvider);
    final refresh = ref.read(refreshFavoritePriceProvider);

    await repository.pushHistory(product);
    final drop = await refresh(product);
    if (drop != null) state = drop;
  }

  void consume() => state = null;
}

@Riverpod(keepAlive: true)
AcknowledgeAlerts acknowledgeAlerts(Ref ref) =>
    AcknowledgeAlerts(ref.watch(favoritesRepositoryProvider));

/// Les objets passés sous leur seuil et non encore acquittés.
///
/// Dérivé du flux des favoris plutôt que relu à la demande : la pastille du
/// viseur, la bannière de la liste et l'ordre des lignes doivent dire la même
/// chose au même instant, et un calcul partagé est le seul moyen d'en être sûr
/// sans code de synchronisation.
@riverpod
List<Favorite> pendingAlerts(Ref ref) => PendingAlerts.from(
  ref.watch(favoritesProvider).value ?? const <Favorite>[],
);
