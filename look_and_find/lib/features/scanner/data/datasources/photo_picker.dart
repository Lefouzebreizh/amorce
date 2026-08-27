/// Choisir une photo déjà prise, plutôt que d'en prendre une.
///
/// **Pourquoi cette porte d'entrée existe.** Le viseur suppose trois choses
/// réunies : l'objet devant soi, une lumière correcte, et une caméra qui
/// s'ouvre. Il suffit qu'une seule manque — un meuble vu en magasin la semaine
/// dernière, une pièce sombre, un accès refusé — pour que l'application ne
/// serve plus à rien alors que la photo, elle, existe déjà.
///
/// C'est une **abstraction d'un seul appel**, ce que ce dépôt évite en général.
/// Elle se justifie ici par une raison précise : `ImagePicker` ouvre une
/// activité du système, impossible à piloter depuis un test. Sans cette
/// couture, tout le parcours « photo choisie → identification » resterait non
/// vérifié.
library;

import 'dart:typed_data';

import 'package:image_picker/image_picker.dart';

class PickedPhoto {
  const PickedPhoto({required this.bytes, required this.path});

  final Uint8List bytes;
  final String path;
}

abstract interface class PhotoPicker {
  /// `null` si l'utilisateur ressort sans rien choisir — un abandon est un
  /// geste normal, pas un échec à signaler.
  Future<PickedPhoto?> pick();
}

class GalleryPhotoPicker implements PhotoPicker {
  const GalleryPhotoPicker();

  @override
  Future<PickedPhoto?> pick() async {
    // La réduction demandée ici est un premier dégrossissage : sur un cliché
    // de 12 Mpx, décoder l'original en mémoire pour le redimensionner ensuite
    // suffit à faire tomber l'application sur un téléphone modeste.
    // `ImageCompressor` fera la mise à la taille finale.
    final fichier = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      maxWidth: 2048,
      imageQuality: 92,
      // Sans les métadonnées, iOS n'a aucune permission à demander : le
      // sélecteur du système rend le fichier choisi, et rien d'autre. On n'a
      // besoin que des pixels — ni de la position GPS, ni de la date de prise
      // de vue. La clé `NSPhotoLibraryUsageDescription` reste exigée par la
      // politique de l'App Store, même quand rien n'est demandé.
      requestFullMetadata: false,
    );
    if (fichier == null) return null;

    return PickedPhoto(bytes: await fichier.readAsBytes(), path: fichier.path);
  }
}
