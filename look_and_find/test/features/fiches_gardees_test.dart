/// La mémoire de la version un : une fiche identifiée doit se retrouver.
///
/// Ces tests portent sur ce qui manquait, pas sur ce qui marchait déjà :
/// l'aller-retour complet par le disque — couleur et hésitation comprises —,
/// l'enregistrement qui suit le cas d'usage plutôt que l'écran, et le refus de
/// perdre une fiche juste parce que le rangement a échoué.
library;

import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:look_and_find/core/network/app_exception.dart';
import 'package:look_and_find/core/utils/result.dart';
import 'package:look_and_find/features/color_reader/domain/entities/color_reading.dart';
import 'package:look_and_find/features/fiche_objet/data/datasources/fiches_local_datasource.dart';
import 'package:look_and_find/features/fiche_objet/data/models/fiche_objet_dto.dart';
import 'package:look_and_find/features/fiche_objet/data/repositories/fiches_repository_impl.dart';
import 'package:look_and_find/features/fiche_objet/domain/entities/fiche_objet.dart';
import 'package:look_and_find/features/fiche_objet/domain/repositories/fiches_repository.dart';
import 'package:look_and_find/features/fiche_objet/domain/usecases/decrire_objet.dart';
import 'package:look_and_find/features/scanner/domain/repositories/scanner_repository.dart';
import 'package:look_and_find/features/product_detail/domain/entities/product.dart';

class _FauxDepotScanner implements ScannerRepository {
  _FauxDepotScanner(this.reponse);

  final Result<FicheObjet> reponse;

  @override
  Future<Result<FicheObjet>> decrire(Uint8List photo) async => reponse;

  @override
  Future<Result<Product>> identify(Uint8List photo) async =>
      throw UnimplementedError();

  @override
  void abort() {}
}

/// Un rangement qui refuse toujours. Il ne simule pas une panne exotique : un
/// téléphone plein se comporte exactement ainsi.
class _DisquePlein implements FichesRepository {
  @override
  Stream<List<FicheObjet>> observer() => const Stream.empty();

  @override
  Future<void> enregistrer(FicheObjet fiche) async =>
      throw const FileSystemException('plus de place');

  @override
  Future<void> supprimer(FicheObjet fiche) async {}
}

