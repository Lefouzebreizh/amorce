/// Ce que le domaine sait faire des fiches gardées, sans savoir où elles vivent.
///
/// L'interface existe pour une raison précise et pas par principe : c'est elle
/// qui permet à [DecrireObjet] d'enregistrer sans dépendre de Hive, donc au
/// domaine de rester sans dépendance à Flutter — ce qui est la condition pour
/// que `tool/` rejoue une réponse en ligne de commande, et pour qu'un test
/// remplace tout le stockage par une liste en mémoire.
library;

import '../entities/fiche_objet.dart';

abstract interface class FichesRepository {
  /// Les fiches gardées, les plus récentes d'abord, réémises à chaque écriture.
  Stream<List<FicheObjet>> observer();

  Future<void> enregistrer(FicheObjet fiche);

  Future<void> supprimer(FicheObjet fiche);
}
