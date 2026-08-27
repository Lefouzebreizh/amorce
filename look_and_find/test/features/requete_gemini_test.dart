/// Ce qui part réellement vers Gemini.
///
/// **Le maillon que personne ne regardait.** Les tests de scan remplacent le
/// réseau par un faux `Dio` qui rend une réponse toute faite — et ignore
/// complètement ce qu'on lui a envoyé. Toute la chaîne est donc couverte sauf
/// son dernier maillon : une requête mal formée passerait les 90 tests et
/// échouerait en 400 sur le premier vrai scan, chez l'utilisateur, avec pour
/// seul indice « la photo n'a pas pu être envoyée ».
///
/// Ces assertions ne jugent pas la qualité de l'identification — cela demande
/// le modèle. Elles répondent à la question d'avant : la requête est-elle
/// celle qu'on croit ? C'est le verdict qu'on peut rendre sans appareil et
/// sans clé.
library;

import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/core/constants/app_config.dart';
import 'package:look_and_find/features/scanner/data/datasources/gemini_prompt.dart';
import 'package:look_and_find/features/scanner/data/datasources/gemini_vision_datasource.dart';

/// Retient la requête au lieu de la jouer, et rend une fiche minimale.
class _DioEspion with DioMixin implements Dio {
  _DioEspion() {
    options = BaseOptions();
    httpClientAdapter = _AdaptateurMuet();
  }

  RequestOptions? vue;

  @override
  Future<Response<T>> fetch<T>(RequestOptions options) async {
    vue = options;
    return Response<T>(
      requestOptions: options,
      statusCode: 200,
      data:
          {
                'candidates': [
                  {
                    'content': {
                      'parts': [
                        {
                          'text':
                              '{"title":"Objet","category":"decor",'
                              '"average_price":10,"currency":"EUR"}',
                        },
                      ],
                    },
                  },
                ],
              }
              as T,
    );
  }
}

class _AdaptateurMuet implements HttpClientAdapter {
  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => throw UnimplementedError();
}

/// Un JPEG minuscule mais valide, pour que la compression aboutisse.
final _photo = Uint8List.fromList([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00,
]);

void main() {
  late _DioEspion dio;
  late Map<String, Object?> corps;

  setUp(() async {
    dio = _DioEspion();
    await GeminiVisionDataSource(dio, 'AIzaTest').identify(_photo);
    corps = dio.vue!.data as Map<String, Object?>;
  });

  test('vise le modèle configuré, avec la clé fournie', () {
    expect(dio.vue!.path, '/models/${AppConfig.geminiModel}:generateContent');
    expect(dio.vue!.queryParameters['key'], 'AIzaTest');
  });

  test('envoie l\'invite et la photo, dans cet ordre', () {
    final parts =
        ((corps['contents']! as List).first as Map)['parts']! as List;

    expect((parts.first as Map)['text'], GeminiPrompt.instruction);

    // La photo suit le texte : l'ordre inverse dégrade l'identification, le
    // modèle lisant la consigne après avoir déjà regardé l'image.
    final image = (parts[1] as Map)['inline_data']! as Map;
    expect(image['mime_type'], 'image/jpeg');
    expect(
      base64Decode(image['data']! as String),
      isNotEmpty,
      reason: 'La photo doit arriver en base64 décodable.',
    );
  });

  test('contraint le décodage du modèle plutôt que d\'espérer du JSON', () {
    final config = corps['generationConfig']! as Map;

    // Sans ces deux lignes, le modèle préfixe sa réponse d'un bloc ``` et le
    // parseur devrait deviner où commence le JSON — c'est ce que le schéma
    // remplace.
    expect(config['responseMimeType'], 'application/json');
    expect(config['responseSchema'], same(GeminiPrompt.responseSchema));

    // Une même photo doit donner le même prix, sinon le suivi de prix mesure
    // le bruit du modèle.
    expect(config['temperature'], lessThanOrEqualTo(0.2));
  });

  test('le banc d\'essai enverrait exactement la même chose', () {
    // `tool/banc_invite.dart` sert à éprouver l'invite sans appareil ; il ne
    // vaut que s'il envoie la requête de l'application. Les deux passent par
    // `corpsRequete`, et c'est cette égalité-là qui le garantit.
    final image =
        ((((corps['contents']! as List).first as Map)['parts']! as List)[1]
                as Map)['inline_data']!
            as Map;

    expect(GeminiPrompt.corpsRequete(image['data']! as String), corps);
  });
}
