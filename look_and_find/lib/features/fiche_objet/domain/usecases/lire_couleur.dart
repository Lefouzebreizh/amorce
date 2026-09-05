/// La couleur dominante, mesurée sur la photo plutôt que demandée au modèle.
///
/// **Pourquoi la mesurer.** Un modèle de langage nomme une couleur avec le même
/// aplomb qu'il nomme un objet, y compris devant une surface bicolore où aucune
/// réponse simple n'est vraie. `color_reader` fait l'inverse : il refuse de
/// nommer une moyenne qui n'existe nulle part et **dit quand il hésite**. Sur un
/// champ que la personne ne peut pas vérifier, l'hésitation dite vaut mieux que
/// l'assurance.
///
/// **Le calcul part dans un isolat**, et ce n'est pas une optimisation : décoder
/// un JPEG de capteur prend quelques centaines de millisecondes, de quoi faire
/// sauter des images juste au moment où la personne attend le retour du
/// déclencheur. Même choix que `ImageCompressor` et `AnalyserPhoto`, pour la
/// même raison — le guide du sous-projet en fait un invariant.
///
/// La frontière de l'isolat est posée sur les octets à l'entrée et sur la
/// lecture à la sortie, tous deux petits : faire traverser des mégaoctets de
/// pixels entre deux fils coûterait ce qu'on cherche à économiser.
library;

import 'package:flutter/foundation.dart';

import '../../../color_reader/domain/entities/color_reading.dart';
import '../../../color_reader/domain/usecases/echantillon_cadre.dart';
import '../../../color_reader/domain/usecases/lecture_cadre.dart';

class LireCouleur {
  const LireCouleur._();

  /// `null` quand la photo n'est pas décodable — l'absence de couleur se dit,
  /// elle ne se remplace pas par une valeur par défaut qui aurait l'air d'une
  /// mesure.
  static Future<ColorReading?> depuisOctets(Uint8List octets) =>
      compute(_lire, octets);
}

ColorReading? _lire(Uint8List octets) {
  final pixels = EchantillonCadre.depuisOctets(octets);
  if (pixels == null) return null;
  return LectureCadre.lire(pixels);
}
