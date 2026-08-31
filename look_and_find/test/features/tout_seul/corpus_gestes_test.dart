/// Ce que le corpus de « Tout seul » doit tenir, geste par geste.
///
/// Ces tests ne vérifient pas du code : ils vérifient un **texte**, et c'est
/// délibéré. Le seul défaut qui peut atteindre un enfant ici est une phrase
/// mal écrite — trop longue, avec deux gestes dedans, ou avec un mot qu'il
/// n'emploie pas. Aucune de ces trois choses ne fait planter quoi que ce soit.
///
/// Ils ne remplacent pas la relecture à voix haute par un adulte, et ne le
/// prétendent pas : une phrase juste, courte et vide de sens les passerait
/// toutes. Ils fixent le mesurable pour que la relecture porte sur le reste.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/tout_seul/domain/corpus/corpus_gestes.dart';
import 'package:look_and_find/features/tout_seul/domain/entities/verdict_geste.dart';
import 'package:look_and_find/features/tout_seul/domain/usecases/trouver_geste.dart';

/// Le vocabulaire écarté, avec la raison. Deux familles :
///
/// - les verbes de notice — un adulte les lit sans broncher, un enfant de cinq
///   ans reste immobile devant ;
/// - les mots justes mais savants, ceux qu'on écrit sans y penser parce qu'on
///   les connaît. « Paume », « curseur » et « anse » étaient dans la première
///   version du corpus et en ont été retirés : c'est de là que vient la liste.
const _motsProscrits = [
  'effectu', 'réalis', 'procéd', 'positionn', 'ajust', 'manipul',
  'exécut', 'opèr', 'préalable', 'approprié', 'adéquat', 'initial',
  'paume', 'curseur', 'anse', 'narine', 'index', 'phalange', 'extrémité',
];

