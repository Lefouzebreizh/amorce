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
import '../repositories/fiches_repository.dart';
import 'lire_couleur.dart';

class DecrireObjet {
  const DecrireObjet(this._repository, this._fiches);

  final ScannerRepository _repository;
  final FichesRepository _fiches;

  Future<Result<FicheObjet>> call(Uint8List photo, {String? imagePath}) async {
    final couleur = LireCouleur.depuisOctets(photo);
    final resultat = await _repository.decrire(photo);

    return switch (resultat) {
      Success(:final value) => Success(
        await _garder(
          value.copyWith(
            couleur: await couleur,
            capturedAt: DateTime.now(),
            imagePath: imagePath,
          ),
        ),
      ),
      Failure(:final error) => Failure(error),
    };
  }

  /// **L'enregistrement est ici, et pas dans le contrôleur.** C'est
  /// exactement l'oubli qui a fait vivre la version un sans mémoire : le
  /// parcours du comparateur écrit son journal depuis son contrôleur, celui de
  /// la fiche n'avait pas d'équivalent, et rien ne le signalait. Posé sur le
  /// cas d'usage, l'enregistrement suit tous les chemins — déclencheur,
  /// photo de la galerie, et ceux qui viendront.
  ///
  /// **Un échec d'écriture ne fait pas échouer le scan.** Un disque plein est
  /// une raison de ne pas garder la fiche, jamais une raison de refuser de la
  /// montrer : elle vient d'être payée en requête et en attente, et elle est
  /// juste. La perdre pour un défaut de rangement serait le pire des deux
  /// résultats possibles.
  Future<FicheObjet> _garder(FicheObjet fiche) async {
    try {
      await _fiches.enregistrer(fiche);
    } catch (_) {
      // Volontairement muet côté domaine : c'est l'affichage qui décide s'il
      // y a lieu de dire quelque chose, et il n'y a rien d'utile à en dire.
    }
    return fiche;
  }

  void abort() => _repository.abort();
}
