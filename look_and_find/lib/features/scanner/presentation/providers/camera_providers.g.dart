// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'camera_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(CameraSession)
final cameraSessionProvider = CameraSessionProvider._();

final class CameraSessionProvider
    extends $AsyncNotifierProvider<CameraSession, CameraController> {
  CameraSessionProvider._()
    : super(
        from: null,
        argument: null,
        retry: _pasDeRepriseAutomatique,
        name: r'cameraSessionProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$cameraSessionHash();

  @$internal
  @override
  CameraSession create() => CameraSession();
}

String _$cameraSessionHash() => r'a449611ab05e39e5bb68eae76e0ca9afefb0bb2b';

abstract class _$CameraSession extends $AsyncNotifier<CameraController> {
  FutureOr<CameraController> build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref =
        this.ref as $Ref<AsyncValue<CameraController>, CameraController>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AsyncValue<CameraController>, CameraController>,
              AsyncValue<CameraController>,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, build);
  }
}

/// Le flash est un réglage de l'utilisateur, pas un état de la caméra : il doit
/// survivre à la reconstruction du contrôleur (retour d'arrière-plan), sinon
/// il se remet tout seul sur « éteint » à chaque va-et-vient.

@ProviderFor(FlashSetting)
final flashSettingProvider = FlashSettingProvider._();

/// Le flash est un réglage de l'utilisateur, pas un état de la caméra : il doit
/// survivre à la reconstruction du contrôleur (retour d'arrière-plan), sinon
/// il se remet tout seul sur « éteint » à chaque va-et-vient.
final class FlashSettingProvider
    extends $NotifierProvider<FlashSetting, FlashMode> {
  /// Le flash est un réglage de l'utilisateur, pas un état de la caméra : il doit
  /// survivre à la reconstruction du contrôleur (retour d'arrière-plan), sinon
  /// il se remet tout seul sur « éteint » à chaque va-et-vient.
  FlashSettingProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'flashSettingProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$flashSettingHash();

  @$internal
  @override
  FlashSetting create() => FlashSetting();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(FlashMode value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<FlashMode>(value),
    );
  }
}

String _$flashSettingHash() => r'16b90b7eb735acf940d5f5833de6bf9e3f77ba64';

/// Le flash est un réglage de l'utilisateur, pas un état de la caméra : il doit
/// survivre à la reconstruction du contrôleur (retour d'arrière-plan), sinon
/// il se remet tout seul sur « éteint » à chaque va-et-vient.

abstract class _$FlashSetting extends $Notifier<FlashMode> {
  FlashMode build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<FlashMode, FlashMode>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<FlashMode, FlashMode>,
              FlashMode,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, build);
  }
}
