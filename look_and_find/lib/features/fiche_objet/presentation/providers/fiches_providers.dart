/// Les providers des fiches gardées.
///
/// La boîte est **ouverte au démarrage** et entre par surcharge, comme celles
/// des favoris : `Hive.openBox` est asynchrone, et l'ouvrir à la demande
/// obligerait la liste à afficher un chargement pour lire trois lignes déjà sur
/// le disque. Le provider lève tant qu'on ne l'a pas surchargé — c'est une
/// erreur de câblage, pas un état à gérer, et elle doit se voir au premier
/// lancement plutôt que se rattraper en silence.
library;

import 'package:hive_flutter/hive_flutter.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../data/datasources/fiches_local_datasource.dart';
import '../../data/repositories/fiches_repository_impl.dart';
import '../../domain/entities/fiche_objet.dart';
import '../../domain/repositories/fiches_repository.dart';

part 'fiches_providers.g.dart';

@Riverpod(keepAlive: true)
Box<String> fichesBox(Ref ref) =>
    throw UnimplementedError('La boîte des fiches doit être surchargée.');

@Riverpod(keepAlive: true)
FichesRepository fichesRepository(Ref ref) =>
    FichesRepositoryImpl(FichesLocalDataSource(ref.watch(fichesBoxProvider)));

/// Le flux que lit « Mes fiches ». Il réémet à chaque scan enregistré, si bien
/// qu'une fiche identifiée pendant que la liste est ouverte y apparaît sans
/// qu'on ait à en sortir.
@riverpod
Stream<List<FicheObjet>> fiches(Ref ref) =>
    ref.watch(fichesRepositoryProvider).observer();
