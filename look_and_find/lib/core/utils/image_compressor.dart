/// Réduction de la photo avant l'envoi au modèle.
///
/// Un cliché de capteur moderne pèse 3 à 5 Mo. Sur un réseau mobile ordinaire,
/// c'est cinq à dix secondes d'attente **avant** que l'inférence commence,
/// pour une précision d'identification identique : au-delà de 1024 px de côté,
/// le modèle ne distingue rien de plus sur un meuble ou un appareil. Le
/// redimensionnement est donc le levier de latence le plus rentable du
/// parcours.
///
/// Le travail se fait dans un isolat (`compute`) : décoder puis ré-encoder un
/// JPEG prend quelques centaines de millisecondes, largement de quoi faire
/// sauter des images si on le laisse sur le fil principal — juste au moment où
/// l'utilisateur attend un retour du déclencheur.
///
/// **Et la photo part avec son vrai format.** Quand le décodage échoue, on
/// envoie l'original — c'était déjà le cas — mais on l'annonçait `image/jpeg`
/// quoi qu'il arrive. Un cliché HEIF, format courant sur Android et que
/// `package:image` ne sait pas lire, partait donc étiqueté JPEG : le service le
/// refuse, et le commentaire qui disait « autant laisser le modèle trancher »
/// décrivait l'inverse de ce que le code faisait — on l'empêchait de trancher
/// en lui mentant sur la nature des octets.
library;

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:image/image.dart' as img;

import '../constants/app_config.dart';

class CompressionRequest {
  const CompressionRequest(this.bytes, this.maxWidth, this.quality);

  final Uint8List bytes;
  final int maxWidth;
  final int quality;
}

/// Une photo prête pour `inline_data` : ses octets, et ce qu'ils sont
/// réellement.
class PhotoPreparee {
  const PhotoPreparee(this.base64, this.mimeType);

  final String base64;

  /// `null` quand les octets ne sont d'aucun format que le service accepte.
  /// L'appelant le dit à l'utilisateur plutôt que d'envoyer et d'échouer.
  final String? mimeType;
}

class ImageCompressor {
  const ImageCompressor._();

  /// Les formats d'image que l'API Gemini accepte en `inline_data`.
  static const Set<String> typesAcceptes = {
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  };

  static Future<PhotoPreparee> preparer(Uint8List raw) async {
    final (octets, type) = await compute(
      _resize,
      CompressionRequest(raw, AppConfig.maxImageWidth, AppConfig.imageQuality),
    );
    return PhotoPreparee(base64Encode(octets), type);
  }

  /// Le format lu **dans les octets**, jamais dans le nom du fichier.
  ///
  /// Une extension ment — un « .jpg » d'appareil photo est souvent un HEIF — et
  /// ici il n'y a de toute façon pas de nom : la photo arrive du déclencheur en
  /// mémoire. Seuls les octets de tête tranchent.
  static String? typeMimeDe(Uint8List octets) {
    bool debutePar(List<int> motif, [int decalage = 0]) {
      if (octets.length < decalage + motif.length) return false;
      for (var i = 0; i < motif.length; i++) {
        if (octets[decalage + i] != motif[i]) return false;
      }
      return true;
    }

    if (debutePar([0xFF, 0xD8, 0xFF])) return 'image/jpeg';
    if (debutePar([0x89, 0x50, 0x4E, 0x47])) return 'image/png';
    if (debutePar([0x52, 0x49, 0x46, 0x46]) &&
        debutePar([0x57, 0x45, 0x42, 0x50], 8)) {
      return 'image/webp';
    }
    // HEIF et HEIC partagent le conteneur ISO-BMFF : « ftyp » en quatrième
    // octet, puis la marque de la variante. On ne les distingue pas — le
    // service accepte les deux, et se tromper de nom serait plus faux que de
    // rendre celui de la famille.
    if (debutePar([0x66, 0x74, 0x79, 0x70], 4)) {
      final marque = String.fromCharCodes(octets.sublist(8, 12));
      const familleHeif = {
        'heic',
        'heix',
        'hevc',
        'heim',
        'heis',
        'hevm',
        'hevs',
        'mif1',
        'msf1',
      };
      if (familleHeif.contains(marque)) return 'image/heic';
    }
    return null;
  }
}

/// Fonction de haut niveau : `compute` ne sait pas transporter une fermeture.
(Uint8List, String?) _resize(CompressionRequest request) {
  final img.Image? decoded;
  try {
    decoded = img.decodeImage(request.bytes);
  } catch (_) {
    // `decodeImage` ne se contente pas de rendre `null` sur des octets qui ne
    // sont pas une image : il essaie chaque décodeur, et certains lisent
    // au-delà de la fin d'un tampon trop court avant d'avoir pu conclure.
    return (request.bytes, ImageCompressor.typeMimeDe(request.bytes));
  }

  // Format que nous ne savons pas ré-encoder : on envoie l'original, et cette
  // fois on l'annonce pour ce qu'il est. Le service accepte HEIF et WebP ;
  // c'est l'étiquette fausse qui le faisait refuser, pas le format.
  if (decoded == null) {
    return (request.bytes, ImageCompressor.typeMimeDe(request.bytes));
  }

  final source = decoded.width <= request.maxWidth
      ? decoded
      : img.copyResize(
          decoded,
          width: request.maxWidth,
          interpolation: img.Interpolation.average,
        );

  return (img.encodeJpg(source, quality: request.quality), 'image/jpeg');
}
