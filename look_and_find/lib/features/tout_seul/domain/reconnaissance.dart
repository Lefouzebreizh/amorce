/// Ce que *Tout seul* attend d'un moteur de reconnaissance, et rien de plus.
///
/// **Ce port ne traduit rien, et c'est sa raison d'être.** Il rend le mot que
/// la machine a écrit — « Shoe », « Footwear », « Textile » — avec la confiance
/// qu'elle lui accorde. Pas le geste du corpus, pas un mot français, pas une
/// interprétation.
///
/// La tentation est pourtant forte de faire remonter directement un `Geste` :
/// un appel de moins, une couche de moins. Elle est refusée pour une raison
/// mesurable — **personne ne sait encore ce que ce moteur répond** quand un
/// enfant pointe ses lacets. Écrire la correspondance « Shoe → nouer_ses_lacets »
/// avant de l'avoir vue, ce serait décider à la place de la mesure, et c'est
/// exactement la faute que ce dépôt paie le plus souvent : une conséquence
/// inventée posée sur une observation qu'on n'a pas faite.
///
/// La table de correspondance s'écrira donc **après** la sonde, à partir de
/// relevés réels. Tant qu'elle n'existe pas, rien dans le module ne prétend
/// savoir ce que « Footwear » veut dire.
///
/// **La frontière du vérifiable, comme pour la voix :** qu'un moteur reconnaisse
/// quoi que ce soit ne se constate que sur un appareil. Ce qui se mesure ici,
/// c'est que les étiquettes remontent entières, dans un ordre stable, et que
/// rien ne se perd entre la machine et l'écran.
library;

/// Une étiquette telle que le moteur l'a rendue.
class EtiquetteVue {
  const EtiquetteVue(this.texte, this.confiance);

  /// Le mot brut, dans la langue du moteur — de l'anglais, en pratique. Il
  /// n'est ni traduit, ni normalisé, ni corrigé : c'est la donnée qu'on relève.
  final String texte;

  /// Entre 0 et 1. Rendue telle quelle, jamais arrondie : c'est au moment de
  /// l'afficher qu'on choisit combien de décimales montrer, et un arrondi posé
  /// trop tôt ne se défait plus.
  final double confiance;

  /// Les étiquettes rangées de la plus sûre à la moins sûre.
  ///
  /// **Le départage par ordre alphabétique n'est pas un détail.** Deux
  /// étiquettes à la même confiance sortiraient sinon dans l'ordre du moteur,
  /// qui n'est pas garanti : deux relevés du même objet donneraient deux
  /// listes différentes, et l'on chercherait la cause dans l'objet plutôt que
  /// dans le tri. Un relevé sert à comparer ; il doit être reproductible.
  static List<EtiquetteVue> triees(Iterable<EtiquetteVue> vues) {
    final liste = vues.toList()
      ..sort((a, b) {
        final parConfiance = b.confiance.compareTo(a.confiance);
        return parConfiance != 0 ? parConfiance : a.texte.compareTo(b.texte);
      });
    return List.unmodifiable(liste);
  }

  @override
  String toString() => '$texte (${confiance.toStringAsFixed(2)})';
}

abstract interface class Reconnaissance {
  /// Rend ce qui a été vu dans l'image désignée par [cheminImage], **trié de la
  /// plus sûre à la moins sûre**. Une image où rien n'est reconnu rend une
  /// liste vide — jamais une exception, jamais une liste inventée.
  Future<List<EtiquetteVue>> observer(String cheminImage);

  /// Rend le moteur au système. Sur Android, un détecteur laissé ouvert
  /// retient de la mémoire native que le ramasse-miettes de Dart ne voit pas.
  Future<void> liberer();
}
