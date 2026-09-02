/// Ce que l'application répond quand on lui demande la couleur d'un point.
///
/// Le champ qui compte n'est pas [label], c'est [alternative]. La personne qui
/// se sert de cette fonction est le plus souvent quelqu'un qui **ne peut pas
/// vérifier** — daltonien, ou dans le noir. Pour elle, une réponse fausse et
/// assurée est pire que pas de réponse : elle n'a aucun moyen de la corriger.
///
/// Une lecture de couleur est incertaine bien plus souvent qu'on ne croit. Une
/// ampoule chaude fait virer un blanc au beige ; une teinte posée sur une
/// frontière de nuance bascule d'un nom à l'autre pour trois points de rien.
/// Dans ces cas, l'entité porte les deux noms et se dit incertaine, plutôt que
/// de tirer au sort en silence.
library;

class ColorReading {
  const ColorReading(this.label, {this.alternative, this.nuance});

  /// Le nom retenu, en français, minuscule : « bleu », « beige ».
  final String label;

  /// L'autre nom plausible, quand la mesure est près d'une frontière.
  final String? alternative;

  /// Ce qui explique l'hésitation, quand elle a une cause nommable —
  /// « sous lumière chaude ». Toujours absent si [alternative] l'est.
  final String? nuance;

  bool get isCertain => alternative == null;

  /// Phrase prête à lire ou à énoncer à voix haute. L'incertitude est dite,
  /// jamais suggérée par une couleur d'affichage ou une icône : cette réponse
  /// doit rester vraie quand elle est lue par une synthèse vocale.
  String get spoken {
    if (alternative == null) return label;
    final cause = nuance == null ? '' : ' $nuance';
    return '$label, ou $alternative$cause';
  }

  @override
  String toString() => spoken;

  @override
  bool operator ==(Object other) =>
      other is ColorReading &&
      other.label == label &&
      other.alternative == alternative &&
      other.nuance == nuance;

  @override
  int get hashCode => Object.hash(label, alternative, nuance);
}
