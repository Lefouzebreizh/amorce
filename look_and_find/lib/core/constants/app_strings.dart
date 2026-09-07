/// Textes de l'interface, regroupés ici pour deux raisons : les relire d'un
/// bloc (une application de scan se juge à la clarté de ses messages d'échec,
/// pas à ses écrans de succès), et n'avoir qu'un endroit à traduire le jour où
/// une seconde langue arrive.
library;

class AppStrings {
  const AppStrings._();

  static const String appName = 'Look & Find';

  // Scanner
  static const String scannerTitle = 'Viser un objet';
  static const String scannerHint =
      'Cadrez l\'objet entier, de face, sur un fond dégagé.';
  static const String scannerAnalysing = 'Identification en cours…';

  /// Ce que l'attente promet doit être ce que la fiche livre. Cette phrase
  /// annonçait « recherche des prix et des marchands » — le parcours du
  /// comparateur, remis à la version deux — et promettait donc quelque chose
  /// que l'écran suivant ne montre pas.
  static const String scannerAnalysingDetail =
      'Reconnaissance de l\'objet, de sa matière et de sa couleur.';
  static const String scannerPermission =
      'L\'appareil photo est nécessaire pour identifier un objet.';
  static const String scannerPermissionAction = 'Autoriser l\'appareil photo';
  static const String scannerNoCamera = 'Aucun appareil photo disponible.';
  static const String tapToFocus = 'Touchez pour faire la mise au point';
  static const String pickPhoto = 'Choisir une photo';
  static const String pickPhotoHint =
      'Identifiez un objet à partir d\'une photo déjà prise.';

  // Configuration
  static const String missingKeyTitle = 'Clé Gemini absente';
  static const String missingKeyBody =
      'L\'identification d\'objet a besoin d\'une clé Gemini. Saisissez la '
      'vôtre : elle reste sur ce téléphone.';
  static const String enterKey = 'Saisir ma clé';
  static const String settingsKey = 'Clé Gemini';

  // Fiche produit
  static const String bestOffer = 'Meilleure offre';
  static const String merchants = 'Où l\'acheter';
  static const String alternatives = 'Moins cher, équivalent';
  static const String dimensions = 'Dimensions';
  static const String outOfStock = 'Rupture';
  static const String averagePrice = 'Prix moyen constaté';
  static const String seeInAr = 'Voir chez moi';
  static const String openMerchant = 'Ouvrir la boutique';

  // Réalité augmentée
  static const String arTitle = 'Chez moi';
  static const String arUnavailable = 'Pas de modèle 3D pour cet objet';
  static const String arUnavailableBody =
      'L\'identification n\'a pas trouvé de modèle exploitable. Les dimensions '
      'de la fiche restent le meilleur repère pour vérifier l\'encombrement.';
  static const String arHint =
      'Balayez lentement le sol, puis posez l\'objet. Il apparaît à sa taille réelle.';

  // Mes fiches — la mémoire de la version un
  static const String fichesTitle = 'Mes fiches';
  static const String noFiches = 'Aucun objet identifié pour l\'instant.';
  static const String noFichesBody =
      'Visez un objet et appuyez sur le déclencheur : sa fiche restera ici.';

  /// Le geste est irréversible et la formulation le dit. « Supprimer ? » ferait
  /// croire à une corbeille ; il n'y en a pas, et la fiche coûte un appel au
  /// modèle à refaire.
  static const String supprimerFiche = 'Retirer cette fiche ?';
  static const String supprimerFicheBody =
      'Elle ne sera plus dans la liste. Il faudra reprendre une photo pour la '
      'retrouver.';
  static const String supprimer = 'Retirer';
  static const String annuler = 'Annuler';

  // Favoris et historique
  static const String favoritesTitle = 'Ma liste';
  static const String tabFavorites = 'Favoris';
  static const String tabHistory = 'Historique';
  static const String noFavorites = 'Aucun favori pour l\'instant.';
  static const String noFavoritesBody =
      'Mettez un objet en favori depuis sa fiche pour suivre son prix.';
  static const String noHistory = 'Aucun objet scanné pour l\'instant.';
  static const String priceAlert = 'Alerte prix';
  static const String priceAlertBody =
      'Prévenez-moi quand le prix descend sous ce seuil.';
  static const String priceDropped = 'Le prix a baissé';

  // Erreurs
  static const String retry = 'Réessayer';
  static const String errorGeneric = 'Quelque chose s\'est mal passé.';
}
