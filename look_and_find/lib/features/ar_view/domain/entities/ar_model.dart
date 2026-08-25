/// Ce qu'il faut savoir d'un modèle 3D avant d'ouvrir la réalité augmentée.
///
/// **Le format décide de la plateforme, et c'est une contrainte du système,
/// pas un choix.** Android place un modèle par Scene Viewer, qui lit le `.glb`.
/// iOS place par Quick Look, qui ne lit **que** le `.usdz`. Un objet dont
/// l'identification n'a renvoyé qu'un `.glb` est donc consultable en 3D sur
/// iPhone, mais pas posable dans la pièce. Mieux vaut le dire dans l'interface
/// que laisser un bouton « Voir chez moi » qui ne fait rien.
///
/// **L'échelle est fixe** (`ArScale.fixed`) : l'intérêt de la fonction est
/// justement de répondre à « est-ce que ça rentre ». Laisser l'utilisateur
/// agrandir le meuble au doigt donnerait une réponse fausse et rassurante.
/// Cela suppose un modèle exporté en mètres réels, ce qui est la convention
/// glTF.
library;

import '../../../product_detail/domain/entities/product.dart';

class ArModel {
  const ArModel._({
    required this.product,
    required this.src,
    required this.iosSrc,
  });

  final Product product;

  /// Modèle chargé dans la visionneuse (glTF binaire de préférence).
  final String src;

  /// Variante `.usdz`, seule acceptée par Quick Look sur iOS.
  final String? iosSrc;

  /// `null` quand l'identification n'a pas trouvé de modèle exploitable :
  /// l'appelant affiche alors les dimensions, qui restent le repère utile.
  static ArModel? from(Product product) {
    final url = product.model3dUrl;
    if (url == null || url.isEmpty) return null;

    final isUsdz = url.toLowerCase().endsWith('.usdz');
    return ArModel._(
      product: product,
      src: url,
      iosSrc: isUsdz ? url : null,
    );
  }

  /// Placement au sol par défaut ; les objets de décoration sont les seuls que
  /// l'on accroche couramment (cadre, miroir, applique).
  bool get isWallMounted => product.category == ProductCategory.decor;

  bool get canPlaceOnIos => iosSrc != null;
}
