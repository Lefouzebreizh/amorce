/// Nommer la couleur d'un point, en français, et dire quand on hésite.
///
/// **Pourquoi pas la plus proche d'une table de couleurs.** La tentation est de
/// garder quarante couleurs de référence et de rendre celle dont la distance
/// rouge-vert-bleu est la plus courte. Cette distance ne correspond à rien de
/// ce que l'œil perçoit : elle sépare deux verts voisins autant qu'un vert d'un
/// violet, et elle ne sait pas dire qu'elle a hésité. On passe donc en
/// teinte-saturation-luminosité, où chacune des trois questions que se pose
/// quelqu'un — quelle couleur, est-elle vive, est-elle claire — devient un axe.
///
/// **Pourquoi quarante noms et pas deux cents.** « Bleu pétrole » impressionne
/// et n'aide personne. Le vocabulaire est celui qu'on emploie devant un
/// vêtement ou un mur, pas celui d'un nuancier.
///
/// **Les noms vivent ici**, à côté de la règle qui les choisit, comme
/// `ProductCategory` porte ses libellés dans son entité. Les séparer dans les
/// textes d'interface mettrait la logique et son vocabulaire dans deux fichiers
/// que rien ne relie, et un nom ajouté d'un seul côté disparaîtrait en silence.
library;

import '../entities/color_reading.dart';

class NameColor {
  const NameColor._();

  /// Bandes de teinte, en degrés : **borne haute** de chacune, exclue. La roue
  /// commence et finit sur le rouge, qui la referme au-delà de la dernière
  /// borne — c'est la seule famille à occuper les deux extrémités.
  static const List<(double, String)> _bandes = [
    (15, 'rouge'),
    (45, 'orange'),
    (70, 'jaune'),
    (155, 'vert'),
    (185, 'turquoise'),
    (195, 'cyan'),
    (250, 'bleu'),
    (290, 'violet'),
    (330, 'magenta'),
    (348, 'rose'),
  ];

  /// Écart, en degrés, sous lequel on considère être **sur** une frontière et
  /// où l'on nomme les deux voisines. Six degrés représentent environ deux
  /// points sur 255 dans un canal : c'est l'ordre de grandeur de ce qu'un
  /// capteur de téléphone fait varier d'une photo à l'autre sur la même scène.
  static const double _marge = 6;

  /// Nomme la couleur d'un point. Les composantes vont de 0 à 255.
  static ColorReading of(int r, int g, int b) {
    final (teinte, saturation, luminosite) = _tsl(r, g, b);

    // 1. Les extrêmes de luminosité l'emportent sur tout : un point presque
    //    noir n'a pas de teinte utile, même si le calcul en trouve une.
    if (luminosite < 0.07) return const ColorReading('noir');
    if (luminosite > 0.96) return const ColorReading('blanc');

    // 2. Les gris. Le seuil de saturation n'est pas net — c'est justement la
    //    zone où un beige et un blanc se confondent — d'où la bande de doute
    //    juste au-dessus, traitée en 4.
    //
    //    Il monte fortement dans les tons sombres : sur un anthracite
    //    (41, 44, 51), dix points d'écart entre canaux suffisent à porter la
    //    saturation à 0,20, alors que personne n'y voit du bleu. Plus une
    //    couleur est sombre, plus il lui faut de saturation pour mériter un
    //    nom de teinte.
    final seuilGris = luminosite < 0.25 ? 0.38 : 0.08;
    if (saturation < seuilGris) {
      return ColorReading(_gris(luminosite));
    }

    final (nom, voisin) = _nommerTeinte(teinte, saturation, luminosite);

    // 3. Le cas de l'ampoule chaude, et c'est le plus fréquent en intérieur.
    //    Un blanc éclairé par une lampe incandescente ressort ocre et peu
    //    saturé. Impossible à trancher depuis un seul point — alors on le dit,
    //    au lieu d'affirmer « beige » devant un mur blanc.
    //
    //    Examiné **avant** le doute sur les gris : un blanc cassé passe les
    //    deux, et de ces deux explications c'est la lumière qui aide, parce
    //    qu'elle dit quoi faire — se rapprocher d'une fenêtre.
    if (teinte >= 20 && teinte <= 65 && saturation < 0.35 && luminosite > 0.62) {
      return ColorReading(
        nom,
        alternative: 'blanc',
        nuance: 'sous lumière chaude',
      );
    }

    // 4. Peu saturé sans être gris : la couleur existe mais reste discutable.
    if (saturation < 0.14) {
      return ColorReading(nom, alternative: _gris(luminosite));
    }

    return voisin == null ? ColorReading(nom) : ColorReading(nom, alternative: voisin);
  }

