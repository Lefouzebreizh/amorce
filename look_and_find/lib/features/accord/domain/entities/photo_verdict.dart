/// Ce qu'Accord répond quand on lui soumet une photo d'intérieur.
///
/// **Refuser fait partie du produit.** Sur dix photos d'intérieur prises pour
/// de vrai, cinq étaient inexploitables : contre-jour, surface trop sombre,
/// dominante parasite venue d'une bâche verte au fond du jardin. Une palette
/// calculée sur l'une de ces cinq n'est pas approximative, elle est fausse — et
/// quelqu'un qui achète un coussin sur cette foi paie l'erreur.
///
/// Le refus porte donc toujours deux choses : **ce qui ne va pas**, et **ce
/// qu'il faut faire**. Un refus sans geste à poser derrière est une impasse ;
/// la personne réessaie la même photo et obtient le même refus.
library;

/// Pourquoi une photo ne permet pas de calculer une harmonie.
enum PhotoRefus {
  contreJour(
    'La lumière vient de derrière le mur',
    'Tournez-vous pour avoir la fenêtre dans le dos.',
  ),
  surexposee(
    'La surface est brûlée par la lumière',
    'Éloignez-vous de la source, ou photographiez une zone à l\'ombre.',
  ),
  tropSombre(
    'La surface est trop sombre pour montrer sa couleur',
    'Rapprochez-vous d\'une fenêtre, ou allumez la pièce.',
  ),
  plusieursSurfaces(
    'Le cadre contient plusieurs surfaces',
    'Cadrez uniquement le mur, le canapé ou le sol — une surface à la fois.',
  ),
  surfaceDelavee(
    'La surface est presque grise',
    'Un gris s\'accorde avec tout : choisissez une surface qui a une couleur.',
  );

  const PhotoRefus(this.raison, this.conseil);

  /// Ce qui ne va pas, dit sans jargon.
  final String raison;

  /// Le geste à poser pour que la prochaine photo passe.
  final String conseil;
}

/// Le verdict de la porte d'entrée d'Accord.
class PhotoVerdict {
  const PhotoVerdict.acceptee(this.rouge, this.vert, this.bleu) : refus = null;

  const PhotoVerdict.refusee(PhotoRefus this.refus)
      : rouge = 0,
        vert = 0,
        bleu = 0;

  /// La couleur dominante retenue, quand la photo est acceptée.
  final int rouge;
  final int vert;
  final int bleu;

  final PhotoRefus? refus;

  bool get estAcceptee => refus == null;

  /// Le code hexadécimal de la dominante, en majuscules, prêt à afficher.
  String get hexadecimal =>
      '#${_deuxChiffres(rouge)}${_deuxChiffres(vert)}${_deuxChiffres(bleu)}';

  static String _deuxChiffres(int v) =>
      v.toRadixString(16).padLeft(2, '0').toUpperCase();

  @override
  String toString() =>
      estAcceptee ? hexadecimal : '${refus!.raison} — ${refus!.conseil}';
}
