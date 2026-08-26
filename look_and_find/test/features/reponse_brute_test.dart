/// La trace de ce que le modèle a réellement répondu.
///
/// Elle tranche la seule question qui compte quand une fiche est fausse : le
/// modèle l'a-t-il dit, ou l'avons-nous mal lu ? Ces tests vérifient qu'elle
/// est retenue **même quand la réponse est inexploitable** — c'est justement le
/// cas où l'on a le plus besoin de la regarder.
library;

import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/core/network/app_exception.dart';
import 'package:look_and_find/features/scanner/data/datasources/gemini_vision_datasource.dart';

/// Rend la réponse qu'on lui donne, sans réseau.
class _FauxDio with DioMixin implements Dio {
  _FauxDio(this.corps) {
    options = BaseOptions();
    httpClientAdapter = _AdaptateurMuet();
  }

  final Map<String, dynamic> corps;

  @override
  Future<Response<T>> fetch<T>(RequestOptions options) async => Response<T>(
    requestOptions: options,
    statusCode: 200,
    data: corps as T,
  );
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

Map<String, dynamic> _reponseGemini(String texte) => {
  'candidates': [
    {
      'content': {
        'parts': [
          {'text': texte},
        ],
      },
    },
  ],
};

/// Un JPEG minuscule mais valide, pour que la compression aboutisse.
final _photo = Uint8List.fromList([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00,
]);

void main() {
  const fiche =
      '{"title":"Fauteuil","category":"furniture","average_price":149.99,'
      '"currency":"EUR"}';

  test('sans identification, il n\'y a rien à montrer', () {
    final source = GeminiVisionDataSource(_FauxDio(const {}), 'AIzaTest');
    expect(source.lastRawAnswer, isNull);
  });

  test('une identification réussie retient la réponse telle quelle', () async {
    final source = GeminiVisionDataSource(
      _FauxDio(_reponseGemini(fiche)),
      'AIzaTest',
    );

    final produit = await source.identify(_photo);

    expect(produit.title, 'Fauteuil');
    expect(source.lastRawAnswer, fiche);
  });

  test('une réponse illisible est retenue elle aussi', () async {
    // C'est le cas qui justifie la fonction : la fiche n'existe pas, et la
    // seule façon de comprendre pourquoi est de lire ce qui est arrivé.
    const cassee = 'Voici la fiche : {"title": "Chaise",,}';
    final source = GeminiVisionDataSource(
      _FauxDio(_reponseGemini(cassee)),
      'AIzaTest',
    );

    await expectLater(
      source.identify(_photo),
      throwsA(isA<UnreadableAnswerException>()),
    );
    expect(source.lastRawAnswer, cassee);
  });

  test('sans clé, aucun appel n\'est tenté', () async {
    final source = GeminiVisionDataSource(_FauxDio(const {}), '');

    await expectLater(
      source.identify(_photo),
      throwsA(isA<MissingApiKeyException>()),
    );
    expect(source.lastRawAnswer, isNull);
  });
}
