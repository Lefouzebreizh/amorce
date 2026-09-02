/// Une harmonie proposée par Accord, et ce qu'on en fait dans une pièce.
///
/// **Une palette n'est pas une réponse.** « Voici trois couleurs » laisse la
/// personne exactement là où elle était : devant un mur, sans savoir quoi
/// acheter. La règle 60 / 30 / 10 existe pour ça — elle dit *combien* de
/// chaque couleur, et cette quantité désigne l'objet.
///
/// Le mur est le 60. Il n'est donc jamais une proposition : il est la base,
/// déjà en place, et c'est ce qui rend le reste concret. On propose un coussin
/// complémentaire, jamais un mur complémentaire.
library;

/// Ce qu'on pose dans la pièce, en quelle quantité, et de quelle couleur.
class Proposition {
  const Proposition({
    required this.part,
    required this.rouge,
    required this.vert,
    required this.bleu,
    required this.objets,
  });

  /// 30 ou 10. Le 60 est le mur, il n'est pas proposé.
  final int part;

  final int rouge;
  final int vert;
  final int bleu;

  /// Les objets qui portent naturellement cette quantité. À 30 %, ce sont des
  /// surfaces textiles ; à 10 %, des objets qu'on pose et qu'on déplace.
  final List<String> objets;

  String get hexadecimal =>
      '#${_hex(rouge)}${_hex(vert)}${_hex(bleu)}';

  static String _hex(int v) =>
      v.toRadixString(16).padLeft(2, '0').toUpperCase();
}

/// Les trois harmonies que la version un sait proposer.
enum TypeHarmonie {
  complementaire(
    'Complémentaire',
    'La couleur opposée sur la roue. Le contraste le plus fort — '
        'à réserver aux petits objets, sinon la pièce vibre.',
  ),
  analogue(
    'Analogue',
    'Les couleurs voisines. Rien ne jure, tout se fond : '
        'c\'est l\'harmonie la plus sûre, et la plus discrète.',
  ),
  triadique(
    'Triadique',
    'Deux couleurs à égale distance. Plus vivant que l\'analogue, '
        'plus tenable que la complémentaire.',
  );

  const TypeHarmonie(this.nom, this.explication);

  final String nom;

  /// Ce que cette harmonie fait à une pièce. Sans cette phrase, les trois
  /// propositions se ressemblent et le choix se fait au hasard.
  final String explication;
}

class Harmonie {
  const Harmonie(this.type, this.propositions);

  final TypeHarmonie type;
  final List<Proposition> propositions;
}
