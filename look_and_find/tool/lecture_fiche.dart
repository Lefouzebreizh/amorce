/// Ce que la lecture fait d'une réponse brute, et ce qu'elle en laisse tomber.
///
/// **Pourquoi cet outil existe.** Quand une fiche est fausse, une seule
/// question compte : le modèle s'est-il trompé, ou l'avons-nous mal lu ? Y
/// répondre à l'œil demande de tenir ensemble `gemini_prompt.dart`,
/// `product_dto.dart` et le JSON reçu — trois documents qu'on ne compare pas
/// de tête, surtout au moment où l'on est pressé de corriger.
///
/// Le diagnostic ci-dessous répond mécaniquement : il fait passer le JSON par
/// la vraie lecture, puis **nomme chaque information perdue en chemin**. Ce qui
/// reste faux après ce filtre est, par élimination, une erreur du modèle — donc
/// de l'invite.
///
/// Partagé entre `rejouer.dart` (une réponse déjà obtenue) et
/// `banc_invite.dart` (une réponse qu'on va chercher). Même question, seule la
/// provenance change.
library;

import 'package:look_and_find/features/product_detail/data/models/product_dto.dart';
import 'package:look_and_find/features/product_detail/domain/entities/product.dart';
import 'package:look_and_find/features/scanner/data/datasources/gemini_prompt.dart';

/// Les clés que l'application écrit elle-même après l'identification. Le modèle
/// n'a pas à les renvoyer, et leur absence du schéma n'est pas un oubli.
const Set<String> clesLocales = {'id', 'captured_at', 'image_path'};

class Diagnostic {
  Diagnostic(this.fiche, this.pertes);

  /// `null` quand la réponse ne portait pas de titre : il n'y a alors pas de
  /// fiche, et l'application affiche « objet non identifié ».
  final Product? fiche;

  /// Une ligne par information présente dans la réponse et absente de la fiche.
  final List<String> pertes;

  bool get concorde => pertes.isEmpty;
}

Diagnostic analyser(Map<String, dynamic> json) {
  final pertes = <String>[];
  final declarees = (GeminiPrompt.responseSchema['properties']! as Map).keys
      .cast<String>()
      .toSet();

  for (final cle in json.keys) {
    if (!declarees.contains(cle) && !clesLocales.contains(cle)) {
      pertes.add('$cle : clé absente du schéma, donc jamais lue.');
    }
  }

  final fiche = ProductDto.fromJson(json).toEntity();
  if (fiche == null) {
    pertes.add(
      'title : vide ou absent. C\'est le seul champ dont l\'absence est '
      'fatale — sans nom d\'objet, il n\'y a pas de fiche à montrer.',
    );
    return Diagnostic(null, pertes);
  }

  _entreesEcartees(json['merchants'], 'name', 'merchants', pertes);
  _entreesEcartees(json['alternatives'], 'title', 'alternatives', pertes);

  if (json['model_3d_url'] != null && fiche.model3dUrl == null) {
    pertes.add(
      'model_3d_url : « ${json['model_3d_url']} » écarté, seules les URL '
      'http(s) passent. La projection en réalité augmentée sera indisponible.',
    );
  }

  if (json['average_price'] != null && fiche.averagePrice == 0) {
    pertes.add(
      'average_price : « ${json['average_price']} » n\'a pas pu être lu comme '
      'un nombre, le prix moyen retombe à 0.',
    );
  }

  final categorie = json['category']?.toString().trim().toLowerCase();
  if (categorie != null &&
      categorie != 'unknown' &&
      fiche.category == ProductCategory.unknown) {
    pertes.add(
      'category : « ${json['category']} » hors énumération, affichée '
      '« Autre ». Attendu : furniture, tech, appliance ou decor.',
    );
  }

  final cotes = json['dimensions'];
  if (cotes is Map &&
      cotes.values.any((v) => v != null) &&
      fiche.dimensions.isEmpty) {
    pertes.add(
      'dimensions : aucune cote exploitable dans $cotes — la projection à '
      'l\'échelle 1:1 n\'aura pas de repère.',
    );
  }

  return Diagnostic(fiche, pertes);
}

/// Rejoue la règle d'acceptation du DTO sur chaque entrée d'une liste, pour
/// pouvoir dire **laquelle** est tombée et pourquoi. Compter les survivants ne
/// suffirait pas : « 2 sur 5 retenus » n'indique pas quoi corriger.
void _entreesEcartees(
  Object? brut,
  String cleNom,
  String liste,
  List<String> pertes,
) {
  if (brut is! List) return;
  for (var i = 0; i < brut.length; i++) {
    final entree = brut[i];
    if (entree is! Map) {
      pertes.add('$liste[$i] : ce n\'est pas un objet, entrée ignorée.');
      continue;
    }
    final nom = entree[cleNom];
    if (nom == null || nom.toString().trim().isEmpty) {
      pertes.add('$liste[$i] : « $cleNom » manquant, entrée ignorée.');
      continue;
    }
    if (_nombre(entree['price']) == null) {
      pertes.add(
        '$liste[$i] ($nom) : prix « ${entree['price']} » illisible, '
        'entrée ignorée.',
      );
    }
  }
}

/// Même nettoyage que `ProductDto._double` : c'est ce qui rend le verdict
/// fidèle plutôt que ressemblant.
double? _nombre(Object? brut) {
  if (brut is num) return brut.toDouble();
  if (brut is! String) return null;
  return double.tryParse(
    brut.replaceAll(RegExp(r'[^0-9,.\-]'), '').replaceAll(',', '.'),
  );
}

/// Le rapport tel qu'il s'affiche dans un terminal.
String rapport(Diagnostic d) {
  final b = StringBuffer();
  b.writeln('── Ce que la lecture en fait');
  final f = d.fiche;
  if (f == null) {
    b.writeln('  Aucune fiche : le titre manque.');
  } else {
    void ligne(String cle, Object? valeur) =>
        b.writeln('  ${cle.padRight(14)}${valeur ?? '—'}');
    ligne('Titre', f.displayTitle);
    ligne('Catégorie', f.category.label);
    ligne('Prix moyen', '${f.averagePrice} ${f.currency}');
    ligne('Dimensions', _cotes(f.dimensions));
    ligne('Marchands', '${f.merchants.length} retenu(s)');
    ligne('Alternatives', '${f.alternatives.length} retenue(s)');
    ligne('Modèle 3D', f.canBeViewedInAr ? f.model3dUrl : 'aucun');
  }
  b.writeln();
  b.writeln('── Ce qui s\'est perdu entre la réponse et la fiche');
  if (d.concorde) {
    b.writeln('  Rien. Tout ce que le modèle a renvoyé est affiché.');
  } else {
    for (final perte in d.pertes) {
      b.writeln('  • $perte');
    }
  }
  b.writeln();
  b.writeln('── Verdict');
  b.writeln(
    d.concorde
        ? '  La fiche dit exactement ce que le modèle a dit.\n'
              '  Si elle est fausse, corriger l\'invite :\n'
              '  lib/features/scanner/data/datasources/gemini_prompt.dart'
        : '  La lecture a écarté ce qui est listé ci-dessus.\n'
              '  Si ces informations étaient justes, corriger la lecture :\n'
              '  lib/features/product_detail/data/models/product_dto.dart',
  );
  return b.toString();
}

String _cotes(ProductDimensions d) {
  if (d.isEmpty) return '—';
  String c(double? v) => v == null ? '?' : v.toStringAsFixed(0);
  return '${c(d.width)} × ${c(d.height)} × ${c(d.depth)} ${d.unit}';
}
