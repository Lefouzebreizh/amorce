// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'scanner_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(settingsBox)
final settingsBoxProvider = SettingsBoxProvider._();

final class SettingsBoxProvider
    extends $FunctionalProvider<Box<String>, Box<String>, Box<String>>
    with $Provider<Box<String>> {
  SettingsBoxProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'settingsBoxProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$settingsBoxHash();

  @$internal
  @override
  $ProviderElement<Box<String>> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  Box<String> create(Ref ref) {
    return settingsBox(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(Box<String> value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<Box<String>>(value),
    );
  }
}

String _$settingsBoxHash() => r'50eab7e23f3414e5fdb4f5e7be95ad6b08c04c5e';

@ProviderFor(apiKeyStore)
final apiKeyStoreProvider = ApiKeyStoreProvider._();

final class ApiKeyStoreProvider
    extends $FunctionalProvider<ApiKeyStore, ApiKeyStore, ApiKeyStore>
    with $Provider<ApiKeyStore> {
  ApiKeyStoreProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'apiKeyStoreProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$apiKeyStoreHash();

  @$internal
  @override
  $ProviderElement<ApiKeyStore> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  ApiKeyStore create(Ref ref) {
    return apiKeyStore(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(ApiKeyStore value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<ApiKeyStore>(value),
    );
  }
}

String _$apiKeyStoreHash() => r'770a3ee8b44ad6c05ebd389ef5c9e4535ec1b793';

/// La clé effectivement utilisée : celle saisie dans l'application, sinon
/// celle du build, sinon rien.
///
/// L'ordre compte. Une clé saisie l'emporte sur la clé compilée pour qu'une
/// rotation n'impose pas de reconstruire l'application — c'est la seule façon
/// de réagir vite à une clé fuitée.
///
/// C'est un notifier et non une simple lecture parce que `ApiKeyStore` lit Hive
/// de façon synchrone, sans flux : porter la valeur ici est ce qui fait que le
/// viseur quitte l'écran « clé absente » à l'instant où la saisie est validée.

@ProviderFor(GeminiApiKey)
final geminiApiKeyProvider = GeminiApiKeyProvider._();

/// La clé effectivement utilisée : celle saisie dans l'application, sinon
/// celle du build, sinon rien.
///
/// L'ordre compte. Une clé saisie l'emporte sur la clé compilée pour qu'une
/// rotation n'impose pas de reconstruire l'application — c'est la seule façon
/// de réagir vite à une clé fuitée.
///
/// C'est un notifier et non une simple lecture parce que `ApiKeyStore` lit Hive
/// de façon synchrone, sans flux : porter la valeur ici est ce qui fait que le
/// viseur quitte l'écran « clé absente » à l'instant où la saisie est validée.
final class GeminiApiKeyProvider
    extends $NotifierProvider<GeminiApiKey, String> {
  /// La clé effectivement utilisée : celle saisie dans l'application, sinon
  /// celle du build, sinon rien.
  ///
  /// L'ordre compte. Une clé saisie l'emporte sur la clé compilée pour qu'une
  /// rotation n'impose pas de reconstruire l'application — c'est la seule façon
  /// de réagir vite à une clé fuitée.
  ///
  /// C'est un notifier et non une simple lecture parce que `ApiKeyStore` lit Hive
  /// de façon synchrone, sans flux : porter la valeur ici est ce qui fait que le
  /// viseur quitte l'écran « clé absente » à l'instant où la saisie est validée.
  GeminiApiKeyProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'geminiApiKeyProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$geminiApiKeyHash();

  @$internal
  @override
  GeminiApiKey create() => GeminiApiKey();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(String value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<String>(value),
    );
  }
}

String _$geminiApiKeyHash() => r'87d26926e1ae360fc62a7adc3444fbfd83f35b37';

/// La clé effectivement utilisée : celle saisie dans l'application, sinon
/// celle du build, sinon rien.
///
/// L'ordre compte. Une clé saisie l'emporte sur la clé compilée pour qu'une
/// rotation n'impose pas de reconstruire l'application — c'est la seule façon
/// de réagir vite à une clé fuitée.
///
/// C'est un notifier et non une simple lecture parce que `ApiKeyStore` lit Hive
/// de façon synchrone, sans flux : porter la valeur ici est ce qui fait que le
/// viseur quitte l'écran « clé absente » à l'instant où la saisie est validée.

abstract class _$GeminiApiKey extends $Notifier<String> {
  String build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<String, String>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<String, String>,
              String,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, build);
  }
}

/// Remplacé dans les tests par une implémentation qui rend une photo connue :
/// la galerie du système n'est pas pilotable depuis un test.

@ProviderFor(photoPicker)
final photoPickerProvider = PhotoPickerProvider._();

/// Remplacé dans les tests par une implémentation qui rend une photo connue :
/// la galerie du système n'est pas pilotable depuis un test.

final class PhotoPickerProvider
    extends $FunctionalProvider<PhotoPicker, PhotoPicker, PhotoPicker>
    with $Provider<PhotoPicker> {
  /// Remplacé dans les tests par une implémentation qui rend une photo connue :
  /// la galerie du système n'est pas pilotable depuis un test.
  PhotoPickerProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'photoPickerProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$photoPickerHash();

  @$internal
  @override
  $ProviderElement<PhotoPicker> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  PhotoPicker create(Ref ref) {
    return photoPicker(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(PhotoPicker value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<PhotoPicker>(value),
    );
  }
}

String _$photoPickerHash() => r'6531c2621b68d66d20029cc77c2a3f449ffc5243';

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
    r'5b88b0c25ac3f52c494d7d10f884f5b90a824814';

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
