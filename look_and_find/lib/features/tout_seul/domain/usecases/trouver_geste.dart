/// L'aiguillage de « Tout seul » : un nom d'objet entre, un verdict sort.
///
/// **Écrit comme la porte d'Accord, et pour la même raison** : ce qui protège
/// l'utilisateur n'est pas la qualité de la réponse, c'est la capacité à ne pas
/// répondre. Ici le refus est même la branche la plus fréquente — le monde
/// contient bien plus de dix-sept objets — et c'est donc elle qui doit être
/// juste, pas l'autre.
///
/// ## Pourquoi une normalisation, et pourquoi celle-ci
///
/// L'étiquette ne vient pas d'un menu : elle vient d'un appareil photo et d'un
/// modèle de reconnaissance. Elle arrive donc en majuscules ou non, accentuée
/// ou non, au singulier ou au pluriel, avec ou sans article — « Lacets », « les
/// chaussures », « BROSSE À DENTS ». Quatre écritures du même objet, et sans
/// normalisation, trois refus sur quatre.
///
/// La normalisation s'applique **des deux côtés** : à l'étiquette reçue et aux
/// étiquettes du corpus, par la même fonction. C'est ce qui rend le pluriel
/// approximatif sans danger — « tapis » devient « tapi » des deux côtés, donc
/// se retrouve. Une règle de pluriel juste linguistiquement mais appliquée d'un
/// seul côté ferait exactement l'inverse.
///
/// ## Ce que l'aiguillage ne fait pas, délibérément
///
/// Aucune approximation : ni distance d'édition, ni « le geste le plus proche »,
/// ni repli sur le premier geste du corpus. Un enfant qui montre une ceinture ne
/// reçoit pas le tuto des lacets parce que les deux se nouent. Il reçoit un
/// refus qui nomme trois objets connus, et il en montre un.
library;

import '../corpus/corpus_gestes.dart';
import '../entities/geste.dart';
import '../entities/verdict_geste.dart';

abstract final class TrouverGeste {
  /// Les mots qu'un modèle de reconnaissance colle devant un objet et qui ne
  /// désignent rien. Ils ne sont retirés qu'**en tête** : « tour de cou » perd
  /// son sens si l'on retire le « de » du milieu.
  static const Set<String> _determinants = {
    'le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de', 'd',
    'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses',
    'ce', 'cet', 'cette', 'au', 'aux',
  };

  /// Rend le verdict du corpus pour un nom d'objet.
  static VerdictGeste pour(String etiquette) {
    final clef = normaliser(etiquette);
    if (clef.isEmpty) {
      return GesteInconnu(RaisonInconnue.rienDeReconnu, conseilDeRepli);
    }
    final geste = _index[clef];
    if (geste == null) {
      return GesteInconnu(RaisonInconnue.horsCorpus, conseilDeRepli);
    }
    return GesteTrouve(geste, clef);
  }

  /// Le geste à poser derrière un refus, construit à partir du corpus lui-même
  /// plutôt qu'écrit à la main : un conseil qui citerait un objet retiré du
  /// corpus enverrait l'enfant vers un second refus, et rien ne le signalerait.
  static String get conseilDeRepli {
    final objets = CorpusGestes.exemples.map((e) => e.$2).toList();
    final dernier = objets.removeLast();
    return 'Montre-moi ${objets.join(', ')}, ou $dernier.';
  }

  /// Met une étiquette dans la forme unique sous laquelle le corpus l'indexe :
  /// minuscules, sans accent, sans ponctuation, sans article de tête, chaque
  /// mot ramené au singulier.
  static String normaliser(String brut) {
    final sansAccent = _sansAccents(brut.toLowerCase());
    // Tirets et apostrophes deviennent des espaces : « cache-nez » et
    // « cache nez » sont le même objet, « t-shirt » et « t shirt » aussi.
    final propre = sansAccent.replaceAll(RegExp('[^a-z0-9]+'), ' ').trim();
    if (propre.isEmpty) return '';

    var mots = propre.split(' ');
    while (mots.length > 1 && _determinants.contains(mots.first)) {
      mots = mots.sublist(1);
    }
    if (_determinants.contains(mots.first) && mots.length == 1) return '';
    return mots.map(_singulier).join(' ');
  }

  /// Retire la marque du pluriel. La règle est volontairement grossière — elle
  /// écorche « tapis » en « tapi » — parce qu'elle s'applique des deux côtés :
  /// ce qui compte n'est pas d'avoir raison en français, c'est que la même
  /// entrée donne toujours la même sortie. Les mots de trois lettres sont
  /// laissés tranquilles, sinon « bas » deviendrait « ba » et « nez », « ne ».
  static String _singulier(String mot) {
    if (mot.length < 4) return mot;
    if (mot.endsWith('s') || mot.endsWith('x')) {
      return mot.substring(0, mot.length - 1);
    }
    return mot;
  }

  static String _sansAccents(String texte) {
    const equivalences = {
      'à': 'a', 'â': 'a', 'ä': 'a', 'á': 'a',
      'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
      'î': 'i', 'ï': 'i', 'í': 'i',
      'ô': 'o', 'ö': 'o', 'ó': 'o',
      'ù': 'u', 'û': 'u', 'ü': 'u', 'ú': 'u',
      'ç': 'c', 'ñ': 'n', 'œ': 'oe', 'æ': 'ae',
    };
    final tampon = StringBuffer();
    for (final lettre in texte.split('')) {
      tampon.write(equivalences[lettre] ?? lettre);
    }
    return tampon.toString();
  }

  /// L'index des étiquettes, construit une fois.
  ///
  /// Deux gestes qui revendiquent le même mot est un **défaut de corpus** : la
  /// réponse dépendrait alors de l'ordre d'écriture, et l'enfant recevrait
  /// tantôt l'un tantôt l'autre. L'assertion le fait éclater en test et en
  /// développement ; en production, le premier écrit l'emporte, parce qu'un
  /// tuto de lacets vaut mieux qu'une application qui refuse de démarrer.
  /// Le test `corpus_gestes_test.dart` interdit ce cas indépendamment des
  /// assertions, qui sont désactivées dans un binaire de production.
  static final Map<String, Geste> _index = _construireIndex();

  static Map<String, Geste> _construireIndex() {
    final index = <String, Geste>{};
    for (final geste in CorpusGestes.gestes) {
      for (final etiquette in geste.etiquettes) {
        final clef = normaliser(etiquette);
        final deja = index[clef];
        assert(
          deja == null || identical(deja, geste),
          'L\'étiquette « $clef » est revendiquée par '
          '${deja.identifiant} et par ${geste.identifiant}.',
        );
        index.putIfAbsent(clef, () => geste);
      }
    }
    return index;
  }
}
