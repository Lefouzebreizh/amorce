/// Réglages d'exécution de l'application.
///
/// La clé Gemini n'est **pas** écrite dans le dépôt. Elle a deux origines
/// possibles, dans cet ordre de priorité :
///
/// 1. celle que l'utilisateur a saisie dans l'application, rangée sur
///    l'appareil (voir `ApiKeyStore`) ;
/// 2. [compiledApiKey], injectée au build par `--dart-define`.
///
/// La saisie passe avant, et ce n'est pas arbitraire : une clé compilée est une
/// chaîne en clair dans le binaire, récupérable par qui obtient l'APK, et sa
/// rotation impose de tout reconstruire. Pouvoir la remplacer sans rebâtir est
/// la seule façon de réagir vite à une clé fuitée.
///
/// Le défaut vide n'est pas une négligence : l'application démarre alors sur un
/// écran qui propose de saisir une clé, plutôt que de laisser l'appel partir et
/// échouer en 400 devant l'utilisateur.
library;

class AppConfig {
  const AppConfig._();

  /// Injectée au build. Voir le README pour la commande complète.
  static const String compiledApiKey = String.fromEnvironment('GEMINI_API_KEY');

  static const String geminiBaseUrl =
      'https://generativelanguage.googleapis.com/v1beta';

  /// Modèle multimodal. `flash` plutôt que `pro` : sur un viseur, la latence
  /// perçue compte plus que le dernier point de précision, et l'identification
  /// d'un objet courant ne demande pas le grand modèle.
  static const String geminiModel = 'gemini-1.5-flash';

  /// Au-delà, la photo est recompressée avant l'envoi : le temps passé sur le
  /// réseau mobile dépasse vite le temps d'inférence.
  static const int maxImageWidth = 1024;
  static const int imageQuality = 85;

  static const Duration connectTimeout = Duration(seconds: 10);
  static const Duration receiveTimeout = Duration(seconds: 45);

  /// Trois tentatives au total. Au-delà, l'utilisateur a déjà rangé son
  /// téléphone ; mieux vaut lui rendre la main avec un message clair.
  static const int maxRetries = 2;
  static const Duration retryBaseDelay = Duration(milliseconds: 800);

  /// Noms des boîtes Hive. Le stockage local est volontairement plat : deux
  /// boîtes de JSON, pas de schéma binaire à migrer à chaque champ ajouté à
  /// la fiche produit.
  static const String favoritesBox = 'favoris';
  static const String historyBox = 'historique';
  static const String settingsBox = 'reglages';
}
