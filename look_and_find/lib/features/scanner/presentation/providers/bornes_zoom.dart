/// Ce que le capteur autorise comme zoom, et le calcul qui s'y tient.
///
/// **Pourquoi une classe plutôt que deux `double` promenés.** Le pincement
/// arrive en facteur relatif (« les doigts se sont écartés de 1,8 fois depuis
/// le premier contact »), pas en niveau absolu. La conversion doit donc partir
/// du niveau au début du geste, multiplier, puis borner — et si l'une de ces
/// trois étapes manque, le zoom saute ou `setZoomLevel` lève. Le calcul tient
/// ici, testable sans capteur, plutôt que dans un `onScaleUpdate`.
///
/// **Pourquoi aucun plafond de notre part.** Au-delà d'un certain grossissement
/// le zoom devient numérique et la photo se dégrade, mais le maximum annoncé
/// couvre aussi les téléobjectifs réels des appareils qui en ont un. Un plafond
/// arbitraire priverait ces appareils de leur meilleur objectif pour protéger
/// les autres d'une photo floue qu'ils peuvent juger eux-mêmes à l'écran.
library;

class BornesZoom {
  const BornesZoom({required this.min, required this.max});

  /// Ce qu'on affiche tant que le capteur n'a pas répondu, et ce que renvoie
  /// un appareil sans zoom : un intervalle d'un seul point, où [borner]
  /// ramène tout à 1 et où [possible] est faux.
  static const BornesZoom neutre = BornesZoom(min: 1, max: 1);

  /// Les valeurs viennent du pilote et ne sont pas toujours cohérentes :
  /// certains appareils annoncent un maximum inférieur au minimum, ou un
  /// minimum nul. Une borne inversée ferait lever `clamp`, donc l'intervalle
  /// est remis à l'endroit ici, une fois, à la lecture du capteur.
  factory BornesZoom.duCapteur({required double min, required double max}) {
    final plancher = min.isFinite && min > 0 ? min : 1.0;
    final plafond = max.isFinite && max > plancher ? max : plancher;
    return BornesZoom(min: plancher, max: plafond);
  }

  final double min;
  final double max;

  /// Faux quand le capteur ne sait pas zoomer : l'écran n'affiche alors aucun
  /// indicateur, plutôt qu'un « 1× » qui ne bougera jamais.
  bool get possible => max > min;

  double borner(double niveau) =>
      niveau.isFinite ? niveau.clamp(min, max) : min;

  /// Le niveau visé par un pincement : [depart] est le zoom au premier
  /// contact des deux doigts, [facteur] leur écartement relatif depuis.
  double pincement(double depart, double facteur) =>
      facteur.isFinite && facteur > 0 ? borner(depart * facteur) : borner(depart);
}
