/// Le cycle de vie de l'appareil photo.
///
/// **Pourquoi un notifier plutôt qu'un `initState`.** Sur Android, la caméra
/// est une ressource exclusive : si l'application passe en arrière-plan sans
/// la libérer, une autre application ne peut plus l'ouvrir, et au retour c'est
/// nous qui échouons. Le flux est donc explicite — libérer à la mise en pause,
/// reconstruire à la reprise — et il vit ici, pas dans un widget qu'on pourrait
/// oublier de reconstruire.
///
/// L'aperçu est en `veryHigh` et non au maximum du capteur : la photo est de
/// toute façon ramenée à 1024 px avant l'envoi, et une prévisualisation en
/// pleine résolution chauffe le téléphone pour un gain d'identification nul.
library;

import 'package:camera/camera.dart';
import 'package:flutter/widgets.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../../core/network/app_exception.dart';
import '../../../../core/utils/extensions.dart';
import 'bornes_zoom.dart';

part 'camera_providers.g.dart';

/// Aucune reprise automatique.
///
/// Riverpod réessaie par défaut un provider en échec, en doublant l'attente.
/// C'est le bon comportement pour un appel réseau ; c'est le mauvais ici. Un
/// accès caméra refusé ne se débloque pas tout seul : il demande un geste dans
/// les réglages du téléphone. Réessayer en boucle réveille le capteur pour
/// rien, et — plus grave — laisse l'état en « chargement » indéfiniment, si
/// bien que l'utilisateur n'apprend jamais ce qui bloque.
///
/// La reprise reste possible, mais explicite : c'est le bouton « Réessayer ».
Duration? _pasDeRepriseAutomatique(int _, Object _) => null;

@Riverpod(retry: _pasDeRepriseAutomatique)
class CameraSession extends _$CameraSession {
  @override
  Future<CameraController> build() async {
    final cameras = await _discover();

    // L'objectif arrière par défaut : on photographie un objet posé devant
    // soi, pas son propre visage.
    final lens =
        cameras.firstWhereOrNull(
          (c) => c.lensDirection == CameraLensDirection.back,
        ) ??
        cameras.first;

    final controller = CameraController(
      lens,
      ResolutionPreset.veryHigh,
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.jpeg,
    );

    try {
      await controller.initialize();
      await controller.setFlashMode(FlashMode.off);
    } on CameraException catch (error) {
      await controller.dispose();
      throw _translate(error);
    }

    ref.onDispose(controller.dispose);
    return controller;
  }

  Future<List<CameraDescription>> _discover() async {
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        throw const CameraUnavailableException(
          'Aucun appareil photo disponible sur cet appareil.',
        );
      }
      return cameras;
    } on CameraException catch (error) {
      throw _translate(error);
    }
  }

  CameraUnavailableException _translate(CameraException error) =>
      switch (error.code) {
        'CameraAccessDenied' ||
        'CameraAccessDeniedWithoutPrompt' ||
        'CameraAccessRestricted' => const CameraUnavailableException(
          'L\'accès à l\'appareil photo a été refusé. Autorisez-le dans les '
          'réglages du téléphone pour identifier un objet.',
        ),
        _ => CameraUnavailableException(
          error.description ?? 'L\'appareil photo n\'a pas pu démarrer.',
        ),
      };

  /// Reconstruction complète : après un refus d'accès levé dans les réglages,
  /// ou après une caméra reprise par une autre application. C'est aussi ce que
  /// fait l'écran au retour d'arrière-plan, en invalidant ce provider.
  void restart() => ref.invalidateSelf();

  /// Mise au point sur le point touché. `setFocusPoint` est refusé par
  /// certains capteurs : l'échec est avalé, faute de quoi toucher l'aperçu
  /// ferait remonter une erreur là où il ne se passe simplement rien.
  Future<void> focusAt(Offset normalized) async {
    final controller = state.value;
    if (controller == null || !controller.value.isInitialized) return;
    try {
      await controller.setFocusPoint(normalized);
      await controller.setExposurePoint(normalized);
      await controller.setFocusMode(FocusMode.auto);
    } on CameraException catch (error) {
      debugPrint('mise au point ignorée : ${error.code}');
    }
  }

  Future<void> applyFlash(FlashMode mode) async {
    final controller = state.value;
    if (controller == null || !controller.value.isInitialized) return;
    try {
      await controller.setFlashMode(mode);
    } on CameraException catch (error) {
      debugPrint('flash indisponible : ${error.code}');
    }
  }

  /// Applique un niveau de zoom déjà borné par [BornesZoom]. L'échec est
  /// avalé comme celui de la mise au point : un capteur qui refuse le zoom
  /// doit laisser le viseur utilisable, pas remonter une erreur au milieu
  /// d'un pincement.
  Future<void> applyZoom(double level) async {
    final controller = state.value;
    if (controller == null || !controller.value.isInitialized) return;
    try {
      await controller.setZoomLevel(level);
    } on CameraException catch (error) {
      debugPrint('zoom refusé : ${error.code}');
    }
  }

  /// `null` si la capture échoue : l'appelant réaffiche simplement le viseur.
  Future<XFile?> capture() async {
    final controller = state.value;
    if (controller == null ||
        !controller.value.isInitialized ||
        controller.value.isTakingPicture) {
      return null;
    }
    try {
      return await controller.takePicture();
    } on CameraException catch (error) {
      debugPrint('capture échouée : ${error.code}');
      return null;
    }
  }
}

