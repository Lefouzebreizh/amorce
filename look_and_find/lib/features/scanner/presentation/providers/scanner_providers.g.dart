// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'scanner_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(geminiVisionDataSource)
final geminiVisionDataSourceProvider = GeminiVisionDataSourceProvider._();

final class GeminiVisionDataSourceProvider
    extends
        $FunctionalProvider<
          GeminiVisionDataSource,
          GeminiVisionDataSource,
          GeminiVisionDataSource
        >
    with $Provider<GeminiVisionDataSource> {
  GeminiVisionDataSourceProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'geminiVisionDataSourceProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$geminiVisionDataSourceHash();

  @$internal
  @override
  $ProviderElement<GeminiVisionDataSource> $createElement(
    $ProviderPointer pointer,
  ) => $ProviderElement(pointer);

  @override
  GeminiVisionDataSource create(Ref ref) {
    return geminiVisionDataSource(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(GeminiVisionDataSource value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<GeminiVisionDataSource>(value),
    );
  }
}

String _$geminiVisionDataSourceHash() =>
    r'660dda84cd84b3777f13b023bebaadf95e2895cc';

@ProviderFor(scannerRepository)
final scannerRepositoryProvider = ScannerRepositoryProvider._();

final class ScannerRepositoryProvider
    extends
        $FunctionalProvider<
          ScannerRepository,
          ScannerRepository,
          ScannerRepository
        >
    with $Provider<ScannerRepository> {
  ScannerRepositoryProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'scannerRepositoryProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$scannerRepositoryHash();

  @$internal
  @override
  $ProviderElement<ScannerRepository> $createElement(
    $ProviderPointer pointer,
  ) => $ProviderElement(pointer);

  @override
  ScannerRepository create(Ref ref) {
    return scannerRepository(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(ScannerRepository value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<ScannerRepository>(value),
    );
  }
}

String _$scannerRepositoryHash() => r'968d671689a1e24a6fd70baa4d01f69853a5d046';

@ProviderFor(identifyProduct)
final identifyProductProvider = IdentifyProductProvider._();

final class IdentifyProductProvider
    extends
        $FunctionalProvider<IdentifyProduct, IdentifyProduct, IdentifyProduct>
    with $Provider<IdentifyProduct> {
  IdentifyProductProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'identifyProductProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$identifyProductHash();

  @$internal
  @override
  $ProviderElement<IdentifyProduct> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  IdentifyProduct create(Ref ref) {
    return identifyProduct(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(IdentifyProduct value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<IdentifyProduct>(value),
    );
  }
}

String _$identifyProductHash() => r'302875878bb8547f360be42d9fd572df0aea31fb';

@ProviderFor(ScanController)
final scanControllerProvider = ScanControllerProvider._();

final class ScanControllerProvider
    extends $AsyncNotifierProvider<ScanController, Product?> {
  ScanControllerProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'scanControllerProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$scanControllerHash();

  @$internal
  @override
  ScanController create() => ScanController();
}

String _$scanControllerHash() => r'ef61a3a7a6bbfc481b6cc4a9a38d6b5d510ae47d';

abstract class _$ScanController extends $AsyncNotifier<Product?> {
  FutureOr<Product?> build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<AsyncValue<Product?>, Product?>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AsyncValue<Product?>, Product?>,
              AsyncValue<Product?>,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, build);
  }
}
