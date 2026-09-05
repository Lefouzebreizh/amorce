/// Ce que la version un rend d'un objet photographié.
///
/// **Ce n'est pas un `Product` amputé, et c'est délibéré.** La fiche produit
/// répond à « combien ça coûte et où l'acheter » ; celle-ci répond à « qu'est-ce
/// que c'est et comment on s'en sert ». Les deux notions partagent le mot
/// « fiche » et rien d'autre : ni les champs, ni le schéma demandé au modèle, ni
/// ce qu'on fait d'une valeur manquante. Les fondre dans un seul type aurait
/// donné une classe dont la moitié des champs est toujours nulle, et dont plus
/// personne ne sait lesquels sont censés l'être.
///
/// `product_detail` reste en place, testé et hors du parcours : la version deux
/// remettra le comparateur, et le retrouver intact coûtera moins cher que de le
/// réécrire.
///
/// **Pas de marque, pas de modèle** — c'est le périmètre de la version un. Une
/// catégorie suffit à choisir la notice, et demander une référence exacte est
/// justement ce qui pousse un modèle de langage à inventer.
///
/// Sans dépendance à Flutter, comme tout le domaine : c'est ce qui laisse
/// `tool/` rejouer une réponse en ligne de commande.
library;

import '../../../color_reader/domain/entities/color_reading.dart';

class FicheObjet {
  const FicheObjet({
    required this.nom,
    this.categorie,
    this.usage,
    this.matiere,
    this.caracteristiques = const [],
    this.conseils = const [],
    this.couleur,
    this.capturedAt,
    this.imagePath,
  });

  /// Le seul champ dont l'absence est fatale : sans nom, il n'y a rien à
  /// montrer, et l'application dit « objet non identifié ».
  final String nom;

  /// Le genre d'objet, en français courant (« couteau de cuisine », « perceuse
  /// sans fil »). C'est lui qui commande les conseils, et il n'est volontairement
  /// pas contraint par une énumération : le monde des objets ne tient pas dans
  /// quinze cases, et une valeur hors liste retomberait sur « Autre » en perdant
  /// ce que le modèle avait bien vu.
  final String? categorie;

  /// À quoi ça sert, en une ou deux phrases.
  final String? usage;

  /// La matière dominante telle qu'on la voit — « bois », « inox », « plastique
  /// mat ». Estimée sur la photo, donc faillible : l'interface ne la présente
  /// jamais comme une certitude.
  final String? matiere;

  /// Ce qui se voit sur la photo et aide à reconnaître l'objet : forme, pièces
  /// visibles, état. Jamais une caractéristique technique invisible, que le
  /// modèle ne pourrait que deviner.
  final List<String> caracteristiques;

  /// La notice condensée. Quelques gestes utiles pour la catégorie, pas un mode
  /// d'emploi du modèle exact — qu'on ne connaît pas et qu'on ne cherche pas.
  final List<String> conseils;

  /// **Lue sur la photo, pas demandée au modèle.** `color_reader` nomme la
  /// couleur du cadre visé et dit quand il hésite ; un modèle de langage rend
  /// un nom assuré même quand la surface est bicolore. Sur un champ que
  /// personne ne peut vérifier, l'aveu d'hésitation vaut mieux que l'aplomb.
  ///
  /// `null` quand la photo n'a pas pu être décodée — l'absence se dit, elle ne
  /// s'invente pas.
  final ColorReading? couleur;

  /// Posés par le cas d'usage, jamais par le modèle.
  final DateTime? capturedAt;
  final String? imagePath;

  bool get aDesConseils => conseils.isNotEmpty;

  FicheObjet copyWith({
    ColorReading? couleur,
    DateTime? capturedAt,
    String? imagePath,
  }) => FicheObjet(
    nom: nom,
    categorie: categorie,
    usage: usage,
    matiere: matiere,
    caracteristiques: caracteristiques,
    conseils: conseils,
    couleur: couleur ?? this.couleur,
    capturedAt: capturedAt ?? this.capturedAt,
    imagePath: imagePath ?? this.imagePath,
  );
}
