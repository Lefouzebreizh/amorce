/// La cloison entre *Tout seul* et le reste de Look & Find.
///
/// **Pourquoi ce test existe.** Look & Find est bâti pour mener à l'achat : sa
/// fiche produit porte des marchands, des prix, des alternatives et un suivi de
/// prix. *Tout seul* s'adresse à un enfant de quatre à huit ans qui ne sait pas
/// encore lire. Les deux partagent le dépôt, la caméra et la voix — ils ne
/// doivent jamais partager le chemin d'achat.
///
/// La décision retenue le 31/08/2026 : **deux points d'entrée, un seul projet.**
/// `main.dart` monte Look & Find, un futur `main_tout_seul.dart` montera
/// l'application enfant. L'élagage de Dart ne conserve dans un binaire que ce
/// qui est atteignable depuis son point d'entrée : tant que `tout_seul`
/// n'importe rien du commerce, le code marchand **n'existe pas** dans
/// l'application enfant.
///
/// C'est ce qui transforme une intention en propriété vérifiable — et c'est ce
/// que ce fichier garde. Sans lui, un seul `import` ajouté un soir par commodité
/// remettrait un magasin dans les mains d'un enfant, sans qu'aucun autre test ne
/// bronche : tout continuerait de passer au vert.
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Ce que le point d'entrée enfant ne doit jamais pouvoir atteindre.
/// Nommé par fonctionnalité et non par fichier : un renommage interne ne doit
/// pas désarmer la garde en silence.
const _interdits = <String, String>{
  'product_detail': 'la fiche produit, qui porte marchands et prix',
  'favorites': 'le suivi de prix',
  'scanner': "l'identification marchande",
  'ar_view': "la vue en réalité augmentée d'un meuble",
};

void main() {
  final racine = Directory('lib/features/tout_seul');

  late List<File> sources;

  setUpAll(() {
    sources = racine
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) => f.path.endsWith('.dart'))
        .toList();
  });

  test('le module existe et porte des sources', () {
    expect(racine.existsSync(), isTrue,
        reason: 'lib/features/tout_seul est introuvable');
    expect(sources, isNotEmpty);
  });

  test("aucun fichier n'importe une fonctionnalité marchande", () {
    final fautes = <String>[];

    for (final fichier in sources) {
      for (final ligne in fichier.readAsLinesSync()) {
        final texte = ligne.trim();
        if (!texte.startsWith('import ') && !texte.startsWith('export ')) {
          continue;
        }
        for (final entree in _interdits.entries) {
          // Le nom de la fonctionnalité cherché **comme segment de chemin**,
          // et non préfixé de `features/`. Un import relatif s'écrit
          // `../../../product_detail/…` et ne contient jamais le mot
          // « features » : la première version de ce test cherchait
          // `features/<nom>/` et laissait donc passer exactement la forme que
          // le code prend en vrai. Trouvé par mutation, pas par relecture.
          if (texte.contains('/${entree.key}/')) {
            fautes.add('${fichier.path} atteint ${entree.key} '
                '— ${entree.value}\n    $texte');
          }
        }
      }
    }

    expect(fautes, isEmpty,
        reason: 'Le chemin d\'achat doit rester hors de portée de '
            'l\'application enfant :\n  ${fautes.join("\n  ")}');
  });

  test('le domaine ne dépend même pas de Flutter', () {
    // Une couche domaine qui importe Flutter cesse d'être éprouvable hors
    // widget, et s'accroche au thème de l'application qui l'héberge — ce qui
    // rendrait le second point d'entrée coûteux au lieu d'être gratuit.
    final domaine =
        sources.where((f) => f.path.contains('/domain/')).toList();

    expect(domaine, isNotEmpty, reason: 'aucune source de domaine trouvée');

    final fautes = domaine
        .where((f) => f
            .readAsLinesSync()
            .any((l) => l.trim().startsWith("import 'package:flutter/")))
        .map((f) => f.path)
        .toList();

    expect(fautes, isEmpty,
        reason: 'Le domaine de Tout seul doit rester en Dart pur :\n'
            '  ${fautes.join("\n  ")}');
  });
}
