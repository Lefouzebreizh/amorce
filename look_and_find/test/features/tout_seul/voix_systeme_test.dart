/// Ce qui se vérifie d'une voix sans téléphone — et ce qui ne se vérifie pas.
///
/// **Ce que ce fichier prouve :** que l'adaptateur envoie au moteur du système
/// les bons ordres, dans le bon ordre, avec les bonnes valeurs. Le canal de
/// plateforme est intercepté et chaque appel noté.
///
/// **Ce qu'il ne prouve pas, et qu'aucun test ne prouvera ici :** qu'une phrase
/// sorte du haut-parleur. La synthèse est une capacité du système
/// d'exploitation ; elle ne se constate que sur un appareil. Les réglages sont
/// justes, leur effet reste à écouter.
library;

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/tout_seul/data/voix_systeme.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const canal = MethodChannel('flutter_tts');
  late List<MethodCall> appels;

  setUp(() {
    appels = [];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(canal, (appel) async {
      appels.add(appel);
      return 1;
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(canal, null);
  });

  List<String> methodes() => appels.map((a) => a.method).toList();

  test('préparer pose le français, le débit ralenti, et attend la fin', () async {
    await VoixSysteme().preparer();

    expect(methodes(), containsAll(<String>[
      'setLanguage',
      'setSpeechRate',
      'awaitSpeakCompletion',
    ]));

    final langue = appels.firstWhere((a) => a.method == 'setLanguage');
    expect(langue.arguments, VoixSysteme.langue,
        reason: 'Sans langue explicite, un téléphone en anglais lit le '
            'français à l\'anglaise et l\'enfant ne peut pas le savoir.');

    final debit = appels.firstWhere((a) => a.method == 'setSpeechRate');
    expect(debit.arguments, VoixSysteme.debit);
    expect(VoixSysteme.debit, lessThan(0.5),
        reason: 'Le défaut vise un adulte qui lit ses notifications ; une '
            'consigne gestuelle doit laisser le temps du geste.');
  });

  test('dire coupe la phrase en cours avant de lancer la suivante', () async {
    await VoixSysteme().dire('Croise les deux lacets.');

    expect(methodes(), ['stop', 'speak'],
        reason: 'Sans le stop, appuyer deux fois sur « suivant » empile les '
            'consignes et l\'enfant entend deux étapes à la fois.');

    final parole = appels.firstWhere((a) => a.method == 'speak');
    expect(parole.arguments, 'Croise les deux lacets.');
  });

  test('taire coupe la parole sans rien dire d\'autre', () async {
    await VoixSysteme().taire();
    expect(methodes(), ['stop']);
  });
}
