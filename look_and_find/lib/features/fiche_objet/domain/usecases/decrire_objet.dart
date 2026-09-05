/// Décrire l'objet d'une photo : le parcours complet de la version un.
///
/// Le cas d'usage ne relaie pas seulement l'appel. Il **date** la fiche, lui
/// attache le chemin de la photo locale, et y pose la **couleur mesurée sur
/// l'image**. Ces trois champs ne viennent pas du modèle ; les poser ici plutôt
/// que dans le contrôleur garantit qu'une fiche est toujours complète, y compris
/// quand elle arrive par un autre chemin (test, import, rejeu).
///
/// Les deux travaux partent **en même temps**. L'appel au modèle dure quelques
/// secondes, la lecture de couleur quelques centaines de millisecondes : les
/// enchaîner ajouterait cette attente à celle qu'on subit déjà, pour rien.
///
/// Une couleur illisible ne fait pas échouer la fiche. Le nom, l'usage et les
/// conseils restent justes sans elle, et une photo trop sombre pour être décodée
/// reste une photo dont le modèle a pu dire quelque chose.
library;

import 'dart:typed_data';

import '../../../../core/utils/result.dart';
import '../../../scanner/domain/repositories/scanner_repository.dart';
import '../entities/fiche_objet.dart';
import 'lire_couleur.dart';

class DecrireObjet {
  const DecrireObjet(this._repository);

  final ScannerRepository _repository;

  Future<Result<FicheObjet>> call(Uint8List photo, {String? imagePath}) async {
    final couleur = LireCouleur.depuisOctets(photo);
    final resultat = await _repository.decrire(photo);

    return switch (resultat) {
      Success(:final value) => Success(
        value.copyWith(
          couleur: await couleur,
          capturedAt: DateTime.now(),
          imagePath: imagePath,
        ),
      ),
      Failure(:final error) => Failure(error),
    };
  }

  void abort() => _repository.abort();
}
