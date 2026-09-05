/// La chaîne complète, d'une photo prise à sa palette.
///
/// **Tout le calcul part dans un isolat**, et ce n'est pas une optimisation :
/// décoder un JPEG de capteur prend quelques centaines de millisecondes, de
/// quoi faire sauter des images juste au moment où la personne attend le retour
/// du déclencheur. C'est le même choix que `ImageCompressor`, pour la même
/// raison, et le guide du sous-projet en fait un invariant.
///
/// Le découpage du cadre est dedans lui aussi. Le sortir de l'isolat aurait
/// obligé à décoder l'image deux fois, ou à faire traverser des mégaoctets de
/// pixels entre deux fils — la frontière est donc posée sur les octets bruts à
/// l'entrée et sur le résultat à la sortie, les deux petits.
library;

import 'package:flutter/foundation.dart';

import '../../../color_reader/domain/usecases/echantillon_cadre.dart';
import '../entities/resultat_accord.dart';
import 'build_harmonies.dart';
import 'judge_photo.dart';

class AnalyserPhoto {
  const AnalyserPhoto._();

  static Future<ResultatAccord> depuisOctets(Uint8List octets) =>
      compute(_analyser, octets);
}

/// Fonction de haut niveau : `compute` ne sait pas transporter une fermeture.
ResultatAccord _analyser(Uint8List octets) {
  final pixels = EchantillonCadre.depuisOctets(octets);
  if (pixels == null) return const ResultatAccord.panne();

  final verdict = JudgePhoto.juger(pixels);
  if (!verdict.estAcceptee) return ResultatAccord.juge(verdict, const []);

  return ResultatAccord.juge(
    verdict,
    BuildHarmonies.pour(verdict.rouge, verdict.vert, verdict.bleu),
  );
}
