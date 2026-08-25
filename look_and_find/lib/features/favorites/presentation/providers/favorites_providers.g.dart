// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'favorites_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(favoritesBox)
final favoritesBoxProvider = FavoritesBoxProvider._();

final class FavoritesBoxProvider
    extends $FunctionalProvider<Box<String>, Box<String>, Box<String>>
    with $Provider<Box<String>> {
  FavoritesBoxProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'favoritesBoxProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$favoritesBoxHash();

  @$internal
  @override
  $ProviderElement<Box<String>> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  Box<String> create(Ref ref) {
    return favoritesBox(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(Box<String> value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<Box<String>>(value),
    );
  }
}

String _$favoritesBoxHash() => r'59932b067f108faff1e421f9e35172d53e78dc60';

@ProviderFor(historyBox)
final historyBoxProvider = HistoryBoxProvider._();

final class HistoryBoxProvider
    extends $FunctionalProvider<Box<String>, Box<String>, Box<String>>
    with $Provider<Box<String>> {
  HistoryBoxProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'historyBoxProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$historyBoxHash();

  @$internal
  @override
  $ProviderElement<Box<String>> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  Box<String> create(Ref ref) {
    return historyBox(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(Box<String> value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<Box<String>>(value),
    );
  }
}

String _$historyBoxHash() => r'19b830279b3385d9a1fc92f89bb99d0be7b533b1';

@ProviderFor(favoritesLocalDataSource)
final favoritesLocalDataSourceProvider = FavoritesLocalDataSourceProvider._();

final class FavoritesLocalDataSourceProvider
    extends
        $FunctionalProvider<
          FavoritesLocalDataSource,
          FavoritesLocalDataSource,
          FavoritesLocalDataSource
        >
    with $Provider<FavoritesLocalDataSource> {
  FavoritesLocalDataSourceProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'favoritesLocalDataSourceProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$favoritesLocalDataSourceHash();

  @$internal
  @override
  $ProviderElement<FavoritesLocalDataSource> $createElement(
    $ProviderPointer pointer,
  ) => $ProviderElement(pointer);

  @override
  FavoritesLocalDataSource create(Ref ref) {
    return favoritesLocalDataSource(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(FavoritesLocalDataSource value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<FavoritesLocalDataSource>(value),
    );
  }
}

String _$favoritesLocalDataSourceHash() =>
    r'3229495bf9cfdb515b1ee3937d4606c69046f4ee';

@ProviderFor(favoritesRepository)
final favoritesRepositoryProvider = FavoritesRepositoryProvider._();

final class FavoritesRepositoryProvider
    extends
        $FunctionalProvider<
          FavoritesRepository,
          FavoritesRepository,
          FavoritesRepository
        >
    with $Provider<FavoritesRepository> {
  FavoritesRepositoryProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'favoritesRepositoryProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$favoritesRepositoryHash();

  @$internal
  @override
  $ProviderElement<FavoritesRepository> $createElement(
    $ProviderPointer pointer,
  ) => $ProviderElement(pointer);

  @override
  FavoritesRepository create(Ref ref) {
    return favoritesRepository(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(FavoritesRepository value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<FavoritesRepository>(value),
    );
  }
}

String _$favoritesRepositoryHash() =>
    r'5206b7f592e4457ad5e2d50dcdd02075a2ff538a';

@ProviderFor(toggleFavorite)
final toggleFavoriteProvider = ToggleFavoriteProvider._();

final class ToggleFavoriteProvider
    extends $FunctionalProvider<ToggleFavorite, ToggleFavorite, ToggleFavorite>
    with $Provider<ToggleFavorite> {
  ToggleFavoriteProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'toggleFavoriteProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$toggleFavoriteHash();

  @$internal
  @override
  $ProviderElement<ToggleFavorite> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  ToggleFavorite create(Ref ref) {
    return toggleFavorite(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(ToggleFavorite value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<ToggleFavorite>(value),
    );
  }
}

String _$toggleFavoriteHash() => r'a28ef482e7cf8084764f1771abb037a38c1d6a93';

@ProviderFor(refreshFavoritePrice)
final refreshFavoritePriceProvider = RefreshFavoritePriceProvider._();

final class RefreshFavoritePriceProvider
    extends
        $FunctionalProvider<
          RefreshFavoritePrice,
          RefreshFavoritePrice,
          RefreshFavoritePrice
        >
    with $Provider<RefreshFavoritePrice> {
  RefreshFavoritePriceProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'refreshFavoritePriceProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$refreshFavoritePriceHash();

  @$internal
  @override
  $ProviderElement<RefreshFavoritePrice> $createElement(
    $ProviderPointer pointer,
  ) => $ProviderElement(pointer);

  @override
  RefreshFavoritePrice create(Ref ref) {
    return refreshFavoritePrice(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(RefreshFavoritePrice value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<RefreshFavoritePrice>(value),
    );
  }
}

String _$refreshFavoritePriceHash() =>
    r'c831bc73d4152f3613c9efa7ad1268039a76a457';

@ProviderFor(favorites)
final favoritesProvider = FavoritesProvider._();

final class FavoritesProvider
    extends
        $FunctionalProvider<
          AsyncValue<List<Favorite>>,
          List<Favorite>,
          Stream<List<Favorite>>
        >
    with $FutureModifier<List<Favorite>>, $StreamProvider<List<Favorite>> {
  FavoritesProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'favoritesProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$favoritesHash();

  @$internal
  @override
  $StreamProviderElement<List<Favorite>> $createElement(
    $ProviderPointer pointer,
  ) => $StreamProviderElement(pointer);

  @override
  Stream<List<Favorite>> create(Ref ref) {
    return favorites(ref);
  }
}

String _$favoritesHash() => r'ebc6823b73963097962261c8dd0dfb6c0e698e0a';

@ProviderFor(history)
final historyProvider = HistoryProvider._();

final class HistoryProvider
    extends
        $FunctionalProvider<
          AsyncValue<List<Product>>,
          List<Product>,
          Stream<List<Product>>
        >
    with $FutureModifier<List<Product>>, $StreamProvider<List<Product>> {
  HistoryProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'historyProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$historyHash();

  @$internal
  @override
  $StreamProviderElement<List<Product>> $createElement(
    $ProviderPointer pointer,
  ) => $StreamProviderElement(pointer);

  @override
  Stream<List<Product>> create(Ref ref) {
    return history(ref);
  }
}

String _$historyHash() => r'b426171369edbf23f0be6c7ba9c1188426217e91';

/// Suivi ou non : dérivé du flux plutôt que lu à la demande, pour que le cœur
/// de la fiche produit change au moment même où la liste change, sans code de
/// synchronisation entre les deux écrans.

@ProviderFor(isFavorite)
final isFavoriteProvider = IsFavoriteFamily._();

/// Suivi ou non : dérivé du flux plutôt que lu à la demande, pour que le cœur
/// de la fiche produit change au moment même où la liste change, sans code de
/// synchronisation entre les deux écrans.

final class IsFavoriteProvider extends $FunctionalProvider<bool, bool, bool>
    with $Provider<bool> {
  /// Suivi ou non : dérivé du flux plutôt que lu à la demande, pour que le cœur
  /// de la fiche produit change au moment même où la liste change, sans code de
  /// synchronisation entre les deux écrans.
  IsFavoriteProvider._({
    required IsFavoriteFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'isFavoriteProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$isFavoriteHash();

  @override
  String toString() {
    return r'isFavoriteProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $ProviderElement<bool> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  bool create(Ref ref) {
    final argument = this.argument as String;
    return isFavorite(ref, argument);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(bool value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<bool>(value),
    );
  }

  @override
  bool operator ==(Object other) {
    return other is IsFavoriteProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$isFavoriteHash() => r'ac0e358309a30135383b13d51caaf8db798ad0ee';

/// Suivi ou non : dérivé du flux plutôt que lu à la demande, pour que le cœur
/// de la fiche produit change au moment même où la liste change, sans code de
/// synchronisation entre les deux écrans.

final class IsFavoriteFamily extends $Family
    with $FunctionalFamilyOverride<bool, String> {
  IsFavoriteFamily._()
    : super(
        retry: null,
        name: r'isFavoriteProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// Suivi ou non : dérivé du flux plutôt que lu à la demande, pour que le cœur
  /// de la fiche produit change au moment même où la liste change, sans code de
  /// synchronisation entre les deux écrans.

  IsFavoriteProvider call(String productId) =>
      IsFavoriteProvider._(argument: productId, from: this);

  @override
  String toString() => r'isFavoriteProvider';
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

@ProviderFor(ScanJournal)
final scanJournalProvider = ScanJournalProvider._();

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
final class ScanJournalProvider
    extends $NotifierProvider<ScanJournal, PriceDrop?> {
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
  ScanJournalProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'scanJournalProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$scanJournalHash();

  @$internal
  @override
  ScanJournal create() => ScanJournal();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(PriceDrop? value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<PriceDrop?>(value),
    );
  }
}

String _$scanJournalHash() => r'deb20c4ab327c0fc638d676be98594d6835b628e';

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

abstract class _$ScanJournal extends $Notifier<PriceDrop?> {
  PriceDrop? build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<PriceDrop?, PriceDrop?>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<PriceDrop?, PriceDrop?>,
              PriceDrop?,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, build);
  }
}
