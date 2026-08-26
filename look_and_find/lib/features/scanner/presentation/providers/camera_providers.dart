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
