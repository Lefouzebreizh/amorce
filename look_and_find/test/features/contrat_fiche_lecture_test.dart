/// Le pacte entre l'invite de la version un et sa lecture.
///
/// `fiche_prompt.dart` déclare ce que le modèle doit renvoyer,
/// `fiche_objet_dto.dart` ce qu'on sait en lire. Rien ne relie les deux
/// fichiers, et un champ ajouté d'un seul côté **disparaît en silence** : soit
/// le modèle le renvoie et personne ne le regarde, soit la fiche l'attend et il
/// n'arrive jamais. Aucun test métier ne peut le voir, chacun choisissant son
/// propre JSON d'exemple.
///
/// La vérification ne repose donc pas sur une liste de champs recopiée ici —
/// elle aurait le défaut qu'elle surveille. Elle fabrique un JSON **depuis le
/// schéma**, le fait passer par la lecture, puis le ré-sérialise : ce qui manque
/// au retour est exactement ce que la lecture ignore.
///
/// Jumeau de `contrat_invite_lecture_test.dart`, qui garde l'autre paire.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/fiche_objet/data/models/fiche_objet_dto.dart';
import 'package:look_and_find/features/scanner/data/datasources/fiche_prompt.dart';

void main() {
  group('Invite et lecture de la fiche v1', () {
    test('chaque champ du schéma survit à un aller-retour', () {
      final envoye = _exemple(FichePrompt.responseSchema) as Map<String, dynamic>;

      final fiche = FicheObjetDto.fromJson(envoye).toEntity();
      expect(
        fiche,
        isNotNull,
        reason: 'Un JSON conforme au schéma doit toujours produire une fiche.',
      );

      final relu = FicheObjetDto.fromEntity(fiche!).toJson();
      final declarees =
          (FichePrompt.responseSchema['properties']! as Map).keys.cast<String>();

      for (final cle in declarees) {
        expect(
          relu[cle],
          isNotNull,
          reason:
              '$cle est déclaré dans fiche_prompt.dart mais n\'a pas survécu '
              'à fiche_objet_dto.dart. Le modèle le renverra et personne ne '
              'le lira.',
        );
        if (relu[cle] is List) {
          expect(
            relu[cle] as List,
            isNotEmpty,
            reason: '$cle revient vide : toutes ses entrées ont été écartées.',
          );
        }
      }
    });

    test('la fiche n\'écrit aucun champ que le schéma ne demande pas', () {
      final declarees =
          (FichePrompt.responseSchema['properties']! as Map).keys.toSet();
      final envoye = _exemple(FichePrompt.responseSchema) as Map<String, dynamic>;
      final ecrites = FicheObjetDto.fromEntity(
        FicheObjetDto.fromJson(envoye).toEntity()!,
      ).toJson().keys.toSet();

      expect(
        ecrites.difference(declarees),
        isEmpty,
        reason:
            'Un champ écrit par la fiche et absent du schéma ne sera jamais '
            'renvoyé par le modèle : il restera vide en production.',
      );
    });

    test('l\'invite interdit ce que la version un ne veut pas', () {
      // Le périmètre est une décision produit, pas une préférence de rédaction :
      // un prix ou une marque réapparus dans l'invite se verraient d'abord sur
      // la fiche d'un utilisateur.
      final texte = FichePrompt.instruction.toLowerCase();
      expect(texte, contains('sans marque'));
      expect(texte, contains('ni prix'));
      expect(
        (FichePrompt.responseSchema['properties']! as Map).keys,
        isNot(anyElement(anyOf('price', 'prix', 'merchants', 'brand'))),
      );
    });
  });
}

/// Fabrique une valeur conforme à un nœud du schéma, choisie pour franchir les
/// filtres de la lecture : ce test cherche les champs oubliés, pas les valeurs
/// refusées, que `fiche_objet_dto_test.dart` couvre.
Object _exemple(Map<String, Object?> noeud, [String cle = '']) {
  switch (noeud['type']) {
    case 'OBJECT':
      final proprietes = noeud['properties']! as Map<String, Object?>;
      return {
        for (final entree in proprietes.entries)
          entree.key: _exemple(
            entree.value! as Map<String, Object?>,
            entree.key,
          ),
      };
    case 'ARRAY':
      return [_exemple(noeud['items']! as Map<String, Object?>, cle)];
    case 'NUMBER':
      return 12.5;
    case 'BOOLEAN':
      return true;
    default:
      return 'valeur-$cle';
  }
}
