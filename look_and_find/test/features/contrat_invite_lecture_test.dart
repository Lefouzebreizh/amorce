/// Le pacte entre ce qu'on demande au modèle et ce qu'on sait en lire.
///
/// `gemini_prompt.dart` déclare le schéma de la réponse ; `product_dto.dart`
/// déclare la lecture. Les deux sont écrits à la main, dans deux fichiers que
/// rien ne relie — et un champ ajouté d'un seul côté **disparaît en silence** :
/// soit le modèle le renvoie et personne ne le regarde, soit la fiche l'attend
/// et il n'arrive jamais. Aucun autre test ne peut le voir, puisque chacun
/// choisit son propre JSON d'exemple et n'y met que ce qu'il vient d'écrire.
///
/// La vérification ne se fait donc pas sur une liste de champs recopiée ici —
/// elle aurait le même défaut que ce qu'elle surveille. Elle fabrique un JSON
/// **depuis le schéma lui-même**, le fait passer par la lecture, puis le
/// ré-sérialise : ce qui manque au retour est exactement ce que la lecture
/// ignore.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/product_detail/data/models/product_dto.dart';
import 'package:look_and_find/features/scanner/data/datasources/gemini_prompt.dart';

/// Écrites par l'application après l'identification, jamais demandées au
/// modèle : leur absence du schéma est voulue.
const Set<String> _clesLocales = {'id', 'captured_at', 'image_path'};

void main() {
  group('Invite et lecture', () {
    test('chaque champ du schéma survit à un aller-retour par la fiche', () {
      final envoye = _exemple(GeminiPrompt.responseSchema) as Map<String, dynamic>;

      final fiche = ProductDto.fromJson(envoye).toEntity();
      expect(
        fiche,
        isNotNull,
        reason: 'Un JSON conforme au schéma doit toujours produire une fiche.',
      );

      final relu = ProductDto.fromEntity(fiche!).toJson();
      _comparer(GeminiPrompt.responseSchema, relu, 'racine');
    });

    test('la fiche n\'écrit aucun champ que le schéma ne demande pas', () {
      final declarees =
          (GeminiPrompt.responseSchema['properties']! as Map).keys.toSet();
      final envoye = _exemple(GeminiPrompt.responseSchema) as Map<String, dynamic>;
      final ecrites = ProductDto.fromEntity(
        ProductDto.fromJson(envoye).toEntity()!,
      ).toJson().keys.toSet();

      expect(
        ecrites.difference(declarees).difference(_clesLocales),
        isEmpty,
        reason:
            'Un champ écrit par la fiche et absent du schéma ne sera jamais '
            'renvoyé par le modèle : il restera vide en production.',
      );
    });
  });
}

/// Fabrique une valeur conforme à un nœud du schéma. Les valeurs sont choisies
/// pour franchir les filtres de la lecture — énumération respectée, URL en
/// http(s) — car ce test cherche les champs oubliés, pas les valeurs refusées,
/// qui sont couvertes par `product_dto_test.dart`.
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
      final valeurs = noeud['enum'] as List?;
      if (valeurs != null) return valeurs.first as String;
      if (cle.endsWith('url')) return 'https://exemple.fr/$cle.glb';
      return 'valeur-$cle';
  }
}

/// Descend le schéma et le JSON relu en parallèle. Un champ perdu par la
/// lecture arrive ici en `null` ou en clé absente, et le message dit lequel.
void _comparer(Map<String, Object?> noeud, Object? relu, String chemin) {
  switch (noeud['type']) {
    case 'OBJECT':
      expect(relu, isA<Map>(), reason: '$chemin : objet attendu.');
      final proprietes = noeud['properties']! as Map<String, Object?>;
      for (final entree in proprietes.entries) {
        final valeur = (relu! as Map)[entree.key];
        expect(
          valeur,
          isNotNull,
          reason:
              '$chemin.${entree.key} est déclaré dans le schéma de '
              'gemini_prompt.dart mais n\'a pas survécu à product_dto.dart. '
              'Le modèle le renverra et personne ne le lira.',
        );
        _comparer(
          entree.value! as Map<String, Object?>,
          valeur,
          '$chemin.${entree.key}',
        );
      }
    case 'ARRAY':
      expect(
        relu,
        allOf(isA<List>(), isNotEmpty),
        reason:
            '$chemin : la liste est vide après lecture, toutes ses entrées ont '
            'été écartées.',
      );
      _comparer(
        noeud['items']! as Map<String, Object?>,
        (relu! as List).first,
        '$chemin[0]',
      );
  }
}