  static String _gris(double luminosite) {
    if (luminosite < 0.22) return 'noir';
    if (luminosite < 0.42) return 'gris foncé';
    if (luminosite < 0.62) return 'gris';
    if (luminosite < 0.85) return 'gris clair';
    return 'blanc';
  }

  /// Rend le nom de la teinte et, si la mesure est près d'une frontière, celui
  /// de la bande voisine.
  static (String, String?) _nommerTeinte(
    double teinte,
    double saturation,
    double luminosite,
  ) {
    final base = _bande(teinte);

    // Les familles chaudes changent de nom selon la clarté, et ces noms-là
    // sont ceux que les gens emploient : personne ne dit « orange sombre »
    // devant du marron, ni « rouge clair » devant du rose.
    final nom = _selonClarte(base, teinte, saturation, luminosite);

    final distance = _distanceAFrontiere(teinte);
    if (distance > _marge) return (nom, null);

    final autre = _selonClarte(
      _bande(teinte + _marge * 2),
      teinte + _marge * 2,
      saturation,
      luminosite,
    );
    return (nom, autre == nom ? null : autre);
  }

  static String _selonClarte(
    String base,
    double teinte,
    double saturation,
    double luminosite,
  ) {
    final chaudSombre = luminosite < 0.42;
    if (base == 'orange' || base == 'jaune') {
      if (chaudSombre) return 'marron';
      if (saturation < 0.4 && luminosite > 0.62) return 'beige';
    }
    if (base == 'rouge' || base == 'rose') {
      if (luminosite < 0.32) return 'bordeaux';
      if (base == 'rouge' && luminosite > 0.72 && saturation < 0.75) {
        return 'rose';
      }
    }
    if (base == 'bleu' && luminosite > 0.68) return 'bleu clair';
    if (base == 'bleu' && luminosite < 0.3) return 'bleu marine';
    if (base == 'vert' && luminosite < 0.3) return 'vert foncé';
    return base;
  }

  static String _bande(double teinte) {
    final t = teinte % 360;
    for (final (borne, nom) in _bandes) {
      if (t < borne) return nom;
    }
    return 'rouge';
  }

  /// Distance à la frontière de bande la plus proche, en degrés.
  static double _distanceAFrontiere(double teinte) {
    final t = teinte % 360;
    var minimum = double.infinity;
    for (final (borne, _) in _bandes) {
      final ecart = (t - borne).abs();
      final circulaire = ecart > 180 ? 360 - ecart : ecart;
      if (circulaire < minimum) minimum = circulaire;
    }
    return minimum;
  }

  /// Rouge-vert-bleu vers teinte (0–360), saturation et luminosité (0–1).
  static (double, double, double) _tsl(int r, int g, int b) {
    final rn = r / 255, gn = g / 255, bn = b / 255;
    final max = [rn, gn, bn].reduce((a, x) => a > x ? a : x);
    final min = [rn, gn, bn].reduce((a, x) => a < x ? a : x);
    final delta = max - min;
    final luminosite = (max + min) / 2;

    if (delta == 0) return (0, 0, luminosite);

    // Saturation au sens **TSV** (delta / max), et non TSL. Sur un blanc
    // cassé, la formule TSL rend 0,60 — elle divise par une marge qui s'écrase
    // près des extrêmes — alors que la couleur est manifestement délavée. La
    // forme TSV rend 0,12, qui décrit ce que l'œil voit. La luminosité, elle,
    // reste celle de TSL : c'est la moyenne du plus clair et du plus sombre,
    // et c'est bien ainsi qu'on juge « clair » ou « foncé ».
    final saturation = delta / max;

    double teinte;
    if (max == rn) {
      teinte = ((gn - bn) / delta) % 6;
    } else if (max == gn) {
      teinte = (bn - rn) / delta + 2;
    } else {
      teinte = (rn - gn) / delta + 4;
    }
    teinte *= 60;
    return (teinte < 0 ? teinte + 360 : teinte, saturation, luminosite);
  }
}
