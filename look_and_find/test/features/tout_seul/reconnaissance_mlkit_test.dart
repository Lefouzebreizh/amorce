/// Ce qui se vérifie d'un moteur de reconnaissance sans téléphone — et ce qui
/// ne se vérifie pas.
///
/// **Ce que ce fichier prouve :** que l'adaptateur appelle le bon canal, avec
/// le seuil demandé et le chemin de l'image, qu'il remonte chaque étiquette
/// entière — texte *et* confiance — dans un ordre stable, et qu'il rend le
/// moteur au système. Le canal de plateforme est intercepté et chaque appel
/// noté, exactement comme dans `voix_systeme_test.dart`.
///
/// **Ce qu'il ne prouve pas, et qu'aucun test ne prouvera ici :** qu'une photo
/// de lacets produise « Shoe ». Le modèle est natif ; il n'y a rien derrière le
/// canal sur une machine de vérification. C'est précisément ce que la sonde va
/// relever sur un appareil, et c'est pour cela qu'elle existe.
library;

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/tout_seul/data/reconnaissance_mlkit.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const canal = MethodChannel('google_mlkit_image_labeler');
  late List<MethodCall> appels;
  late List<Map<String, Object?>> reponse;

  setUp(() {
    appels = [];
    reponse = [];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(canal, (appel) async {
      appels.add(appel);
      return appel.method == 'vision#startImageLabelDetector' ? reponse : null;
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(canal, null);
  });

  // La plateforme rend `text`, que le paquet range dans `ImageLabel.label` :
  // les deux noms désignent la même donnée. Écrite avec `label`, cette fausse
  // réponse rendrait des étiquettes vides et l'on croirait à un défaut
  // d'adaptateur.
  Map<String, Object?> vue(String texte, double confiance, int index) => {
        'text': texte,
        'confidence': confiance,
        'index': index,
      };

  test('les étiquettes remontent entières et triées', () async {
    reponse = [
      vue('Textile', 0.61, 3),
      vue('Shoe', 0.92, 1),
      vue('Footwear', 0.88, 2),
    ];

    final vues = await ReconnaissanceMlkit().observer('/tmp/photo.jpg');

    expect(vues.map((e) => e.texte), ['Shoe', 'Footwear', 'Textile']);
    expect(vues.map((e) => e.confiance), [0.92, 0.88, 0.61],
        reason: 'La confiance est la moitié de la mesure : une étiquette juste '
            'à 0,34 ne se distingue d\'une fausse à 0,34 que par ce nombre.');
  });

  test('le seuil part sous le défaut du paquet', () async {
    await ReconnaissanceMlkit().observer('/tmp/photo.jpg');

    final options = (appels.single.arguments
        as Map<Object?, Object?>)['options'] as Map<Object?, Object?>;

    expect(options['confidenceThreshold'], ReconnaissanceMlkit.seuilDeSonde);
    expect(ReconnaissanceMlkit.seuilDeSonde, lessThan(0.5),
        reason: 'Le défaut du paquet est 0,5. À ce stade on cherche à voir ce '
            'que le moteur propose, pas à filtrer : une étiquette juste mais '
            'peu sûre est exactement ce qui décidera de la table.');
  });

  test('le chemin de l\'image part sous la clef que le natif attend', () async {
    await ReconnaissanceMlkit().observer('/tmp/lacets.jpg');

    final image = (appels.single.arguments
        as Map<Object?, Object?>)['imageData'] as Map<Object?, Object?>;

    // `InputImage.toJson` écrit `path`, et non `filePath` comme le nomme le
    // champ Dart. Deux noms pour la même donnée, et rien ne le signale : une
    // clef fausse ne lève pas, elle rend une liste vide.
    expect(image['path'], '/tmp/lacets.jpg');
    expect(image['type'], 'file');
  });

  test('une image où rien n\'est reconnu rend une liste vide', () async {
    reponse = [];

    final vues = await ReconnaissanceMlkit().observer('/tmp/mur.jpg');

    expect(vues, isEmpty,
        reason: 'Jamais une exception : une lecture muette est une mesure, pas '
            'un échec.');
  });

  test('libérer ferme le détecteur', () async {
    await ReconnaissanceMlkit().liberer();

    expect(appels.single.method, 'vision#closeImageLabelDetector',
        reason: 'Un détecteur laissé ouvert retient de la mémoire native que '
            'le ramasse-miettes de Dart ne voit pas.');
  });
}
