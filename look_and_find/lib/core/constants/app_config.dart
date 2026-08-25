/// Réglages d'exécution de l'application.
///
/// La clé Gemini n'est **pas** écrite dans le dépôt : elle est injectée au
/// build par `--dart-define=GEMINI_API_KEY=…`. Un fichier de configuration
/// versionné finit toujours par partir sur un dépôt public, et une clé
/// d'inférence facturée à l'appel n'est pas une chose qu'on révoque à loisir.
/// Le défaut vide n'est pas une négligence : `hasApiKey` s'en sert pour
/// afficher un écran d'explication plutôt que de laisser l'appel partir et
/// échouer en 400 devant l'utilisateur.
library;

class AppConfig {
  const AppConfig._();

  /// Injectée au build. Voir le README pour la commande complète.
  static const String geminiApiKey = String.fromEnvironment('GEMINI_API_KEY');

  static bool get hasApiKey => geminiApiKey.isNotEmpty;

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
}