void main() {
  group('l\'aller-retour par le disque', () {
    test('rend la fiche entière, couleur et date comprises', () {
      final origine = FicheObjet(
        nom: 'Couteau d\'office',
        categorie: 'ustensile de cuisine',
        usage: 'Éplucher et tailler les petits légumes.',
        matiere: 'semble être de l\'inox et du bois',
        caracteristiques: const ['lame courte', 'manche riveté'],
        conseils: const ['Laver à la main', 'Ne pas laisser tremper'],
        couleur: const ColorReading('brun'),
        capturedAt: DateTime.utc(2026, 9, 7, 14, 32),
        imagePath: '/tmp/couteau.jpg',
      );

      final relu = FicheObjetDto.fromJson(
        FicheObjetDto.fromEntity(origine).toJson(),
      ).toStoredEntity();

      expect(relu, isNotNull);
      expect(relu!.nom, origine.nom);
      expect(relu.categorie, origine.categorie);
      expect(relu.usage, origine.usage);
      expect(relu.matiere, origine.matiere);
      expect(relu.caracteristiques, origine.caracteristiques);
      expect(relu.conseils, origine.conseils);
      expect(relu.couleur, origine.couleur);
      expect(relu.capturedAt, origine.capturedAt);
      expect(relu.imagePath, origine.imagePath);
    });

    test('garde l\'hésitation sur la couleur, jamais le seul nom retenu', () {
      // C'est le champ que la personne visée par cette fonction ne peut pas
      // vérifier : relire « bleu » seul lui donnerait une certitude que la
      // mesure n'a jamais eue.
      const mesure = ColorReading(
        'bleu',
        alternative: 'vert',
        nuance: 'sous lumière chaude',
      );
      final fiche = FicheObjet(nom: 'Boîte', couleur: mesure);

      final relu = FicheObjetDto.fromJson(
        FicheObjetDto.fromEntity(fiche).toJson(),
      ).toStoredEntity();

      expect(relu!.couleur, mesure);
      expect(relu.couleur!.isCertain, isFalse);
      expect(relu.couleur!.spoken, 'bleu, ou vert sous lumière chaude');
    });

    test('une réponse du modèle n\'a ni couleur ni date, et c\'est normal', () {
      // `toEntity` lit ce que le service renvoie ; ces trois champs-là sont
      // posés plus tard par le cas d'usage.
      final fiche = FicheObjetDto.fromJson({
        'nom': 'Marteau',
        'categorie': 'outil à main',
      }).toEntity();

      expect(fiche!.couleur, isNull);
      expect(fiche.capturedAt, isNull);
      expect(fiche.imagePath, isNull);
    });
  });

  group('la boîte des fiches', () {
    late Directory dossier;
    late Box<String> boite;
    late FichesLocalDataSource source;

    setUpAll(() async {
      dossier = await Directory.systemTemp.createTemp('fiches_test');
      Hive.init(dossier.path);
      boite = await Hive.openBox<String>('fiches_test');
    });

    setUp(() => boite.clear());

    tearDownAll(() => dossier.delete(recursive: true));

    FicheObjet fiche(String nom, DateTime quand) =>
        FicheObjet(nom: nom, capturedAt: quand);

    test('rend les plus récentes d\'abord', () async {
      source = FichesLocalDataSource(boite);
      await source.enregistrer(fiche('Vieille', DateTime.utc(2026, 1, 1)));
      await source.enregistrer(fiche('Récente', DateTime.utc(2026, 9, 7)));
      await source.enregistrer(fiche('Moyenne', DateTime.utc(2026, 5, 1)));

      expect(
        source.lire().map((f) => f.nom),
        ['Récente', 'Moyenne', 'Vieille'],
      );
    });

    test('deux photos du même objet font deux fiches, pas une', () async {
      // Un produit du comparateur se dédoublonne par identifiant, parce que
      // c'est une chose au catalogue. Une fiche est une observation : écraser
      // la première ferait disparaître ce qu'on avait vu ce jour-là.
      source = FichesLocalDataSource(boite);
      await source.enregistrer(fiche('Tournevis', DateTime.utc(2026, 9, 1)));
      await source.enregistrer(fiche('Tournevis', DateTime.utc(2026, 9, 7)));

      expect(source.lire(), hasLength(2));
    });

    test('la boîte est bornée, et ce sont les plus vieilles qui partent',
        () async {
      source = FichesLocalDataSource(boite);
      for (var i = 1; i <= FichesLocalDataSource.limite + 5; i++) {
        await source.enregistrer(
          fiche('Objet $i', DateTime.utc(2026, 1, 1).add(Duration(days: i))),
        );
      }

      final gardees = source.lire();
      expect(gardees, hasLength(FichesLocalDataSource.limite));
      expect(gardees.first.nom, 'Objet ${FichesLocalDataSource.limite + 5}');
      expect(gardees.last.nom, 'Objet 6');
    });

    test('une entrée illisible n\'emporte pas la liste', () async {
      source = FichesLocalDataSource(boite);
      await source.enregistrer(fiche('Bonne', DateTime.utc(2026, 9, 7)));
      await boite.put('2026-09-06T10:00:00.000Z', 'ceci n\'est pas du JSON');

      expect(source.lire().map((f) => f.nom), ['Bonne']);
    });

    test('une fiche supprimée ne revient pas', () async {
      source = FichesLocalDataSource(boite);
      final unique = fiche('Pince', DateTime.utc(2026, 9, 7));
      await source.enregistrer(unique);
      await source.supprimer(unique);

      expect(source.lire(), isEmpty);
    });
  });

  group('le scan enregistre', () {
    late Directory dossier;
    late Box<String> boite;

    setUpAll(() async {
      dossier = await Directory.systemTemp.createTemp('fiches_scan');
      Hive.init(dossier.path);
      boite = await Hive.openBox<String>('fiches_scan');
    });

    setUp(() => boite.clear());

    tearDownAll(() => dossier.delete(recursive: true));

    test('une identification réussie laisse une trace sur le disque', () async {
      final depot = FichesRepositoryImpl(FichesLocalDataSource(boite));
      final decrire = DecrireObjet(
        _FauxDepotScanner(const Success(FicheObjet(nom: 'Perceuse'))),
        depot,
      );

      await decrire(Uint8List(0), imagePath: '/tmp/percee.jpg');

      final gardees = FichesLocalDataSource(boite).lire();
      expect(gardees, hasLength(1));
      expect(gardees.single.nom, 'Perceuse');
      // La date et le chemin sont posés par le cas d'usage, pas par le modèle :
      // sans eux, la liste ne saurait ni trier ni afficher de vignette.
      expect(gardees.single.capturedAt, isNotNull);
      expect(gardees.single.imagePath, '/tmp/percee.jpg');
    });

    test('une identification échouée n\'écrit rien', () async {
      final depot = FichesRepositoryImpl(FichesLocalDataSource(boite));
      final decrire = DecrireObjet(
        _FauxDepotScanner(const Failure(NetworkException())),
        depot,
      );

      await decrire(Uint8List(0));

      expect(FichesLocalDataSource(boite).lire(), isEmpty);
    });

    test('un disque plein ne fait pas perdre la fiche à l\'écran', () async {
      // Elle vient d'être payée en requête et en attente, et elle est juste :
      // la refuser pour un défaut de rangement serait le pire des deux
      // résultats possibles.
      final decrire = DecrireObjet(
        _FauxDepotScanner(const Success(FicheObjet(nom: 'Scie'))),
        _DisquePlein(),
      );

      final resultat = await decrire(Uint8List(0));

      expect(resultat, isA<Success<FicheObjet>>());
      expect((resultat as Success<FicheObjet>).value.nom, 'Scie');
    });
  });
}
