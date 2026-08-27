/// La fiche produit : ce que l'identification produit et ce que tout le reste
/// de l'application consomme.
///
/// **Où vit ce fichier, et pourquoi.** `product_detail` est propriétaire de la
/// notion de produit ; `scanner`, `favorites` et `ar_view` importent ce
/// domaine, et lui n'importe personne. La règle de dépendance du dépôt tient
/// en deux points :
///
/// — le `data` et le `domain` d'une fonctionnalité n'importent jamais le
///   `data` ni la `presentation` d'une autre ; seuls son `domain` et le DTO
///   qui le sérialise sont accessibles ;
/// — la `presentation` peut importer celle d'une autre fonctionnalité
///   uniquement pour naviguer vers son écran, ou pour un composant partagé
///   explicitement (`FavoriteButton`, qui appartient au suivi de prix et non
///   à la fiche qui l'affiche).
///
/// Sans cette direction unique, les quatre fonctionnalités finiraient par se
/// référencer en cercle et plus aucune ne serait extractible.
///
/// Tout est immuable et sans dépendance à Flutter : ces classes se comparent,
/// se copient et se testent hors de tout widget.
library;

import '../../../../core/utils/iterables.dart';

enum ProductCategory {
  furniture('Mobilier'),
  tech('High-tech'),
  appliance('Électroménager'),
  decor('Décoration'),
  unknown('Autre');

  const ProductCategory(this.label);

  final String label;

  /// Le modèle renvoie parfois une casse ou un pluriel inattendus. Une valeur
  /// hors liste ne doit pas faire échouer toute la fiche : elle retombe sur
  /// [unknown], qui s'affiche sans mentir.
  static ProductCategory parse(String? raw) {
    final key = raw?.trim().toLowerCase();
    return ProductCategory.values.firstWhereOrNull((c) => c.name == key) ??
        ProductCategory.unknown;
  }
}

class ProductDimensions {
  const ProductDimensions({
    this.width,
    this.height,
    this.depth,
    this.unit = 'cm',
  });

  final double? width;
  final double? height;
  final double? depth;
  final String unit;

  bool get isEmpty =>
      (width ?? 0) <= 0 && (height ?? 0) <= 0 && (depth ?? 0) <= 0;

  /// Volume en litres, quand les trois cotes sont connues. Sert au message
  /// d'encombrement lorsqu'aucun modèle 3D n'est disponible : « environ 480 L »
  /// se ramène à quelque chose de familier mieux qu'un triplet de nombres.
  double? get litres {
    if (width == null || height == null || depth == null) return null;
    // Facteur de conversion de l'unité vers le centimètre.
    final toCm = switch (unit) {
      'mm' => 0.1,
      'm' => 100.0,
      _ => 1.0,
    };
    final cm3 = (width! * toCm) * (height! * toCm) * (depth! * toCm);
    return cm3 / 1000;
  }
}

class Merchant {
  const Merchant({
    required this.name,
    required this.price,
    required this.url,
    required this.inStock,
    this.discount,
  });

  final String name;
  final double price;
  final String url;
  final bool inStock;

  /// Tel que renvoyé par le modèle (« 10% », « -15 € »). Non normalisé : une
  /// promotion mal reformatée inspire moins confiance qu'une promotion citée.
  final String? discount;

  bool get hasDiscount => discount != null && discount!.trim().isNotEmpty;
}

class ProductAlternative {
  const ProductAlternative({
    required this.title,
    required this.price,
    this.brand,
  });

  final String title;
  final double price;
  final String? brand;
}

class Product {
  const Product({
    required this.id,
    required this.title,
    required this.category,
    required this.averagePrice,
    required this.currency,
    this.brand,
    this.description,
    this.dimensions = const ProductDimensions(),
    this.merchants = const [],
    this.alternatives = const [],
    this.model3dUrl,
    this.capturedAt,
    this.imagePath,
  });

  /// Stable d'un scan à l'autre : dérivé de la marque et du titre, pas d'un
  /// aléatoire. Rescanner le même fauteuil doit retomber sur le favori
  /// existant, sinon la liste se remplit de doublons et le suivi de prix
  /// repart de zéro à chaque photo.
  final String id;

  final String title;
  final String? brand;
  final ProductCategory category;
  final String? description;
  final double averagePrice;
  final String currency;
  final ProductDimensions dimensions;
  final List<Merchant> merchants;
  final List<ProductAlternative> alternatives;
  final String? model3dUrl;

  /// Renseignés localement, pas par le modèle.
  final DateTime? capturedAt;
  final String? imagePath;

  bool get canBeViewedInAr =>
      model3dUrl != null && model3dUrl!.trim().isNotEmpty;

  String get displayTitle => brand == null || brand!.isEmpty
      ? title
      : '$brand $title';

  Product copyWith({
    List<Merchant>? merchants,
    DateTime? capturedAt,
    String? imagePath,
  }) => Product(
    id: id,
    title: title,
    brand: brand,
    category: category,
    description: description,
    averagePrice: averagePrice,
    currency: currency,
    dimensions: dimensions,
    merchants: merchants ?? this.merchants,
    alternatives: alternatives,
    model3dUrl: model3dUrl,
    capturedAt: capturedAt ?? this.capturedAt,
    imagePath: imagePath ?? this.imagePath,
  );
}
