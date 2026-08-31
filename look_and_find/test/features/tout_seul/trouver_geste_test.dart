/// L'aiguillage de « Tout seul » : ce qu'il trouve, et surtout ce qu'il refuse.
///
/// Le refus est la branche la plus fréquente du module — le monde contient
/// beaucoup plus de dix-sept objets — donc la plus testée. Une porte qui
/// s'ouvre trop est plus grave ici qu'une porte qui reste fermée : l'enfant ne
/// sait pas lire, il n'ira pas recouper, il exécute.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/tout_seul/domain/corpus/corpus_gestes.dart';
import 'package:look_and_find/features/tout_seul/domain/entities/verdict_geste.dart';
import 'package:look_and_find/features/tout_seul/domain/usecases/trouver_geste.dart';

/// L'identifiant trouvé, ou `null` si le corpus a refusé.
String? _identifiantTrouve(String etiquette) {
  final verdict = TrouverGeste.pour(etiquette);
  return verdict is GesteTrouve ? verdict.geste.identifiant : null;
}

void main() {
  group('la normalisation de l\'étiquette', () {
    // L'étiquette ne vient pas d'un menu : elle vient d'un modèle de
    // reconnaissance, dans la casse et le nombre qu'il lui plaît.
    test('les majuscules ne changent rien', () {
      expect(_identifiantTrouve('LACET'), 'nouer_ses_lacets');
      expect(_identifiantTrouve('Lacet'), 'nouer_ses_lacets');
    });

    test('les accents ne changent rien', () {
      expect(_identifiantTrouve('BROSSE À DENTS'), 'se_brosser_les_dents');
      expect(_identifiantTrouve('brosse a dents'), 'se_brosser_les_dents');
      expect(_identifiantTrouve('echarpe'), 'nouer_son_echarpe');
      expect(_identifiantTrouve('écharpe'), 'nouer_son_echarpe');
    });

    test('le pluriel ne change rien', () {
      expect(_identifiantTrouve('lacets'), 'nouer_ses_lacets');
      expect(
          _identifiantTrouve('chaussures'), 'mettre_ses_chaussures_au_bon_pied');
      expect(_identifiantTrouve('cheveux'), 'se_coiffer');
    });

    test('l\'article de tête est retiré', () {
      expect(_identifiantTrouve('les chaussures'),
          'mettre_ses_chaussures_au_bon_pied');
      expect(_identifiantTrouve('un mouchoir'), 'se_moucher');
      expect(_identifiantTrouve('ma brosse à dents'), 'se_brosser_les_dents');
    });

    test('le « de » du milieu est conservé', () {
      // « tour de cou » perdrait son sens si l'on retirait le « de » partout,
      // et « cou » n'est l'étiquette de personne.
      expect(_identifiantTrouve('tour de cou'), 'nouer_son_echarpe');
      expect(_identifiantTrouve('brique de lait'), 'ouvrir_une_brique_de_lait');
      expect(_identifiantTrouve('crayon de couleur'), 'tenir_son_crayon');
    });

    test('tirets, apostrophes et espaces multiples se valent', () {
      expect(_identifiantTrouve('cache-nez'), 'nouer_son_echarpe');
      expect(_identifiantTrouve('cache nez'), 'nouer_son_echarpe');
      expect(_identifiantTrouve('t-shirt'), 'plier_un_tee_shirt');
      expect(_identifiantTrouve('  tee   shirt  '), 'plier_un_tee_shirt');
    });

    test('la même entrée donne toujours la même sortie', () {
      // La règle de pluriel est grossière — « tapis » devient « tapi ». Ce
      // n'est sans danger que parce qu'elle s'applique aux deux côtés.
      for (final brut in ['Lacets', 'lacet', 'LACET ', 'les lacets']) {
        expect(TrouverGeste.normaliser(brut), 'lacet', reason: brut);
      }
    });
  });

  group('le refus, qui est la branche la plus fréquente', () {
    test('un objet hors corpus est refusé, jamais rapproché', () {
      // Une ceinture se noue comme un lacet : c'est exactement le rapprochement
      // qu'on refuse de faire.
      for (final objet in [
        'ceinture',
        'télévision',
        'perceuse',
        'chat',
        'micro-ondes',
        'briquet',
        'couteau',
        'escabeau',
      ]) {
        final verdict = TrouverGeste.pour(objet);
        expect(verdict, isA<GesteInconnu>(), reason: objet);
        expect((verdict as GesteInconnu).raison, RaisonInconnue.horsCorpus,
            reason: objet);
      }
    });

    test('une étiquette vide dit qu\'on n\'a rien vu, pas qu\'on ne sait pas',
        () {
      // Deux refus différents, deux gestes différents à poser : remontrer
      // l\'objet, ou en montrer un autre. Les confondre fait tourner en rond.
      for (final vide in ['', '   ', '???', 'les']) {
        final verdict = TrouverGeste.pour(vide);
        expect(verdict, isA<GesteInconnu>(), reason: '« $vide »');
        expect((verdict as GesteInconnu).raison, RaisonInconnue.rienDeReconnu,
            reason: '« $vide »');
      }
    });

    test('tout refus porte une raison et un geste à poser', () {
      final verdict = TrouverGeste.pour('aspirateur') as GesteInconnu;
      expect(verdict.texte.trim(), isNotEmpty);
      expect(verdict.conseil.trim(), isNotEmpty);
      expect(verdict.conseil, endsWith('.'));
      expect(verdict.estTrouve, isFalse);
    });

    test('le conseil ne cite que des objets du corpus', () {
      final conseil = TrouverGeste.pour('perceuse') as GesteInconnu;
      for (final (_, tournure) in CorpusGestes.exemples) {
        expect(conseil.conseil, contains(tournure));
      }
    });
  });

  group('ce que rend un geste trouvé', () {
    test('le geste porte ses étapes prêtes à dire', () {
      final verdict = TrouverGeste.pour('Lacets') as GesteTrouve;
      expect(verdict.estTrouve, isTrue);
      expect(verdict.geste.etapes, isNotEmpty);
      expect(verdict.geste.etapes.first.phrase, endsWith('.'));
      expect(verdict.geste.nom, 'Nouer ses lacets');
    });

    test('l\'étiquette reconnue est rendue, normalisée', () {
      final verdict = TrouverGeste.pour('Les Chaussures') as GesteTrouve;
      expect(verdict.etiquetteReconnue, 'chaussure');
    });
  });

  group('l\'arbitrage des mots que deux gestes se disputent', () {
    test('le mot générique va au geste qu\'on apprend en premier', () {
      // Décision écrite en tête de `corpus_gestes.dart` : « chaussure » au bon
      // pied, « lacet » et « basket » au nœud. La retourner sans la discuter
      // ferait recevoir le tuto des lacets à un enfant qui ne sait pas encore
      // enfiler ses chaussures.
      expect(
          _identifiantTrouve('chaussure'), 'mettre_ses_chaussures_au_bon_pied');
      expect(_identifiantTrouve('lacet'), 'nouer_ses_lacets');
      expect(_identifiantTrouve('basket'), 'nouer_ses_lacets');
    });

    test('« brosse » seul n\'ouvre rien : deux brosses s\'en disputeraient', () {
      // La brosse à dents et la brosse à cheveux ont le même mot pour racine.
      // Refuser vaut mieux que servir l\'une des deux à pile ou face.
      expect(TrouverGeste.pour('brosse'), isA<GesteInconnu>());
      expect(_identifiantTrouve('brosse à dents'), 'se_brosser_les_dents');
      expect(_identifiantTrouve('brosse à cheveux'), 'se_coiffer');
    });
  });
}
