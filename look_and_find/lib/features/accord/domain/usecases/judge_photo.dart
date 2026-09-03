/// La porte d'entrée d'Accord : cette photo permet-elle une harmonie ?
///
/// Écrite **avant** les harmonies, et c'est délibéré. Sur dix photos
/// d'intérieur réelles, cinq étaient inexploitables ; un module qui calcule
/// d'abord et se protège ensuite aurait donc sorti une palette fausse une fois
/// sur deux, avec le même aplomb que les cinq bonnes.
///
/// **Deux décisions de méthode.**
///
/// La dominante n'est pas le pixel le plus fréquent. Un mur photographié porte
/// ses ombres d'angle et ses reflets de fenêtre : un histogramme naïf en fait
/// trois couleurs distinctes et retient la plus nombreuse, qui est souvent
/// l'ombre. On regroupe donc par famille de teinte, et on écarte des deux côtés
/// ce qui est trop sombre ou trop clair pour porter une couleur — c'est
/// l'ombre et le reflet de la même surface, pas deux couleurs de plus.
///
/// **Ce qu'elle reçoit est une zone, pas une photo.** L'appelant lui passe les
/// pixels du cadre de visée — voir `ZoneVisee` — et jamais l'image entière.
/// Quarante-sept photos réelles ont montré pourquoi : sur une pièce, la porte
/// rend la couleur de la plus grande surface présente, ce qui est exact et
/// inutile. Elle ne sait pas, et ne saura pas depuis les pixels, si cette
/// surface est celle qu'on visait. C'est le cadre qui porte cette réponse.
///
/// L'ordre des refus n'est pas décoratif. Le contre-jour passe avant « trop
/// sombre » parce qu'une pièce sombre **avec** une fenêtre brûlée n'est pas le
/// même problème qu'une pièce simplement mal éclairée, et n'appelle pas le même
/// geste : se tourner, plutôt qu'allumer.
library;

import 'dart:math' as math;

import '../entities/photo_verdict.dart';

class JudgePhoto {
  const JudgePhoto._();

  /// Part de l'image brûlée à partir de laquelle la surface n'a plus de
  /// couleur à rendre. Un quart de l'image sans information suffit à fausser
  /// toute dominante calculée sur le reste.
  static const double _partBrulee = 0.25;

  /// Contre-jour : une masse claire franche **et** un fond sombre. Les deux
  /// sont nécessaires — une fenêtre dans le cadre d'une pièce bien éclairée ne
  /// gêne personne.
  static const double _partClaire = 0.18;
  static const double _medianeBasse = 0.35;

  /// En dessous, la teinte n'est plus qu'un bruit d'appareil. Le seuil est le
  /// même que celui qui fait basculer `NameColor` vers les gris dans les tons
  /// sombres, et pour la même raison physique.
  static const double _tropSombre = 0.18;

  /// Deux familles de teinte revendiquant chacune ce quart de l'image, à plus
  /// de quarante degrés l'une de l'autre : ce n'est plus une surface, c'est
  /// deux. Le cas mesuré était une bâche verte au fond du jardin, vue par la
  /// fenêtre derrière un mur ocre.
  static const double _partRivale = 0.25;
  static const double _ecartRival = 40;

  /// Le cadre doit être **tenu par une surface**, et ces deux seuils viennent
  /// de dix-sept photos d'intérieur réelles, pas d'un raisonnement.
  ///
  /// La première version ne cherchait que deux teintes qui s'affrontent. Elle a
  /// accepté quinze de ces dix-sept photos et rendu, pour presque toutes, le
  /// même brun boueux autour de `#8D704B` : ce sont des photos de **pièces
  /// entières**, où le parquet, les murs et la lumière chaude tombent tous dans
  /// la même famille de teinte. Aucun conflit, donc aucun refus — et une
  /// moyenne de pièce qui n'est la couleur de rien.
  ///
  /// Ce qui sépare une surface d'une pièce n'est pas le désaccord, c'est la
  /// **dispersion**. Mesurée sur ces photos, elle sépare franchement : les
  /// clichés tenus par une surface concentrent leurs teintes entre 0,82 et
  /// 1,00 et donnent plus de la moitié de leurs pixels à une seule famille ;
  /// les pièces entières plafonnent à 0,59 et 0,39. Les seuils sont posés dans
  /// le vide qui sépare les deux groupes.
  static const double _partDominante = 0.50;
  static const double _concentration = 0.70;

