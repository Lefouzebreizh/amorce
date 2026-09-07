/// Les fiches identifiées, gardées sur le téléphone.
///
/// **Pourquoi une clé par instant de prise, et non par nom d'objet.** Les
/// produits du comparateur sont classés par identifiant : rescanner le même
/// article met son entrée à jour, parce qu'un article est une chose au
/// catalogue. Une fiche n'est pas une chose, c'est une **observation** — deux
/// photos du même couteau, prises à deux moments, sont deux observations, et
/// écraser la première ferait disparaître ce qu'on avait vu ce jour-là.
/// L'horodatage est aussi ce qui trie la liste sans avoir à relire les fiches.
///
/// **Pourquoi la boîte est bornée.** Chaque fiche pèse quelques kilo-octets et
/// personne ne fait défiler jusqu'en bas. Sans borne, la liste finit par mettre
/// une seconde à s'ouvrir sur un téléphone modeste, pour des entrées que
/// personne ne regarde. C'est la même décision que pour l'historique produit,
/// prise pour la même raison, et la limite est la même — la changer d'un côté
/// sans l'autre donnerait deux listes qui n'oublient pas au même rythme.
///
/// **La photo n'est pas recopiée, seul son chemin est gardé.** Les clichés
/// vivent dans le dossier temporaire du système, que celui-ci vide quand il
/// veut. Une vignette peut donc manquer alors que la fiche reste entièrement
/// lisible : c'est le cas normal, pas une panne, et l'affichage le prévoit.
library;

import 'package:hive_flutter/hive_flutter.dart';

import '../../domain/entities/fiche_objet.dart';
import '../models/fiche_objet_dto.dart';

class FichesLocalDataSource {
  const FichesLocalDataSource(this._boite);

  final Box<String> _boite;

  static const int limite = 60;

  /// Les plus récentes d'abord. Le tri porte sur la clé, qui est l'horodatage
  /// en ISO 8601 : c'est le seul format de date dont l'ordre alphabétique est
  /// l'ordre chronologique, ce qui évite de décoder soixante fiches pour en
  /// afficher trois.
  List<FicheObjet> lire() {
    final cles = _boite.keys.map((k) => k.toString()).toList()
      ..sort((a, b) => b.compareTo(a));

    return cles
        .map((cle) {
          final brut = _boite.get(cle);
          if (brut == null) return null;
          try {
            return FicheObjetDto.decode(brut).toStoredEntity();
          } catch (_) {
            // Une entrée illisible — écrite par une version antérieure, ou
            // tronquée par un disque plein — ne doit pas emporter la liste
            // entière. Elle est ignorée, les autres s'affichent.
            return null;
          }
        })
        .nonNulls
        .toList();
  }

  /// Émet immédiatement, puis à chaque écriture : un écran qui s'abonne ne doit
  /// pas attendre le prochain scan pour afficher ce qui est déjà là.
  Stream<List<FicheObjet>> observer() async* {
    yield lire();
    yield* _boite.watch().map((_) => lire());
  }

  Future<void> enregistrer(FicheObjet fiche) async {
    await _boite.put(_cle(fiche), FicheObjetDto.fromEntity(fiche).encode());
    await _tailler();
  }

  Future<void> supprimer(FicheObjet fiche) => _boite.delete(_cle(fiche));

  Future<void> vider() => _boite.clear();

  /// L'instant de la prise, en ISO 8601. `capturedAt` est posé par le cas
  /// d'usage et n'est donc jamais nul en pratique ; le repli sur l'heure
  /// courante existe pour qu'une fiche arrivée par un autre chemin — un test,
  /// un import — s'enregistre quand même au lieu de tomber sur une clé vide.
  static String _cle(FicheObjet fiche) =>
      (fiche.capturedAt ?? DateTime.now()).toIso8601String();

  Future<void> _tailler() async {
    if (_boite.length <= limite) return;
    final cles = _boite.keys.map((k) => k.toString()).toList()..sort();
    await _boite.deleteAll(cles.take(_boite.length - limite));
  }
}
