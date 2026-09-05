/// De la photo prise à l'échantillon que la porte sait juger.
///
/// **Ce fichier est un passage, et les passages sont là où les défauts se
/// cachent.** Rien de ce qu'il fait n'est visible : il décode, découpe,
/// réduit. Une erreur ici ne lève aucune exception et ne casse aucun test de
/// la porte — elle rend simplement une couleur fausse, plausible, sur laquelle
/// tout le reste s'appuie. Ce projet a déjà payé exactement cela une fois, avec
/// une saturation TSV traitée comme une saturation TSL : la couleur restait
/// crédible, seul un test de borne l'a attrapée.
///
/// **Pourquoi ici et non chez Accord, d'où il vient.** Ce passage n'a rien qui
/// appartienne à Accord : il découpe le cadre visé et rend ses pixels, ce dont
/// a besoin quiconque veut nommer une couleur. Le laisser dans `accord/data/`
/// le rendait inatteignable — la règle de dépendance interdit d'importer le
/// `data` d'une autre fonctionnalité — et la seule issue aurait été d'en
/// recopier le découpage ailleurs, ce que ce fichier passe justement son
/// en-tête à déconseiller. `color_reader` est la brique partagée : il n'importe
/// personne, et les deux appelants viennent à lui.
///
/// Il vit dans le `domain` bien qu'il décode une image, parce qu'il ne touche
/// ni au réseau, ni au disque, ni à Flutter : des octets entrent, des pixels
/// sortent. C'est ce qui le laisse atteignable depuis le `domain` d'Accord.
///
/// D'où deux décisions.
///
/// *Le cadre n'est pas recalculé ici* : il vient de `ZoneVisee.cadre()`, la
/// même source que le découpage sur une liste de pixels. Deux copies d'un même
/// calcul finissent par diverger.
///
/// *La réduction se fait par moyenne d'aire*, pas par échantillonnage au plus
/// proche. Sur un mur, le plus proche voisin retiendrait un pixel de bruit du
/// capteur là où la moyenne rend la couleur de la surface — et c'est la
/// couleur de la surface qu'on cherche.
library;

import 'dart:typed_data';

import 'package:image/image.dart' as img;

import 'zone_visee.dart';

class EchantillonCadre {
  const EchantillonCadre._();

  /// Le côté de l'échantillon rendu, en pixels.
  ///
  /// Quarante par quarante, soit mille six cents pixels. C'est la taille sur
  /// laquelle tous les seuils de la porte ont été réglés, sur quarante-sept
  /// photos réelles ; la changer déplacerait les mesures sans que rien ne le
  /// signale.
  static const int cote = 40;

  /// Les pixels du cadre de visée, réduits en [cote] × [cote].
  ///
  /// Rend `null` si les octets ne sont pas une image décodable — l'appelant
  /// décide quoi en dire, ce n'est pas un refus d'Accord mais une panne.
  static List<(int, int, int)>? depuisOctets(
    Uint8List octets, {
    double part = ZoneVisee.partParDefaut,
  }) {
    // `decodeImage` ne rend pas toujours `null` sur des octets qui ne sont pas
    // une image : il essaie chaque décodeur, et celui du PSD lit au-delà de la
    // fin d'un tampon trop court avant d'avoir pu conclure — il lève alors un
    // `RangeError`. Sans cette garde, une photo tronquée ne coûte pas la
    // couleur, elle fait échouer tout ce qui l'appelle.
    final img.Image? image;
    try {
      image = img.decodeImage(octets);
    } catch (_) {
      return null;
    }
    if (image == null) return null;
    return depuisImage(image, part: part);
  }

  /// Le même travail sur une image déjà décodée.
  static List<(int, int, int)> depuisImage(
    img.Image image, {
    double part = ZoneVisee.partParDefaut,
  }) {
    final (gauche, haut, cadre) =
        ZoneVisee.cadre(image.width, image.height, part);

    final zone = img.copyCrop(
      image,
      x: gauche,
      y: haut,
      width: cadre,
      height: cadre,
    );
    final reduite = img.copyResize(
      zone,
      width: cote,
      height: cote,
      interpolation: img.Interpolation.average,
    );

    final pixels = <(int, int, int)>[];
    for (var y = 0; y < cote; y++) {
      for (var x = 0; x < cote; x++) {
        final p = reduite.getPixel(x, y);
        pixels.add((
          p.r.round().clamp(0, 255),
          p.g.round().clamp(0, 255),
          p.b.round().clamp(0, 255),
        ));
      }
    }
    return pixels;
  }
}