  /// En dessous, la surface est grise. Une harmonie y est calculable et
  /// n'apprend rien : le gris s'accorde avec tout.
  static const double _delavee = 0.10;

  /// Juge un échantillon de pixels — l'image réduite, pas l'image entière :
  /// mille points suffisent à décrire une surface, et la réduction lisse le
  /// bruit du capteur au passage.
  static PhotoVerdict juger(List<(int, int, int)> echantillon) {
    if (echantillon.isEmpty) {
      return const PhotoVerdict.refusee(PhotoRefus.tropSombre);
    }

    final luminances = <double>[];
    var brulees = 0, claires = 0;
    for (final (r, g, b) in echantillon) {
      // Luminance perçue : l'œil est deux fois plus sensible au vert qu'au
      // rouge, et six fois plus qu'au bleu. Une moyenne simple prendrait un
      // bleu profond pour une couleur claire.
      final l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      luminances.add(l);
      if (l > 0.97) brulees++;
      if (l > 0.92) claires++;
    }
    luminances.sort();
    final mediane = luminances[luminances.length ~/ 2];

    final partClaire = claires / echantillon.length;
    if (partClaire >= _partClaire && mediane < _medianeBasse) {
      return const PhotoVerdict.refusee(PhotoRefus.contreJour);
    }
    if (brulees / echantillon.length >= _partBrulee) {
      return const PhotoVerdict.refusee(PhotoRefus.surexposee);
    }
    if (mediane < _tropSombre) {
      return const PhotoVerdict.refusee(PhotoRefus.tropSombre);
    }

    // Ne regrouper que les pixels capables de porter une couleur : ce qui est
    // presque noir ou presque blanc est une ombre ou un reflet de la même
    // surface, et le compter comme une teinte à part fausse le regroupement.
    final utiles = <(int, int, int, double, double)>[];
    for (final (r, g, b) in echantillon) {
      final (teinte, saturation, luminosite) = _tsl(r, g, b);
      if (luminosite < 0.12 || luminosite > 0.94) continue;
      utiles.add((r, g, b, teinte, saturation));
    }
    if (utiles.isEmpty) {
      return const PhotoVerdict.refusee(PhotoRefus.tropSombre);
    }

    // La grisaille se juge **avant** la teinte, et cet ordre est un correctif.
    //
    // Sur une surface désaturée, la teinte n'est que du bruit : un plaid gris
    // parfaitement uni voit ses pixels s'éparpiller dans toutes les familles
    // sans que sa couleur change d'un iota. Les mesures de dispersion rendaient
    // alors « le cadre contient plusieurs surfaces » sur une surface unique, et
    // conseillaient de recadrer — un geste qui ne change rien, puisque le
    // problème est que la surface est grise.
    //
    // Trois cadres du corpus étaient dans ce cas. L'ordre ne déplace aucun
    // verdict : il ne corrige que la raison, donc le geste proposé.
    final saturationCadre =
        utiles.map((p) => p.$5).reduce((a, b) => a + b) / utiles.length;
    if (saturationCadre < _delavee) {
      return const PhotoVerdict.refusee(PhotoRefus.surfaceDelavee);
    }

    // Familles de teinte de trente degrés : assez large pour réunir un mur et
    // son ombre, assez étroite pour séparer un ocre d'un vert.
    final familles = <int, List<(int, int, int, double, double)>>{};
    for (final pixel in utiles) {
      familles.putIfAbsent((pixel.$4 ~/ 30) % 12, () => []).add(pixel);
    }
    final classees = familles.entries.toList()
      ..sort((a, b) => b.value.length.compareTo(a.value.length));

    if (classees.length > 1) {
      final premiere = classees[0].value.length / utiles.length;
      final seconde = classees[1].value.length / utiles.length;
      final ecart = _ecartCirculaire(
        _teinteMoyenne(classees[0].value),
        _teinteMoyenne(classees[1].value),
      );
      if (premiere >= _partRivale &&
          seconde >= _partRivale &&
          ecart >= _ecartRival) {
        return const PhotoVerdict.refusee(PhotoRefus.plusieursSurfaces);
      }
    }

    // Deux blocs francs se voient au test précédent ; une pièce encombrée, non.
    // Elle éparpille ses teintes sans qu'aucune n'affronte l'autre, et c'est la
    // dispersion qui la trahit.
    final part = classees[0].value.length / utiles.length;
    if (part < _partDominante || _concentrationTeintes(utiles) < _concentration) {
      return const PhotoVerdict.refusee(PhotoRefus.plusieursSurfaces);
    }

    // La même borne, sur la dominante seule : un cadre globalement coloré peut
    // avoir une famille majoritaire grise, et c'est elle qu'on rendrait.
    final dominante = classees[0].value;
    final saturationMoyenne =
        dominante.map((p) => p.$5).reduce((a, b) => a + b) / dominante.length;
    if (saturationMoyenne < _delavee) {
      return const PhotoVerdict.refusee(PhotoRefus.surfaceDelavee);
    }

    return PhotoVerdict.acceptee(
      _moyenne(dominante.map((p) => p.$1)),
      _moyenne(dominante.map((p) => p.$2)),
      _moyenne(dominante.map((p) => p.$3)),
    );
  }