void main() {
  final gestes = CorpusGestes.gestes;

  group('la forme du corpus', () {
    test('quinze à dix-sept gestes', () {
      expect(gestes.length, inInclusiveRange(15, 17));
    });

    test('les identifiants sont uniques et en minuscules', () {
      final vus = <String>{};
      for (final geste in gestes) {
        expect(geste.identifiant, matches(RegExp(r'^[a-z][a-z_]+$')),
            reason: geste.identifiant);
        expect(vus.add(geste.identifiant), isTrue,
            reason: 'identifiant en double : ${geste.identifiant}');
      }
    });

    test('chaque geste a un nom lisible', () {
      for (final geste in gestes) {
        expect(geste.nom.trim(), isNotEmpty, reason: geste.identifiant);
        expect(geste.nom, geste.nom.trim(), reason: geste.identifiant);
      }
    });

    test('quatre à sept étapes par geste', () {
      for (final geste in gestes) {
        expect(geste.etapes.length, inInclusiveRange(4, 7),
            reason: '${geste.identifiant} en a ${geste.etapes.length}');
      }
    });
  });

  group('les phrases dites à l\'enfant', () {
    test('aucune étape vide', () {
      for (final geste in gestes) {
        for (final etape in geste.etapes) {
          expect(etape.phrase.trim(), isNotEmpty, reason: geste.identifiant);
        }
      }
    });

    test('aucune étape de plus de quatre-vingts caractères', () {
      for (final geste in gestes) {
        for (final etape in geste.etapes) {
          expect(etape.phrase.length, lessThanOrEqualTo(80),
              reason: '${geste.identifiant} : « ${etape.phrase} » '
                  '(${etape.phrase.length} caractères)');
        }
      }
    });

    test('une seule phrase par étape, terminée par un point', () {
      for (final geste in gestes) {
        for (final etape in geste.etapes) {
          expect(etape.phrase, endsWith('.'),
              reason: '${geste.identifiant} : « ${etape.phrase} »');
          // Un point au milieu, c'est deux gestes dans la même étape : le
          // second se perd à l'écoute.
          expect('.'.allMatches(etape.phrase).length, 1,
              reason: '${geste.identifiant} : « ${etape.phrase} »');
        }
      }
    });

    test('chaque phrase commence par une majuscule', () {
      for (final geste in gestes) {
        for (final etape in geste.etapes) {
          final premiere = etape.phrase.substring(0, 1);
          expect(premiere, premiere.toUpperCase(),
              reason: '${geste.identifiant} : « ${etape.phrase} »');
        }
      }
    });

    test('aucun mot de notice ni mot savant', () {
      for (final geste in gestes) {
        for (final etape in geste.etapes) {
          final phrase = etape.phrase.toLowerCase();
          for (final proscrit in _motsProscrits) {
            expect(phrase.contains(proscrit), isFalse,
                reason: '${geste.identifiant} : « ${etape.phrase} » '
                    'contient « $proscrit »');
          }
        }
      }
    });

    test('chaque étape porte un mot-clé d\'illustration, jamais un chemin', () {
      for (final geste in gestes) {
        for (final etape in geste.etapes) {
          expect(etape.illustration, matches(RegExp(r'^[a-z][a-z-]*[a-z]$')),
              reason: '${geste.identifiant} : « ${etape.illustration} »');
        }
      }
    });

    test('deux étapes d\'un même geste ne se répètent pas', () {
      for (final geste in gestes) {
        final phrases = geste.etapes.map((e) => e.phrase).toSet();
        expect(phrases.length, geste.etapes.length,
            reason: '${geste.identifiant} répète une étape');
      }
    });
  });

  group('les étiquettes qui ouvrent un geste', () {
    test('chaque geste porte au moins deux étiquettes non vides', () {
      for (final geste in gestes) {
        expect(geste.etiquettes.length, greaterThanOrEqualTo(2),
            reason: geste.identifiant);
        for (final etiquette in geste.etiquettes) {
          expect(etiquette.trim(), isNotEmpty, reason: geste.identifiant);
        }
      }
    });

    test('aucune étiquette n\'est revendiquée par deux gestes', () {
      // Le défaut qu'on cherche ici ne casse rien : il fait répondre l'un ou
      // l'autre selon l'ordre d'écriture du corpus, et le même objet montré
      // deux fois donne alors deux tutos différents.
      final proprietaire = <String, String>{};
      final conflits = <String>[];
      for (final geste in gestes) {
        for (final etiquette in geste.etiquettes) {
          final clef = TrouverGeste.normaliser(etiquette);
          final deja = proprietaire[clef];
          if (deja != null && deja != geste.identifiant) {
            conflits.add('« $clef » : $deja et ${geste.identifiant}');
          }
          proprietaire[clef] = geste.identifiant;
        }
      }
      expect(conflits, isEmpty, reason: conflits.join(' ; '));
    });

    test('une étiquette ne se répète pas dans un même geste', () {
      for (final geste in gestes) {
        final clefs =
            geste.etiquettes.map(TrouverGeste.normaliser).toSet();
        expect(clefs.length, geste.etiquettes.length,
            reason: '${geste.identifiant} répète une étiquette');
      }
    });

    test('chaque geste du corpus est atteignable par chacune de ses étiquettes',
        () {
      // Le test qui compte : un geste que rien ne trouve est un geste qui
      // n'existe pas. Une étiquette que la normalisation écorche d'un côté
      // seulement tomberait ici.
      for (final geste in gestes) {
        for (final etiquette in geste.etiquettes) {
          final verdict = TrouverGeste.pour(etiquette);
          expect(verdict, isA<GesteTrouve>(),
              reason: '${geste.identifiant} : « $etiquette » ne trouve rien');
          expect((verdict as GesteTrouve).geste.identifiant, geste.identifiant,
              reason: '« $etiquette » mène ailleurs');
        }
      }
    });
  });

  group('les objets cités par un refus', () {
    test('chacun ouvre vraiment un geste du corpus', () {
      // Sans ce test, retirer un geste du corpus laisserait le refus conseiller
      // un objet qui mène à un second refus — et personne ne le verrait.
      for (final (etiquette, _) in CorpusGestes.exemples) {
        expect(TrouverGeste.pour(etiquette), isA<GesteTrouve>(),
            reason: 'le refus cite « $etiquette », que le corpus ignore');
      }
    });

    test('la tournure dite reprend bien l\'objet', () {
      for (final (etiquette, tournure) in CorpusGestes.exemples) {
        final racine = etiquette.split(' ').first;
        expect(tournure.toLowerCase(), contains(racine),
            reason: '« $tournure » ne parle pas de « $etiquette »');
      }
    });
  });
}
