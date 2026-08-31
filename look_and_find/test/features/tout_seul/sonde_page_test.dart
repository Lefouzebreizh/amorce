/// La sonde conduite sans appareil photo.
///
/// La prise de vue est injectable, et c'est la seule raison pour laquelle cet
/// écran est éprouvable : la boucle, l'enchaînement, la panne et la libération
/// du moteur se mesurent ici. Ce qui reste sur l'appareil : que l'objectif
/// s'ouvre, et que ce qu'il voit ressemble à ce qu'on vise.
///
/// **`pumpAndSettle` est inutilisable sur cet écran**, et pour la même raison
/// que sur le viseur de Look & Find : la sonde relance une lecture toutes les
/// 700 ms, indéfiniment. Il n'y a pas d'état stable à atteindre. L'horloge
/// s'avance donc à la main, et chaque test démonte l'écran avant de finir —
/// sans quoi le minuteur armé fait échouer le test sur une alarme en attente.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/tout_seul/domain/reconnaissance.dart';
import 'package:look_and_find/features/tout_seul/presentation/pages/sonde_page.dart';
import 'package:look_and_find/features/tout_seul/presentation/widgets/tableau_etiquettes.dart';

import 'fausse_reconnaissance.dart';

void main() {
  /// Une prise de vue en boîte : elle rend les chemins l'un après l'autre, puis
  /// répète le dernier. C'est ce qui permet de distinguer une seconde lecture
  /// d'un simple réaffichage de la première.
  ({Future<String?> Function() prise, List<String> prises}) enBoite(
    List<String> chemins,
  ) {
    final prises = <String>[];
    return (
      prise: () async {
        final chemin = chemins[prises.length.clamp(0, chemins.length - 1)];
        prises.add(chemin);
        return chemin;
      },
      prises: prises,
    );
  }

  Future<void> monter(
    WidgetTester tester,
    Reconnaissance moteur, {
    Future<String?> Function()? prise,
  }) async {
    await tester.pumpWidget(
      MaterialApp(
        home: SondePage(reconnaissance: moteur, priseDeVue: prise),
      ),
    );
    // Deux images : la première monte l'écran, la seconde laisse la lecture
    // lancée dans `initState` se terminer et reconstruire.
    await tester.pump();
    await tester.pump();
  }

  /// Démonte l'écran : le minuteur armé est annulé dans `dispose`, faute de
  /// quoi le test échoue sur une alarme restée en attente.
  Future<void> demonter(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  }

  testWidgets('la sonde lit dès l\'ouverture, sans qu\'on touche à rien',
      (tester) async {
    final moteur = FausseReconnaissance(partout: const [
      EtiquetteVue('Shoe', 0.92),
      EtiquetteVue('Footwear', 0.88),
    ]);
    final camera = enBoite(['/tmp/a.jpg']);

    await monter(tester, moteur, prise: camera.prise);

    expect(moteur.observes, ['/tmp/a.jpg'],
        reason: 'Pas de photo à valider, pas de bouton « analyser » : le geste '
            'utile est de viser.');
    expect(find.text('Shoe'), findsOneWidget);
    expect(find.text('Footwear'), findsOneWidget);

    await demonter(tester);
  });

  testWidgets('elle enchaîne une seconde lecture toute seule', (tester) async {
    final moteur = FausseReconnaissance(parChemin: {
      '/tmp/a.jpg': const [EtiquetteVue('Shoe', 0.92)],
      '/tmp/b.jpg': const [EtiquetteVue('Toothbrush', 0.77)],
    });
    final camera = enBoite(['/tmp/a.jpg', '/tmp/b.jpg']);

    await monter(tester, moteur, prise: camera.prise);
    expect(find.text('Shoe'), findsOneWidget);

    // On ne touche à rien : seul le temps passe.
    await tester.pump(SondePage.repos + const Duration(milliseconds: 50));
    await tester.pump();

    expect(moteur.observes, ['/tmp/a.jpg', '/tmp/b.jpg']);
    expect(find.text('Toothbrush'), findsOneWidget);
    expect(find.text('Shoe'), findsNothing,
        reason: 'Le relevé montre ce qui est visé maintenant. Une étiquette '
            'qui traîne d\'un objet à l\'autre fabriquerait une '
            'correspondance fausse.');

    await demonter(tester);
  });

  testWidgets('le compteur de lectures dit que la sonde est vivante',
      (tester) async {
    final moteur = FausseReconnaissance(partout: const []);
    final camera = enBoite(['/tmp/a.jpg']);

    await monter(tester, moteur, prise: camera.prise);

    expect(find.textContaining(SondePage.prefixeLecture), findsOneWidget,
        reason: 'Devant un objet que le moteur ne reconnaît pas, l\'écran est '
            'vide : sans compteur, rien ne distingue une sonde muette d\'une '
            'sonde figée.');

    await demonter(tester);
  });

  testWidgets('un moteur qui refuse arrête la sonde et l\'écrit en toutes lettres',
      (tester) async {
    final moteur = FausseReconnaissance(
      leve: StateError('modèle introuvable'),
    );
    final camera = enBoite(['/tmp/a.jpg']);

    await monter(tester, moteur, prise: camera.prise);

    expect(find.textContaining(SondePage.prefixePanne), findsOneWidget);
    expect(find.textContaining('modèle introuvable'), findsOneWidget,
        reason: 'C\'est un instrument : celui qui le tient doit pouvoir '
            'recopier l\'erreur dans un message, pas la deviner.');

    // Et surtout : elle ne réessaie pas en boucle sur une panne qui ne se
    // débloque pas toute seule.
    await tester.pump(SondePage.repos * 3);
    await tester.pump();
    expect(moteur.observes, hasLength(1));

    await demonter(tester);
  });

  testWidgets('quitter la sonde rend le moteur au système', (tester) async {
    final moteur = FausseReconnaissance(partout: const []);
    final camera = enBoite(['/tmp/a.jpg']);

    await monter(tester, moteur, prise: camera.prise);
    await demonter(tester);

    expect(moteur.liberations, 1);
  });

  testWidgets('sans appareil photo, la sonde le dit au lieu de tourner sans fin',
      (tester) async {
    // Aucune prise de vue injectée : l'écran ouvre le vrai appareil photo, et
    // le greffon n'existe pas sur une machine de vérification. C'est le seul
    // moyen d'éprouver ce chemin-là ici — et il vaut d'être éprouvé : le
    // viseur de Look & Find a déjà fait tourner un indicateur indéfiniment
    // pour n'avoir pas traité ce cas.
    final moteur = FausseReconnaissance(partout: const []);

    // **`runAsync` est indispensable ici**, et la raison a coûté un
    // aller-retour : dans un test de widget, l'horloge est simulée, mais la
    // réponse d'un canal de plateforme — ici le refus « MissingPluginException »
    // — voyage par la vraie boucle d'événements. Avancer l'horloge à la main
    // ne la fait jamais arriver : l'écran reste sur « Vise un objet… » et le
    // test conclut que la panne n'est pas signalée, alors qu'elle n'a pas
    // encore eu lieu. C'est la parade que le dépôt applique déjà aux écritures
    // Hive, pour exactement la même cause.
    await tester.runAsync(() async {
      await tester.pumpWidget(
        MaterialApp(home: SondePage(reconnaissance: moteur)),
      );
      await Future<void>.delayed(const Duration(milliseconds: 50));
    });
    await tester.pump();

    expect(find.textContaining(SondePage.prefixePanne), findsOneWidget);
    expect(find.byType(TableauEtiquettes), findsNothing);

    await demonter(tester);
  });
}