  /// Longueur du vecteur moyen des teintes : 1 quand toute l'image porte la
  /// même, 0 quand elles se répartissent sur toute la roue. Une moyenne simple
  /// de degrés ne dirait rien — deux rouges à 1° et 359° en donneraient 180,
  /// soit exactement la couleur opposée.
  static double _concentrationTeintes(
    List<(int, int, int, double, double)> pixels,
  ) {
    var x = 0.0, y = 0.0;
    for (final p in pixels) {
      final rad = p.$4 * math.pi / 180;
      x += math.cos(rad);
      y += math.sin(rad);
    }
    return math.sqrt(x * x + y * y) / pixels.length;
  }

  static int _moyenne(Iterable<int> valeurs) =>
      (valeurs.reduce((a, b) => a + b) / valeurs.length).round().clamp(0, 255);

  /// Moyenne d'angles : additionner des degrés donne 180° pour deux rouges
  /// situés à 1° et 359°, soit exactement la couleur opposée.
  static double _teinteMoyenne(List<(int, int, int, double, double)> pixels) {
    var x = 0.0, y = 0.0;
    for (final p in pixels) {
      final rad = p.$4 * math.pi / 180;
      x += math.cos(rad);
      y += math.sin(rad);
    }
    final angle = math.atan2(y, x) * 180 / math.pi;
    return angle < 0 ? angle + 360 : angle;
  }

  static double _ecartCirculaire(double a, double b) {
    final ecart = (a - b).abs() % 360;
    return ecart > 180 ? 360 - ecart : ecart;
  }

  static (double, double, double) _tsl(int r, int g, int b) {
    final rn = r / 255, gn = g / 255, bn = b / 255;
    final max = [rn, gn, bn].reduce((a, x) => a > x ? a : x);
    final min = [rn, gn, bn].reduce((a, x) => a < x ? a : x);
    final delta = max - min;
    final luminosite = (max + min) / 2;
    if (delta == 0) return (0, 0, luminosite);
    double teinte;
    if (max == rn) {
      teinte = ((gn - bn) / delta) % 6;
    } else if (max == gn) {
      teinte = (bn - rn) / delta + 2;
    } else {
      teinte = (rn - gn) / delta + 4;
    }
    teinte *= 60;
    return (teinte < 0 ? teinte + 360 : teinte, delta / max, luminosite);
  }
}
