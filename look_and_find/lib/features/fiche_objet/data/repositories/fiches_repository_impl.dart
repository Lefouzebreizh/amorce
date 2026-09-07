/// Le branchement entre le domaine et la boîte Hive.
///
/// Il ne fait que relayer, et c'est voulu : toute la décision — la clé, la
/// borne, la tolérance à une entrée illisible — vit dans la source de données,
/// à un seul endroit. Une couche qui « améliorerait » au passage donnerait deux
/// endroits où chercher pourquoi une fiche a disparu.
library;

import '../../domain/entities/fiche_objet.dart';
import '../../domain/repositories/fiches_repository.dart';
import '../datasources/fiches_local_datasource.dart';

class FichesRepositoryImpl implements FichesRepository {
  const FichesRepositoryImpl(this._source);

  final FichesLocalDataSource _source;

  @override
  Stream<List<FicheObjet>> observer() => _source.observer();

  @override
  Future<void> enregistrer(FicheObjet fiche) => _source.enregistrer(fiche);

  @override
  Future<void> supprimer(FicheObjet fiche) => _source.supprimer(fiche);
}
