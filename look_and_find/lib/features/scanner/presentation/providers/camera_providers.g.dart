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

String _$cameraSessionHash() => r'10da0ec298224d76e7fda3f5dc0f28aa431aadc5';

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

/// Ce que ce capteur-ci sait faire, demandé une fois par contrôleur.
///
/// Dérivé de la session plutôt que lu à chaque pincement : `getMaxZoomLevel`
/// est un aller-retour vers la plateforme, et le poser dans un geste qui émet
/// soixante fois par seconde ferait ramer le viseur. Comme le provider suit la
/// session, un changement de caméra ou un retour d'arrière-plan redemande les
/// bornes du nouveau contrôleur au lieu de garder celles du précédent.

@ProviderFor(bornesZoom)
final bornesZoomProvider = BornesZoomProvider._();

/// Ce que ce capteur-ci sait faire, demandé une fois par contrôleur.
///
/// Dérivé de la session plutôt que lu à chaque pincement : `getMaxZoomLevel`
/// est un aller-retour vers la plateforme, et le poser dans un geste qui émet
/// soixante fois par seconde ferait ramer le viseur. Comme le provider suit la
/// session, un changement de caméra ou un retour d'arrière-plan redemande les
/// bornes du nouveau contrôleur au lieu de garder celles du précédent.

final class BornesZoomProvider
    extends
        $FunctionalProvider<
          AsyncValue<BornesZoom>,
          BornesZoom,
          FutureOr<BornesZoom>
        >
    with $FutureModifier<BornesZoom>, $FutureProvider<BornesZoom> {
  /// Ce que ce capteur-ci sait faire, demandé une fois par contrôleur.
  ///
  /// Dérivé de la session plutôt que lu à chaque pincement : `getMaxZoomLevel`
  /// est un aller-retour vers la plateforme, et le poser dans un geste qui émet
  /// soixante fois par seconde ferait ramer le viseur. Comme le provider suit la
  /// session, un changement de caméra ou un retour d'arrière-plan redemande les
  /// bornes du nouveau contrôleur au lieu de garder celles du précédent.
  BornesZoomProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'bornesZoomProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$bornesZoomHash();

  @$internal
  @override
  $FutureProviderElement<BornesZoom> $createElement($ProviderPointer pointer) =>
      $FutureProviderElement(pointer);

  @override
  FutureOr<BornesZoom> create(Ref ref) {
    return bornesZoom(ref);
  }
}

String _$bornesZoomHash() => r'4451fd2c8c06169e45da979b78479cd9d3b2d611';

/// Le grossissement courant de l'aperçu.
///
/// **Pourquoi il se remet à 1× avec la session.** Le zoom vit dans le
/// contrôleur caméra, et celui-ci est libéré à chaque mise en arrière-plan.
/// Au retour, le capteur repart à 1× quoi qu'on ait retenu : garder « 3× »
/// dans l'état afficherait un indicateur qui ment sur ce que montre l'image.
/// Le `watch` ci-dessous fait donc suivre l'état au matériel.
///
/// C'est l'inverse du flash, gardé en vie exprès : le flash est un réglage
/// que l'utilisateur a choisi, le zoom est un cadrage lié à une image qui
/// n'est plus à l'écran.

@ProviderFor(ZoomSetting)
final zoomSettingProvider = ZoomSettingProvider._();

/// Le grossissement courant de l'aperçu.
///
/// **Pourquoi il se remet à 1× avec la session.** Le zoom vit dans le
/// contrôleur caméra, et celui-ci est libéré à chaque mise en arrière-plan.
/// Au retour, le capteur repart à 1× quoi qu'on ait retenu : garder « 3× »
/// dans l'état afficherait un indicateur qui ment sur ce que montre l'image.
/// Le `watch` ci-dessous fait donc suivre l'état au matériel.
///
/// C'est l'inverse du flash, gardé en vie exprès : le flash est un réglage
/// que l'utilisateur a choisi, le zoom est un cadrage lié à une image qui
/// n'est plus à l'écran.
final class ZoomSettingProvider extends $NotifierProvider<ZoomSetting, double> {
  /// Le grossissement courant de l'aperçu.
  ///
  /// **Pourquoi il se remet à 1× avec la session.** Le zoom vit dans le
  /// contrôleur caméra, et celui-ci est libéré à chaque mise en arrière-plan.
  /// Au retour, le capteur repart à 1× quoi qu'on ait retenu : garder « 3× »
  /// dans l'état afficherait un indicateur qui ment sur ce que montre l'image.
  /// Le `watch` ci-dessous fait donc suivre l'état au matériel.
  ///
  /// C'est l'inverse du flash, gardé en vie exprès : le flash est un réglage
  /// que l'utilisateur a choisi, le zoom est un cadrage lié à une image qui
  /// n'est plus à l'écran.
  ZoomSettingProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'zoomSettingProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$zoomSettingHash();

  @$internal
  @override
  ZoomSetting create() => ZoomSetting();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(double value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<double>(value),
    );
  }
}

String _$zoomSettingHash() => r'9b46c44bb4afcf6ab449c836a74e11dd0de4c8e6';

/// Le grossissement courant de l'aperçu.
///
/// **Pourquoi il se remet à 1× avec la session.** Le zoom vit dans le
/// contrôleur caméra, et celui-ci est libéré à chaque mise en arrière-plan.
/// Au retour, le capteur repart à 1× quoi qu'on ait retenu : garder « 3× »
/// dans l'état afficherait un indicateur qui ment sur ce que montre l'image.
/// Le `watch` ci-dessous fait donc suivre l'état au matériel.
///
/// C'est l'inverse du flash, gardé en vie exprès : le flash est un réglage
/// que l'utilisateur a choisi, le zoom est un cadrage lié à une image qui
/// n'est plus à l'écran.

abstract class _$ZoomSetting extends $Notifier<double> {
  double build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<double, double>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<double, double>,
              double,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, build);
  }
}
