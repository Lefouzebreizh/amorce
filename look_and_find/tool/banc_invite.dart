/// Le banc d'essai de l'invite : une photo entre, la réponse du modèle sort.
///
/// **Ce qu'il fait gagner.** Sans lui, éprouver une modification de
/// `gemini_prompt.dart` demande de pousser, d'attendre la construction de
/// l'APK, de l'installer et de rescanner — vingt minutes pour un mot changé.
/// Ici, la même boucle dure cinq secondes, et elle porte sur *la même* invite,
/// *le même* schéma et *le même* modèle que l'application, puisque tout est lu
/// dans les constantes du dépôt plutôt que recopié.
///
///     export GEMINI_API_KEY=…
///     dart run tool/banc_invite.dart photo.jpg
///     dart run tool/banc_invite.dart photo.jpg --brut reponse.json
///     dart run tool/banc_invite.dart --modeles
///
/// `--modeles` répond à la question qui bloque tout le reste quand un modèle
/// est retiré : lesquels sont servis aujourd'hui pour cette clé. Un modèle
/// arrêté fait échouer *tous* les scans d'un coup, et la panne ressemble à un
/// problème de réseau (voir `ModelUnavailableException`).
///
/// La clé n'est lue que dans l'environnement : elle n'entre pas dans le dépôt,
/// pas dans l'historique de commandes si elle est exportée, et pas dans le
/// binaire.
library;

import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:image/image.dart' as img;
import 'package:look_and_find/core/constants/app_config.dart';
import 'package:look_and_find/features/scanner/data/datasources/gemini_prompt.dart';

import 'lecture_fiche.dart';

Future<void> main(List<String> arguments) async {
  final cle = Platform.environment['GEMINI_API_KEY'] ?? '';
  if (cle.isEmpty) {
    stderr.writeln(
      'Aucune clé : export GEMINI_API_KEY=… avant de lancer.\n'
      'La même clé que celle saisie dans l\'application convient.',
    );
    exit(78);
  }

  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.geminiBaseUrl,
      connectTimeout: AppConfig.connectTimeout,
      receiveTimeout: AppConfig.receiveTimeout,
    ),
  );

  if (arguments.contains('--modeles')) {
    await _listerModeles(dio, cle);
    return;
  }

  final photos = arguments.where((a) => !a.startsWith('--')).toList();
  if (photos.isEmpty) {
    stdout.writeln(
      'Usage : dart run tool/banc_invite.dart <photo.jpg> [--brut sortie.json]\n'
      '        dart run tool/banc_invite.dart --modeles',
    );
    exit(64);
  }

  final indexBrut = arguments.indexOf('--brut');
  final sortieBrut = indexBrut >= 0 && indexBrut + 1 < arguments.length
      ? arguments[indexBrut + 1]
      : null;

  for (final chemin in photos) {
    if (photos.length > 1) stdout.writeln('══ $chemin');
    await _identifier(dio, cle, chemin, photos.length == 1 ? sortieBrut : null);
  }
}

Future<void> _listerModeles(Dio dio, String cle) async {
  final reponse = await dio.get<Map<String, dynamic>>(
    '/models',
    queryParameters: {'key': cle},
  );
  final modeles = (reponse.data?['models'] as List? ?? const [])
      .cast<Map<String, dynamic>>()
      .where(
        (m) =>
            (m['supportedGenerationMethods'] as List?)?.contains(
              'generateContent',
            ) ??
            false,
      )
      .map((m) => (m['name'] as String).replaceFirst('models/', ''))
      .toList();

  stdout.writeln('── Modèles servis pour cette clé (generateContent)');
  for (final modele in modeles) {
    final actuel = modele == AppConfig.geminiModel ? '  ← AppConfig' : '';
    stdout.writeln('  $modele$actuel');
  }
  if (!modeles.contains(AppConfig.geminiModel)) {
    stdout.writeln(
      '\n  ⚠ ${AppConfig.geminiModel} n\'est pas dans la liste : tous les '
      'scans\n    échouent en 404 tant que AppConfig.geminiModel n\'est pas '
      'changé.',
    );
  }
}

Future<void> _identifier(
  Dio dio,
  String cle,
  String chemin,
  String? sortieBrut,
) async {
  final octets = await File(chemin).readAsBytes();
  // Même réduction que `ImageCompressor`, refaite ici parce que celui-ci passe
  // par `compute`, absent hors Flutter. Les réglages viennent d'`AppConfig` :
  // ce que voit le banc est ce que voit l'application.
  final decodee = img.decodeImage(octets);
  if (decodee == null) {
    stderr.writeln('Image illisible : $chemin');
    exit(65);
  }
  final reduite = decodee.width > AppConfig.maxImageWidth
      ? img.copyResize(decodee, width: AppConfig.maxImageWidth)
      : decodee;
  final jpeg = img.encodeJpg(reduite, quality: AppConfig.imageQuality);

  final debut = DateTime.now();
  final Response<Map<String, dynamic>> reponse;
  try {
    reponse = await dio.post<Map<String, dynamic>>(
      '/models/${AppConfig.geminiModel}:generateContent',
      queryParameters: {'key': cle},
      data: {
        'contents': [
          {
            'parts': [
              {'text': GeminiPrompt.instruction},
              {
                'inline_data': {
                  'mime_type': 'image/jpeg',
                  'data': base64Encode(jpeg),
                },
              },
            ],
          },
        ],
        'generationConfig': {
          'temperature': 0.1,
          'responseMimeType': 'application/json',
          'responseSchema': GeminiPrompt.responseSchema,
        },
      },
    );
  } on DioException catch (erreur) {
    final code = erreur.response?.statusCode;
    stderr.writeln('Appel refusé ($code) : ${erreur.response?.data}');
    if (code == 404) {
      stderr.writeln(
        'Un 404 ici désigne le modèle, pas la photo. '
        'Lancer --modeles pour voir ce qui est servi.',
      );
    }
    exit(70);
  }

  final blocage = (reponse.data?['promptFeedback'] as Map?)?['blockReason'];
  if (blocage != null) {
    stderr.writeln('Photo refusée par les filtres du service : $blocage');
    exit(65);
  }

  final candidats = reponse.data?['candidates'];
  Object? texte;
  if (candidats is List && candidats.isNotEmpty) {
    final contenu = (candidats.first as Map)['content'];
    final parts = contenu is Map ? contenu['parts'] : null;
    if (parts is List && parts.isNotEmpty) {
      texte = (parts.first as Map)['text'];
    }
  }
  if (texte is! String) {
    stderr.writeln('Réponse sans texte exploitable : ${reponse.data}');
    exit(65);
  }

  stdout.writeln('── Réponse brute (${DateTime.now().difference(debut).inMilliseconds} ms)');
  stdout.writeln(texte.trim());
  stdout.writeln();

  if (sortieBrut != null) {
    await File(sortieBrut).writeAsString(texte.trim());
    stdout.writeln('Réponse écrite dans $sortieBrut');
    stdout.writeln();
  }

  stdout.writeln(rapport(analyser(jsonDecode(texte) as Map<String, dynamic>)));
}
