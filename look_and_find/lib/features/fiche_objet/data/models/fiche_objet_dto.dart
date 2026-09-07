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

import '../../../color_reader/domain/entities/color_reading.dart';
import '../../domain/entities/fiche_objet.dart';

class FicheObjetDto {
  const FicheObjetDto._(this._json);

  factory FicheObjetDto.fromJson(Map<String, dynamic> json) =>
      FicheObjetDto._(json);

  final Map<String, dynamic> _json;

  static FicheObjetDto decode(String brut) =>
      FicheObjetDto._(jsonDecode(brut) as Map<String, dynamic>);

  Map<String, dynamic> toJson() => _json;

  /// L'écriture porte **plus** que ce que le modèle a répondu : la couleur
  /// mesurée, l'instant de la prise et le chemin de la photo. Les trois sont
  /// posés par le cas d'usage et non par le service ; les omettre ferait
  /// relire une fiche sans sa couleur ni sa date, c'est-à-dire une fiche qu'on
  /// ne saurait ni situer dans le temps ni distinguer d'une autre.
  static FicheObjetDto fromEntity(FicheObjet fiche) => FicheObjetDto._({
    'nom': fiche.nom,
    'categorie': fiche.categorie,
    'usage': fiche.usage,
    'matiere': fiche.matiere,
    'caracteristiques': fiche.caracteristiques,
    'conseils': fiche.conseils,
    if (fiche.couleur != null) 'couleur': _couleurEnJson(fiche.couleur!),
    if (fiche.capturedAt != null)
      'capturedAt': fiche.capturedAt!.toIso8601String(),
    if (fiche.imagePath != null) 'imagePath': fiche.imagePath,
  });

  String encode() => jsonEncode(_json);

  /// La lecture d'une fiche **relue du disque**, par opposition à [toEntity]
  /// qui lit une réponse du modèle.
  ///
  /// Les deux ne peuvent pas être la même méthode : le modèle ne renvoie
  /// jamais de couleur ni de date — les demander là-bas ferait lire des champs
  /// qui n'existent pas — et le disque, lui, les porte toujours. Une seule
  /// lecture tolérante aurait masqué la différence, jusqu'au jour où une fiche
  /// relue serait revenue sans sa couleur sans que rien ne le signale.
  FicheObjet? toStoredEntity() {
    final base = toEntity();
    if (base == null) return null;

    return base.copyWith(
      couleur: _couleurDepuisJson(_json['couleur']),
      capturedAt: DateTime.tryParse(_texte(_json['capturedAt']) ?? ''),
      imagePath: _texte(_json['imagePath']),
    );
  }

  static Map<String, Object?> _couleurEnJson(ColorReading couleur) => {
    'label': couleur.label,
    if (couleur.alternative != null) 'alternative': couleur.alternative,
    if (couleur.nuance != null) 'nuance': couleur.nuance,
  };

  /// L'hésitation se relit telle quelle. Ne garder que [ColorReading.label]
  /// aurait transformé « bleu, ou vert sous lumière chaude » en « bleu » à la
  /// relecture : une certitude que la mesure n'a jamais eue, et que la
  /// personne qui ne peut pas vérifier n'aurait aucun moyen de corriger.
  static ColorReading? _couleurDepuisJson(Object? brut) {
    if (brut is! Map) return null;
    final label = _texte(brut['label']);
    if (label == null) return null;
    return ColorReading(
      label,
      alternative: _texte(brut['alternative']),
      nuance: _texte(brut['nuance']),
    );
  }

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
