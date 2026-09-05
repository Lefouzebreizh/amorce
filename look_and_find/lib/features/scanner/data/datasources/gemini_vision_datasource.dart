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
import '../../../fiche_objet/data/models/fiche_objet_dto.dart';
import '../../../fiche_objet/domain/entities/fiche_objet.dart';
import '../../../product_detail/data/models/product_dto.dart';
import '../../../product_detail/domain/entities/product.dart';
import 'corps_requete.dart';
import 'fiche_prompt.dart';
import 'gemini_prompt.dart';

class GeminiVisionDataSource {
  GeminiVisionDataSource(this._dio, this._apiKey);

  final Dio _dio;

  /// Fournie par l'appelant plutôt que lue d'une constante globale : c'est ce
  /// qui permet à une clé saisie dans l'application de remplacer celle du
  /// build, et à un test de n'en fournir aucune.
  final String _apiKey;

  /// La dernière réponse brute du modèle, telle qu'elle est arrivée.
  ///
  /// **À quoi ça sert, et pourquoi c'est gardé.** Quand une fiche affiche un
  /// prix fantaisiste ou un marchand inventé, une seule question compte : le
  /// modèle l'a-t-il dit, ou l'avons-nous mal lu ? Sans cette trace, y répondre
  /// demande de rejouer le scan avec un débogueur branché — c'est-à-dire jamais,
  /// puisque le problème apparaît sur un téléphone, en situation.
  ///
  /// Gardée en mémoire seulement, et seulement la dernière : elle ne survit pas
  /// à la fermeture de l'application, et n'occupe pas le stockage. C'est
  /// suffisant pour le geste réel — scanner, voir que c'est faux, regarder.
  String? get lastRawAnswer => _lastRawAnswer;
  String? _lastRawAnswer;

  Future<Product> identify(Uint8List photo, {CancelToken? cancelToken}) async {
    if (_apiKey.isEmpty) throw const MissingApiKeyException();

    final texte = await _demander(
      photo,
      GeminiPrompt.corpsRequete,
      cancelToken: cancelToken,
    );

    final ProductDto dto;
    try {
      dto = ProductDto.decode(texte);
    } on FormatException {
      throw const UnreadableAnswerException(
        'Réponse illisible du service d\'identification.',
      );
    }

    final product = dto.toEntity();
    if (product == null) throw const UnreadableAnswerException();
    return product;
  }

  /// Décrire l'objet d'une photo — le parcours de la version un.
  ///
  /// Même appel, même enveloppe, autre invite : c'est le schéma de
  /// [FichePrompt] qui décide de ce qui revient. La couleur n'est pas demandée
  /// au modèle ; elle est mesurée sur la photo plus haut dans la chaîne.
  Future<FicheObjet> decrire(
    Uint8List photo, {
    CancelToken? cancelToken,
  }) async {
    if (_apiKey.isEmpty) throw const MissingApiKeyException();

    final texte = await _demander(
      photo,
      (base64) => enveloppeGemini(
        instruction: FichePrompt.instruction,
        schema: FichePrompt.responseSchema,
        photoBase64: base64,
      ),
      cancelToken: cancelToken,
    );

    final FicheObjetDto dto;
    try {
      dto = FicheObjetDto.decode(texte);
    } on FormatException {
      throw const UnreadableAnswerException(
        'Réponse illisible du service d\'identification.',
      );
    }

    final fiche = dto.toEntity();
    if (fiche == null) throw const UnreadableAnswerException();
    return fiche;
  }

  /// Compresse, envoie, et rend le texte du modèle — la part qui ne dépend pas
  /// de l'invite. La retenue de [lastRawAnswer] est ici, donc valable pour les
  /// deux parcours : une réponse illisible est justement celle qu'on a le plus
  /// besoin de pouvoir regarder, quel que soit ce qu'on avait demandé.
  Future<String> _demander(
    Uint8List photo,
    Map<String, Object?> Function(String base64) corps, {
    CancelToken? cancelToken,
  }) async {
    final base64 = await ImageCompressor.toBase64Jpeg(photo);

    final Response<Map<String, dynamic>> response;
    try {
      response = await _dio.post<Map<String, dynamic>>(
        '/models/${AppConfig.geminiModel}:generateContent',
        queryParameters: {'key': _apiKey},
        cancelToken: cancelToken,
        data: corps(base64),
      );
    } on DioException catch (error) {
      throw AppException.from(error);
    }

    return _texteBrut(response.data);
  }

  /// L'enveloppe de la réponse : ce qui est commun aux deux invites.
  ///
  /// Rend le texte du modèle, ou lève l'échec qui explique pourquoi il n'y en a
  /// pas. Le décodage de ce texte appartient à l'appelant, seul à savoir quel
  /// schéma il avait demandé.
  String _texteBrut(Map<String, dynamic>? body) {
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
    // Retenue avant le décodage : une réponse illisible est justement celle
    // qu'on a le plus besoin de pouvoir regarder.
    _lastRawAnswer = text;
    return text;
  }
}
