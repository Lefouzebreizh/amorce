/// La table des émojis, comparée au corpus dans les deux sens.
///
/// **Pourquoi les deux sens.** Un geste sans émoji laisse une tuile morte dans
/// la grille — l'enfant ne peut pas la reconnaître, donc le geste n'existe pas
/// pour lui. Un émoji sans geste est plus discret et plus durable : il survit à
/// un identifiant renommé, ne casse rien, et fait croire que la table est à
/// jour. Les deux se vérifient donc, et la seconde vérification est celle qui
/// sert le plus longtemps.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/tout_seul/domain/corpus/corpus_gestes.dart';
import 'package:look_and_find/features/tout_seul/presentation/emojis.dart';

void main() {
  test('chaque geste du corpus a son émoji', () {
    final sansEmoji = CorpusGestes.gestes
        .where((g) => !EmojisGestes.parIdentifiant.containsKey(g.identifiant))
        .map((g) => g.identifiant)
        .toList();

    expect(sansEmoji, isEmpty,
        reason: 'Un geste sans émoji est une tuile que l\'enfant ne peut pas '
            'reconnaître :\n  ${sansEmoji.join("\n  ")}');
  });

  test('aucun émoji ne désigne un geste qui n\'existe plus', () {
    final identifiants =
        CorpusGestes.gestes.map((g) => g.identifiant).toSet();
    final orphelins = EmojisGestes.parIdentifiant.keys
        .where((clef) => !identifiants.contains(clef))
        .toList();

    expect(orphelins, isEmpty,
        reason: 'Une entrée qui ne correspond à aucun geste fait croire que '
            'la table est à jour :\n  ${orphelins.join("\n  ")}');
  });

  test('deux gestes n\'ont jamais le même émoji', () {
    final vus = <String, String>{};
    final collisions = <String>[];

    EmojisGestes.parIdentifiant.forEach((identifiant, emoji) {
      final deja = vus[emoji];
      if (deja != null) {
        collisions.add('$emoji : $deja et $identifiant');
      }
      vus[emoji] = identifiant;
    });

    expect(collisions, isEmpty,
        reason: 'Deux tuiles identiques ne se départagent que par le texte, '
            'que l\'enfant ne lit pas :\n  ${collisions.join("\n  ")}');
  });

  test('aucun émoji vide, et le repli n\'est jamais atteint', () {
    for (final entree in EmojisGestes.parIdentifiant.entries) {
      expect(entree.value.trim(), isNotEmpty, reason: entree.key);
    }
    for (final geste in CorpusGestes.gestes) {
      expect(EmojisGestes.pour(geste.identifiant), isNot('❓'),
          reason: '${geste.identifiant} tombe sur le point d\'interrogation '
              'de repli, qui n\'illustre rien.');
    }
  });
}
