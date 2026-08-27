/// Rejoue une réponse brute du modèle à travers la vraie lecture.
///
/// C'est la moitié du diagnostic qui ne demande **ni clé, ni réseau, ni
/// téléphone** : la réponse est déjà là, copiée depuis l'écran « Réponse du
/// modèle » de l'application. En deux secondes, elle dit si la fiche fausse
/// vient de l'invite ou de la lecture — la seule question dont dépend le
/// fichier à corriger.
///
///     dart run tool/rejouer.dart reponse.json
///     pbpaste | dart run tool/rejouer.dart -
///
/// Le fichier attendu est ce que le bouton « Copier » met dans le presse-papier :
/// le JSON du modèle, sans l'enveloppe de l'API.
library;

import 'dart:convert';
import 'dart:io';

import 'lecture_fiche.dart';

Future<void> main(List<String> arguments) async {
  if (arguments.isEmpty || arguments.first == '--aide') {
    stdout.writeln(
      'Usage : dart run tool/rejouer.dart <reponse.json|->\n'
      '\n'
      'Fait passer une réponse du modèle par la lecture de l\'application et\n'
      'dit ce qui se perd entre les deux.',
    );
    exit(arguments.isEmpty ? 64 : 0);
  }

  final source = arguments.first;
  final texte = source == '-'
      ? await stdin.transform(utf8.decoder).join()
      : await File(source).readAsString();

  final Map<String, dynamic> json;
  try {
    json = jsonDecode(texte.trim()) as Map<String, dynamic>;
  } on FormatException catch (erreur) {
    // Ce cas mérite son propre message : avec `responseSchema`, le modèle ne
    // peut normalement pas renvoyer autre chose que du JSON. Un texte non
    // décodable signale que le contrat avec l'API a changé — pas une mauvaise
    // photo, et surtout pas un défaut de l'invite.
    stderr.writeln(
      'La réponse n\'est pas un objet JSON : ${erreur.message}\n'
      'Avec responseSchema, cela signale un changement côté API plutôt qu\'un '
      'problème d\'invite.',
    );
    exit(65);
  }

  stdout.writeln(rapport(analyser(json)));
}
