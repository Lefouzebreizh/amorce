/// Traduction entre le JSON du modèle et [FicheObjet].
///
/// **La lecture ne lève sur aucun champ.** Un modèle de langage rend « null »
/// écrit en toutes lettres, une chaîne là où on attendait une liste, ou omet la
/// clé — selon la photo. Perdre toute la fiche parce que « matiere » est mal
/// typé ferait disparaître le nom, l'usage et les conseils, qui étaient justes.
/// Seule l'absence de [FicheObjet.nom] est fatale : sans nom d'objet, il n'y a
/// rien à montrer.
///
/// C'est la même décision que dans `product_dto.dart`, prise pour la même
/// raison. Elle est répétée ici plutôt que partagée : les deux fiches n'ont pas
/// un champ en commun, et une base commune n'aurait mis en facteur que le mot
/// « tolérant ».
///
/// La couleur ne se lit pas ici : elle est mesurée sur la photo par
/// `color_reader` et posée par le cas d'usage. Le modèle n'a pas à la donner —
/// il la nommerait sans jamais dire qu'il hésite.
library;

import 'dart:convert';

import '../../domain/entities/fiche_objet.dart';

class FicheObjetDto {
  const FicheObjetDto._(this._json);

  factory FicheObjetDto.fromJson(Map<String, dynamic> json) =>
      FicheObjetDto._(json);

  final Map<String, dynamic> _json;

  static FicheObjetDto decode(String brut) =>
      FicheObjetDto._(jsonDecode(brut) as Map<String, dynamic>);

  Map<String, dynamic> toJson() => _json;

  static FicheObjetDto fromEntity(FicheObjet fiche) => FicheObjetDto._({
    'nom': fiche.nom,
    'categorie': fiche.categorie,
    'usage': fiche.usage,
    'matiere': fiche.matiere,
    'caracteristiques': fiche.caracteristiques,
    'conseils': fiche.conseils,
  });

  /// `null` quand la réponse n'a pas de nom exploitable — l'appelant traduit ça
  /// en « objet non identifié », qui est le bon message.
  FicheObjet? toEntity() {
    final nom = _texte(_json['nom']);
    if (nom == null) return null;

    return FicheObjet(
      nom: nom,
      categorie: _texte(_json['categorie']),
      usage: _texte(_json['usage']),
      matiere: _texte(_json['matiere']),
      caracteristiques: _liste(_json['caracteristiques']),
      conseils: _liste(_json['conseils']),
    );
  }

  static String? _texte(Object? brut) {
    if (brut == null) return null;
    final valeur = brut.toString().trim();
    // Le modèle écrit parfois littéralement « null » ou « N/A » plutôt que
    // d'omettre la clé.
    if (valeur.isEmpty || valeur == 'null' || valeur == 'N/A') return null;
    return valeur;
  }

  /// Une liste demandée revient parfois en une seule chaîne — « lame en inox,
  /// manche en bois ». La refuser perdrait deux observations justes ; la
  /// découper sur les séparateurs usuels les garde.
  static List<String> _liste(Object? brut) {
    if (brut is List) {
      return brut.map(_texte).nonNulls.toList();
    }
    final seul = _texte(brut);
    if (seul == null) return const [];
    return seul
        .split(RegExp(r'\s*[;\n•]\s*|\s*,\s(?=[a-zà-ÿ])'))
        .map((e) => e.trim())
        .where((e) => e.isNotEmpty)
        .toList();
  }
}
