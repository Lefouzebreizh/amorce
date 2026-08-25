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

class ImageCompressor {
  const ImageCompressor._();

  /// Renvoie la photo en base64, prête pour `inline_data`.
  static Future<String> toBase64Jpeg(Uint8List raw) async {
    final compressed = await compute(
      _resize,
      CompressionRequest(raw, AppConfig.maxImageWidth, AppConfig.imageQuality),
    );
    return base64Encode(compressed);
  }
}

/// Fonction de haut niveau : `compute` ne sait pas transporter une fermeture.
Uint8List _resize(CompressionRequest request) {
  final decoded = img.decodeImage(request.bytes);
  // Format non reconnu : on renvoie l'original plutôt que d'échouer. Gemini
  // accepte les formats courants, autant le laisser trancher.
  if (decoded == null) return request.bytes;

  final source = decoded.width <= request.maxWidth
      ? decoded
      : img.copyResize(
          decoded,
          width: request.maxWidth,
          interpolation: img.Interpolation.average,
        );

  return img.encodeJpg(source, quality: request.quality);
}
