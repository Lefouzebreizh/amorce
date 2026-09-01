/// Les rares mots écrits de *Tout seul*, et pour qui ils sont écrits.
///
/// **Ils ne s'adressent pas à l'enfant.** Il ne lit pas : tout ce qui le
/// concerne est un émoji, une flèche, ou une phrase dite à voix haute. Ce qui
/// est écrit ici est destiné à **l'adulte assis à côté**, qui doit pouvoir
/// nommer ce qu'il voit — « Nouer ses lacets », « Suivant » — sans avoir à
/// deviner l'application.
///
/// **Pourquoi pas dans `AppStrings`.** Le fichier de textes de `core/` est
/// celui de Look & Find : prix, marchands, alertes, ruptures de stock. La
/// décision du 31/08/2026 — deux points d'entrée, un seul projet — vaut que le
/// vocabulaire du commerce ne traverse pas la cloison, dans un sens comme dans
/// l'autre. Y verser cinq mots d'enfant les mêlerait à cent mots de boutique,
/// et personne ne saurait plus lesquels partent dans quel binaire.
library;

abstract final class MotsEnfant {
  /// Le nom de l'application, tel qu'il apparaît en haut de la grille.
  static const String titre = 'Tout seul';

  /// Sous-titre de la grille. Pour l'adulte : il dit ce que la grille attend.
  static const String choisir = 'Choisis un geste';

  /// Le grand bouton d'avancement.
  static const String suivant = 'Suivant';

  /// Le même bouton, sur la dernière étape. Il ramène à la grille : sans lui,
  /// l'enfant reste bloqué sur la dernière phrase, qui ne mène nulle part.
  static const String fini = 'J\'ai fini';

  /// Revenir à l'étape précédente. Jamais affiché — c'est une flèche — mais lu
  /// par les lecteurs d'écran et par les tests.
  static const String retour = 'Revenir à l\'étape d\'avant';

  /// Quitter le geste et revenir à la grille.
  static const String sortir = 'Revenir aux gestes';
}
