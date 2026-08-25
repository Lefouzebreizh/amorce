/// L'appel à Gemini : une photo entre, une fiche produit sort.
///
/// C'est le seul endroit de l'application qui connaît le format de l'API
/// Gemini. Tout ce qui remonte au-dessus est déjà un [Product] ou une
/// [AppException] — changer de fournisseur de vision ne touche que ce fichier
/// et son invite.
///
/// Deux échecs se ressemblent et ne doivent surtout pas être confondus :
/// le réseau qui casse (on réessaie, la photo est bonne) et le modèle qui
/// répond « je ne vois rien » (inutile de réessayer, il faut reprendre la
/// photo). Le premier remonte en [NetworkException], le second en
/// [UnreadableAnswerException].
library;

import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../../../../core/constants/app_config.dart';
import '../../../../core/network/app_exception.dart';
import '../../../../core/utils/image_compressor.dart';
import '../../../product_detail/data/models/product_dto.dart';
import '../../../product_detail/domain/entities/product.dart';
import 'gemini_prompt.dart';

class GeminiVisionDataSource {
  const GeminiVisionDataSource(this._dio);

  final Dio _dio;

  Future<Product> identify(Uint8List photo, {CancelToken? cancelToken}) async {
    if (!AppConfig.hasApiKey) throw const MissingApiKeyException();

    final base64 = await ImageCompressor.toBase64Jpeg(photo);

    final Response<Map<String, dynamic>> response;
    try {
      response = await _dio.post<Map<String, dynamic>>(
        '/models/${AppConfig.geminiModel}:generateContent',
        queryParameters: {'key': AppConfig.geminiApiKey},
        cancelToken: cancelToken,
        data: {
          'contents': [
            {
              'parts': [
                {'text': GeminiPrompt.instruction},
                {
                  'inline_data': {'mime_type': 'image/jpeg', 'data': base64},
                },
              ],
            },
          ],
          'generationConfig': {
            // Une fiche produit n'a pas à varier d'un scan à l'autre : la
            // même photo doit donner le même prix moyen, sinon le suivi de
            // prix mesure le bruit du modèle plutôt que le marché.
            'temperature': 0.1,
            'responseMimeType': 'application/json',
            'responseSchema': GeminiPrompt.responseSchema,
          },
        },
      );
    } on DioException catch (error) {
      throw AppException.from(error);
    }

    return _parse(response.data);
  }

  Product _parse(Map<String, dynamic>? body) {
    if (body == null) throw const UnreadableAnswerException();

    // Photo refusée par les filtres de sécurité (visage, contenu sensible).
    // Le message générique « objet non identifié » serait trompeur : ici,
    // reprendre la même photo échouera toujours.
    final block = (body['promptFeedback'] as Map?)?['blockReason'];
    if (block != null) {
      throw const UnreadableAnswerException(
        'Cette photo a été refusée par le service. Évitez les personnes et '
        'les documents personnels dans le cadre.',
      );
    }

    final candidates = body['candidates'];
    if (candidates is! List || candidates.isEmpty) {
      throw const UnreadableAnswerException();
    }

    final candidate = candidates.first as Map<String, dynamic>;
    final parts = (candidate['content'] as Map?)?['parts'];
    if (parts is! List || parts.isEmpty) {
      throw const UnreadableAnswerException();
    }

    final text = (parts.first as Map)['text'];
    if (text is! String || text.trim().isEmpty) {
      throw const UnreadableAnswerException();
    }

    final ProductDto dto;
    try {
      dto = ProductDto.decode(text);
    } on FormatException {
      // `responseSchema` rend ce cas très improbable ; s'il survient, c'est un
      // signal que le contrat avec l'API a changé, pas une mauvaise photo.
      throw const UnreadableAnswerException(
        'Réponse illisible du service d\'identification.',
      );
    }

    final product = dto.toEntity();
    if (product == null) throw const UnreadableAnswerException();
    return product;
  }
}
