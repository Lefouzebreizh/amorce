/// Traduction entre le JSON et [Product].
///
/// **Un seul DTO pour deux usages** : la réponse du modèle et le stockage
/// local. Deux formats séparés obligeraient à migrer la base à chaque champ
/// ajouté à la fiche ; ici un favori enregistré hier se relit avec le code
/// d'aujourd'hui parce que la lecture est tolérante par construction.
///
/// **La lecture ne lève jamais sur un champ.** Un modèle de langage renvoie
/// « 149,99 », `"149.99"`, `null` ou omet la clé, selon la photo. Refuser toute
/// la fiche pour un prix marchand mal typé perdrait les six autres marchands
/// corrects. Seule l'absence de [title] est fatale : sans nom d'objet, il n'y a
/// pas de fiche à montrer — c'est le seul cas où l'analyse échoue.
library;

import 'dart:convert';

import '../../domain/entities/product.dart';

class ProductDto {
  const ProductDto._(this._json);

  factory ProductDto.fromJson(Map<String, dynamic> json) => ProductDto._(json);

  final Map<String, dynamic> _json;

  static ProductDto fromEntity(Product product) => ProductDto._({
    'id': product.id,
    'title': product.title,
    'brand': product.brand,
    'category': product.category.name,
    'description': product.description,
    'average_price': product.averagePrice,
    'currency': product.currency,
    'dimensions': {
      'width': product.dimensions.width,
      'height': product.dimensions.height,
      'depth': product.dimensions.depth,
      'unit': product.dimensions.unit,
    },
    'merchants': [
      for (final m in product.merchants)
        {
          'name': m.name,
          'price': m.price,
          'url': m.url,
          'in_stock': m.inStock,
          'discount': m.discount,
        },
    ],
    'alternatives': [
      for (final a in product.alternatives)
        {'title': a.title, 'price': a.price, 'brand': a.brand},
    ],
    'model_3d_url': product.model3dUrl,
    'captured_at': product.capturedAt?.toIso8601String(),
    'image_path': product.imagePath,
  });

  Map<String, dynamic> toJson() => _json;

  String encode() => jsonEncode(_json);

  static ProductDto decode(String raw) =>
      ProductDto._(jsonDecode(raw) as Map<String, dynamic>);

  /// Renvoie `null` si la réponse n'a pas de titre exploitable — l'appelant
  /// traduit ça en « objet non identifié », qui est le bon message.
  Product? toEntity() {
    final title = _string(_json['title']);
    if (title == null || title.isEmpty) return null;

    final brand = _string(_json['brand']);

    return Product(
      id: _string(_json['id']) ?? buildId(brand: brand, title: title),
      title: title,
      brand: brand,
      category: ProductCategory.parse(_string(_json['category'])),
      description: _string(_json['description']),
      averagePrice: _double(_json['average_price']) ?? 0,
      currency: _string(_json['currency']) ?? 'EUR',
      dimensions: _dimensions(_json['dimensions']),
      merchants: _list(_json['merchants']).map(_merchant).nonNulls.toList(),
      alternatives:
          _list(_json['alternatives']).map(_alternative).nonNulls.toList(),
      model3dUrl: _url(_json['model_3d_url']),
      capturedAt: DateTime.tryParse(_string(_json['captured_at']) ?? ''),
      imagePath: _string(_json['image_path']),
    );
  }

  /// Identifiant stable, dérivé du nom : deux scans du même objet donnent la
  /// même clé, donc le même favori et le même historique de prix. Un hash
  /// FNV-1a suffit ici — on cherche la stabilité, pas la résistance aux
  /// collisions d'un attaquant.
  static String buildId({String? brand, required String title}) {
    // Chaque partie est nettoyée avant d'être jointe : un espace laissé par le
    // modèle en tête de titre suffirait sinon à créer un second favori pour le
    // même objet.
    final seed = '${(brand ?? '').trim()}|${title.trim()}'
        .toLowerCase()
        .replaceAll(RegExp(r'\s+'), ' ');
    var hash = 0x811c9dc5;
    for (final unit in seed.codeUnits) {
      hash ^= unit;
      hash = (hash * 0x01000193) & 0xFFFFFFFF;
    }
    return hash.toRadixString(16).padLeft(8, '0');
  }

  static ProductDimensions _dimensions(Object? raw) {
    if (raw is! Map) return const ProductDimensions();
    return ProductDimensions(
      width: _double(raw['width']),
      height: _double(raw['height']),
      depth: _double(raw['depth']),
      unit: _string(raw['unit']) ?? 'cm',
    );
  }

  static Merchant? _merchant(Object? raw) {
    if (raw is! Map) return null;
    final name = _string(raw['name']);
    final price = _double(raw['price']);
    if (name == null || price == null) return null;
    return Merchant(
      name: name,
      price: price,
      url: _url(raw['url']) ?? '',
      // Absence d'information ≠ rupture : afficher « Rupture » à tort envoie
      // l'utilisateur chez un concurrent plus cher pour rien.
      inStock: raw['in_stock'] is bool ? raw['in_stock'] as bool : true,
      discount: _string(raw['discount']),
    );
  }

  static ProductAlternative? _alternative(Object? raw) {
    if (raw is! Map) return null;
    final title = _string(raw['title']);
    final price = _double(raw['price']);
    if (title == null || price == null) return null;
    return ProductAlternative(
      title: title,
      price: price,
      brand: _string(raw['brand']),
    );
  }

  static List<Object?> _list(Object? raw) => raw is List ? raw : const [];

  static String? _string(Object? raw) {
    if (raw == null) return null;
    final value = raw.toString().trim();
    // Le modèle écrit parfois littéralement « null » ou « N/A » plutôt que
    // d'omettre la clé.
    if (value.isEmpty || value == 'null' || value == 'N/A') return null;
    return value;
  }

  static double? _double(Object? raw) {
    if (raw is num) return raw.toDouble();
    if (raw is! String) return null;
    // « 149,99 € » → 149.99 : virgule décimale et symbole sont fréquents dès
    // que le prompt est en français.
    final cleaned = raw
        .replaceAll(RegExp(r'[^0-9,.\-]'), '')
        .replaceAll(',', '.');
    return double.tryParse(cleaned);
  }

  /// Une URL inventée par le modèle casse `url_launcher` et, pour un modèle
  /// 3D, laisse tourner un chargement qui n'aboutira jamais. Seules `http(s)`
  /// passent.
  static String? _url(Object? raw) {
    final value = _string(raw);
    if (value == null) return null;
    final uri = Uri.tryParse(value);
    if (uri == null || !uri.hasAuthority) return null;
    if (uri.scheme != 'http' && uri.scheme != 'https') return null;
    return value;
  }
}
