/// Contrat d'identification, vu du domaine.
///
/// Aucun type de Dio ni de Gemini ne traverse cette frontière : c'est ce qui
/// permet de tester le parcours de scan avec une fausse implémentation, et de
/// changer de fournisseur de vision sans toucher à la présentation.
///
/// [abort] existe parce qu'une identification dure quelques secondes et que
/// l'utilisateur quitte parfois l'écran avant la fin. Sans elle, la requête
/// continue, consomme du quota facturé et revient dans un contrôleur qui
/// n'existe plus.
library;

import 'dart:typed_data';

import '../../../../core/utils/result.dart';
import '../../../fiche_objet/domain/entities/fiche_objet.dart';
import '../../../product_detail/domain/entities/product.dart';

abstract interface class ScannerRepository {
  /// Le parcours de la version un : décrire l'objet.
  Future<Result<FicheObjet>> decrire(Uint8List photo);

  /// Le parcours du comparateur, gardé pour la version deux. Hors du chemin de
  /// l'application, mais toujours testé : le remettre en service doit coûter
  /// une ligne de navigation, pas une réécriture.
  Future<Result<Product>> identify(Uint8List photo);

  void abort();
}
