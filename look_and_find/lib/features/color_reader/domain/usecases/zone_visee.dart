/// Le cadre que la personne vise, et que la porte juge — pas la photo entière.
///
/// **Pourquoi ce fichier existe.** Quarante-sept photos réelles ont montré que
/// la porte accepte des scènes entières : une salle informatique avec des seaux
/// au sol, un salon où quelqu'un boit, une boutique de fleurs. Trois seuils ont
/// été essayés pour l'en empêcher — part dominante, dispersion des teintes,
/// contiguïté — et les trois échouent de la même façon.
///
/// La raison n'est pas un réglage manqué. Sur ces photos, il y a **vraiment**
/// une grande surface unie dans le cadre : un mur de bureau, un canapé beige.
/// Le calcul ne se trompe pas sur les pixels, il rend bien la couleur de la
/// plus grande surface présente. Une photo de mur et une photo de pièce
/// contenant un mur sont statistiquement la même chose ; ce qui les distingue
/// est **l'intention de celui qui cadre**, et elle n'est dans aucun pixel.
///
/// Donc on cesse de la deviner, et on la demande : le viseur porte un cadre,
/// la personne met sa surface dedans, et la porte ne juge que ce cadre.
library;

class ZoneVisee {
  const ZoneVisee._();

  /// Le côté du cadre, en part du petit côté de l'image.
  ///
  /// **Ce chiffre est mesuré, pas choisi.** Sur les quarante-sept photos du
  /// corpus, réduire le cadre rend la porte permissive : plus la zone est
  /// petite, plus ce qu'elle contient paraît uni, et plus la porte dit oui.
  ///
  /// | Côté du cadre | Photos acceptées sur 47 |
  /// | --- | --- |
  /// | carré plein | 9 |
  /// | 0,60 | **8** |
  /// | 0,40 | 15 |
  /// | 0,25 | 17 |
  ///
  /// À 0,60 la porte filtre encore comme sur le carré plein, et le cadre reste
  /// assez large pour qu'on y pose un mur sans coller le téléphone dessus. En
  /// dessous de 0,40 elle cesse de protéger : elle accepterait deux photos sur
  /// cinq prises au hasard, et ce n'est plus une porte.
  static const double partParDefaut = 0.60;

  /// Le carré à découper : sa position et son côté, en pixels.
  ///
  /// Exposé parce que deux appelants en ont besoin et qu'ils ne doivent pas
  /// le recalculer chacun de son côté : celui qui découpe une liste de pixels
  /// (`extraire`) et celui qui découpe une photo décodée avant de la réduire.
  /// Deux copies d'un même calcul finissent par diverger — ce projet en a déjà
  /// payé une, une saturation TSV traitée comme une saturation TSL.
  static (int, int, int) cadre(int largeur, int hauteur, [double part = partParDefaut]) {
    final petitCote = largeur < hauteur ? largeur : hauteur;
    // Au moins un pixel : une part minuscule sur une petite image donnerait un
    // cadre vide, et la porte rendrait « trop sombre » pour une image correcte.
    final cote = (petitCote * part).round().clamp(1, petitCote);
    return ((largeur - cote) ~/ 2, (hauteur - cote) ~/ 2, cote);
  }

  /// Les pixels du carré centré, dans l'ordre des lignes.
  ///
  /// Le cadre est **carré** et non au format de l'image : un mur se vise de
  /// face, et un rectangle allongé rattrape du plafond ou du sol sur son grand
  /// côté — exactement les surfaces de plus qu'on cherche à exclure.
  static List<(int, int, int)> extraire(
    List<(int, int, int)> image, {
    required int largeur,
    required int hauteur,
    double part = partParDefaut,
  }) {
    if (largeur <= 0 || hauteur <= 0) {
      throw ArgumentError('Une image a deux côtés non nuls.');
    }
    if (image.length != largeur * hauteur) {
      throw ArgumentError(
        'Image de ${image.length} pixels annoncée $largeur × $hauteur.',
      );
    }
    if (part <= 0 || part > 1) {
      throw ArgumentError('La part du cadre se tient dans ]0, 1].');
    }

    final (gauche, haut, cote) = cadre(largeur, hauteur, part);

    final zone = <(int, int, int)>[];
    for (var y = haut; y < haut + cote; y++) {
      final debut = y * largeur;
      zone.addAll(image.getRange(debut + gauche, debut + gauche + cote));
    }
    return zone;
  }
}
