// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'fiches_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(fichesBox)
final fichesBoxProvider = FichesBoxProvider._();

final class FichesBoxProvider
    extends $FunctionalProvider<Box<String>, Box<String>, Box<String>>
    with $Provider<Box<String>> {
  FichesBoxProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'fichesBoxProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$fichesBoxHash();

  @$internal
  @override
  $ProviderElement<Box<String>> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  Box<String> create(Ref ref) {
    return fichesBox(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(Box<String> value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<Box<String>>(value),
    );
  }
}

String _$fichesBoxHash() => r'4f23653a948206f289fcf452afdbbb69b2f03861';

@ProviderFor(fichesRepository)
final fichesRepositoryProvider = FichesRepositoryProvider._();

final class FichesRepositoryProvider
    extends
        $FunctionalProvider<
          FichesRepository,
          FichesRepository,
          FichesRepository
        >
    with $Provider<FichesRepository> {
  FichesRepositoryProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'fichesRepositoryProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$fichesRepositoryHash();

  @$internal
  @override
  $ProviderElement<FichesRepository> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  FichesRepository create(Ref ref) {
    return fichesRepository(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(FichesRepository value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<FichesRepository>(value),
    );
  }
}

String _$fichesRepositoryHash() => r'47cf66e1bfea10962e9d73d609f56cb80634f8f6';

/// Le flux que lit « Mes fiches ». Il réémet à chaque scan enregistré, si bien
/// qu'une fiche identifiée pendant que la liste est ouverte y apparaît sans
/// qu'on ait à en sortir.

@ProviderFor(fiches)
final fichesProvider = FichesProvider._();

/// Le flux que lit « Mes fiches ». Il réémet à chaque scan enregistré, si bien
/// qu'une fiche identifiée pendant que la liste est ouverte y apparaît sans
/// qu'on ait à en sortir.

final class FichesProvider
    extends
        $FunctionalProvider<
          AsyncValue<List<FicheObjet>>,
          List<FicheObjet>,
          Stream<List<FicheObjet>>
        >
    with $FutureModifier<List<FicheObjet>>, $StreamProvider<List<FicheObjet>> {
  /// Le flux que lit « Mes fiches ». Il réémet à chaque scan enregistré, si bien
  /// qu'une fiche identifiée pendant que la liste est ouverte y apparaît sans
  /// qu'on ait à en sortir.
  FichesProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'fichesProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$fichesHash();

  @$internal
  @override
  $StreamProviderElement<List<FicheObjet>> $createElement(
    $ProviderPointer pointer,
  ) => $StreamProviderElement(pointer);

  @override
  Stream<List<FicheObjet>> create(Ref ref) {
    return fiches(ref);
  }
}

String _$fichesHash() => r'c41ff44252876f27997160f3038893683f8d80f0';
