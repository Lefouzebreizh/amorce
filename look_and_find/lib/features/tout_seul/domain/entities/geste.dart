/// Ce qu'est un geste dans « Tout seul », et pourquoi il est bâti ainsi.
///
/// L'utilisateur **ne sait pas lire**. Tout ce qui est écrit ici sera dit à
/// voix haute, jamais affiché seul ; les phrases sont donc écrites pour être
/// *entendues* par un enfant de cinq ans, pas pour être lues par son parent.
///
/// Trois conséquences dans la forme des données :
///
/// 1. **Une étape porte une phrase et une seule.** Deux gestes dans la même
///    phrase — « croise les lacets et fais une boucle » — se perdent à
///    l'écoute : l'enfant retient le dernier et rate le premier. La contrainte
///    est vérifiée par les tests, qui refusent une étape de plus de quatre-vingts
///    caractères.
/// 2. **Une étape porte un mot-clé d'illustration**, pas une image. Le domaine
///    ne connaît ni fichier ni chemin ; c'est la couche de présentation qui
///    choisit quoi dessiner. Sans quoi le corpus deviendrait invérifiable dès
///    qu'un dessin manque.
/// 3. **Un geste porte plusieurs étiquettes d'objet.** L'appareil photo rend un
///    nom d'objet, pas un nom de geste : personne ne photographie « nouer ses
///    lacets », on photographie un lacet, une basket, un cordon. Les étiquettes
///    sont l'unique porte d'entrée du corpus.
library;

/// Une étape d'un geste : une phrase à dire, un mot-clé à illustrer.
class Etape {
  const Etape(this.phrase, this.illustration);

  /// La phrase telle qu'elle sera lue à voix haute. Présent, deuxième
  /// personne, un seul geste.
  final String phrase;

  /// Le mot-clé du dessin qui accompagne l'étape — jamais un chemin de
  /// fichier : le domaine ne sait pas où vivent les images.
  final String illustration;

  @override
  String toString() => phrase;
}

/// Un geste du quotidien, décomposé en étapes courtes.
class Geste {
  const Geste({
    required this.identifiant,
    required this.nom,
    required this.etapes,
    required this.etiquettes,
  });

  /// Identifiant stable, en minuscules avec des tirets bas. Il ne s'affiche
  /// jamais : il sert à désigner le geste dans les tests et les journaux.
  final String identifiant;

  /// Le nom lisible, pour l'adulte qui regarde par-dessus l'épaule.
  final String nom;

  /// Quatre à sept étapes. En dessous, le geste est trop résumé pour être
  /// exécuté ; au-dessus, l'enfant a oublié la première avant la dernière.
  final List<Etape> etapes;

  /// Les noms d'objet qui déclenchent ce geste. Plusieurs, parce qu'un même
  /// objet se nomme de plusieurs façons — « basket », « tennis », « lacet ».
  ///
  /// **Un mot n'appartient qu'à un geste.** Deux gestes qui répondent au même
  /// mot est un défaut : l'aiguillage en choisirait un au hasard de l'ordre du
  /// corpus, et l'enfant recevrait tantôt l'un, tantôt l'autre.
  final List<String> etiquettes;

  @override
  String toString() => '$identifiant (${etapes.length} étapes)';
}