/// Le flash est un réglage de l'utilisateur, pas un état de la caméra : il doit
/// survivre à la reconstruction du contrôleur (retour d'arrière-plan), sinon
/// il se remet tout seul sur « éteint » à chaque va-et-vient.
@Riverpod(keepAlive: true)
class FlashSetting extends _$FlashSetting {
  @override
  FlashMode build() => FlashMode.off;

  /// Trois positions seulement — auto, forcé, éteint. `torch` éclaire en
  /// continu, vide la batterie et n'améliore pas une photo d'objet.
  Future<void> cycle() async {
    state = switch (state) {
      FlashMode.off => FlashMode.auto,
      FlashMode.auto => FlashMode.always,
      _ => FlashMode.off,
    };
    await ref.read(cameraSessionProvider.notifier).applyFlash(state);
  }
}

/// Ce que ce capteur-ci sait faire, demandé une fois par contrôleur.
///
/// Dérivé de la session plutôt que lu à chaque pincement : `getMaxZoomLevel`
/// est un aller-retour vers la plateforme, et le poser dans un geste qui émet
/// soixante fois par seconde ferait ramer le viseur. Comme le provider suit la
/// session, un changement de caméra ou un retour d'arrière-plan redemande les
/// bornes du nouveau contrôleur au lieu de garder celles du précédent.
@riverpod
Future<BornesZoom> bornesZoom(Ref ref) async {
  final controller = await ref.watch(cameraSessionProvider.future);
  try {
    return BornesZoom.duCapteur(
      min: await controller.getMinZoomLevel(),
      max: await controller.getMaxZoomLevel(),
    );
  } on CameraException catch (error) {
    // Un capteur qui ne sait pas répondre est un capteur sans zoom : le
    // viseur reste utilisable, simplement sans indicateur ni pincement.
    debugPrint('bornes de zoom indisponibles : ${error.code}');
    return BornesZoom.neutre;
  }
}

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
@riverpod
class ZoomSetting extends _$ZoomSetting {
  @override
  double build() {
    ref.watch(cameraSessionProvider);
    return 1;
  }

  /// Pendant un pincement : [depart] est le zoom au premier contact des deux
  /// doigts, [facteur] leur écartement relatif depuis ce contact.
  Future<void> pincer({required double depart, required double facteur}) =>
      _appliquer(_bornes.pincement(depart, facteur));

  BornesZoom get _bornes =>
      ref.read(bornesZoomProvider).value ?? BornesZoom.neutre;

  Future<void> _appliquer(double niveau) async {
    if (niveau == state) return;
    state = niveau;
    await ref.read(cameraSessionProvider.notifier).applyZoom(niveau);
  }
}
