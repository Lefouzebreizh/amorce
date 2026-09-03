/// Nommer la couleur d'un **cadre**, et refuser de nommer une moyenne qui
/// n'existe nulle part.
///
/// ## Le défaut que ce fichier corrige
///
/// `NameColor.of()` nomme un point. Le viseur, lui, couvre une surface, et la
/// façon évidente de les relier — moyenner puis nommer la moyenne — porte un
/// défaut nommé dans `projets-actifs/reconnaissance-de-couleurs.md` sous « ce
/// qui la ferait tomber » : **un réticule sur une rayure rend la moyenne des
/// deux couleurs, qui n'existe nulle part**. Un pull rouge et blanc rend un rose
/// que personne ne voit, avec l'aplomb d'une couleur franche.
///
/// Ce n'est pas un défaut d'esthétique. La fiche pose que la personne qui s'en
/// sert **ne peut pas vérifier** : pour elle, une réponse fausse et assurée est
/// pire que pas de réponse.
///
/// ## Deux choses qui n'ont pas été faites, et pourquoi
///
/// **`NameColor` n'est pas modifié.** C'est une brique partagée — Accord la
/// reprend telle quelle — et lui ajouter une notion de cadre l'aurait fait
/// dépendre d'un usage que son autre appelant n'a pas.
///
/// **Aucune science de la couleur n'est écrite ici.** La table reste la seule
/// autorité : on compte des **noms qu'elle rend**, jamais des degrés. Une
/// dispersion mesurée autrement crierait sur un dégradé qu'elle nomme d'un seul
/// nom, et se tairait sur deux teintes voisines qu'elle sépare.
///
/// C'est aussi pourquoi ce n'est pas un doublon de la dispersion de
/// `JudgePhoto` : celle-là répond « puis-je calculer une harmonie de décoration
/// », avec des seuils réglés sur des surfaces de décoration et un vocabulaire
/// de refus qui parle de murs et de canapés. Celle-ci répond « ce nom est-il
/// celui de ce que je vois », et sa réponse est toujours un nom.
///
/// ## Ce que trois mesures ont coûté, et ce qu'elles ont appris
///
/// Mesuré le 03/09/2026 sur des cadres réels : trois surfaces unies — un plaid
/// kaki, un fauteuil clair, un mur peint — contre six cadres qui portent
/// plusieurs choses.
///
/// | candidate | ce qu'elle comptait | pourquoi elle est écartée |
/// | --- | --- | --- |
/// | part du nom majoritaire | le nom le plus fréquent | unies 0,594–0,996 contre mêlés 0,293–0,497 : **plages qui se touchent** |
/// | part portant le nom de la moyenne | le nom réellement annoncé | pire : le plaid tombe à **0,196**, sous tous les cadres mêlés |
/// | la même, clarté neutralisée | ci-dessous | une nef d'église atteint **0,928**, au-dessus de deux surfaces unies |
///
/// Les deux premières échouent pour **une seule cause** : `NameColor` change de
/// nom avec la clarté — « gris » et « gris clair », « orange » et « marron » —
/// si bien qu'une ombre sur un mur uni compte comme une seconde couleur. D'où
/// la troisième, qui ramène chaque pixel à la clarté du cadre avant de le
/// nommer. Elle est conservée pour cette raison-là, pas parce qu'elle sépare.
///
/// ## Le seuil qui reste, et pourquoi il n'y en a qu'un
///
/// La troisième mesure ne sépare pas non plus les surfaces unies des scènes —
/// **et c'est en s'en apercevant qu'on a vu que la question était mal posée**.
/// Annoncer « deux couleurs » sur une scène encombrée n'est pas un faux
/// positif : c'est la bonne réponse, puisque la moyenne n'y nomme rien. La
/// seule chose interdite est de le dire d'une **surface unie**.
///
/// L'exigence est donc à un seul côté, et un seul seuil y suffit : la part du
/// **second** nom. Le seuil de majorité, celui qui n'avait pas de vide où se
/// poser, est retiré.
///
/// **La marge est mince et le corpus est court** : trois surfaces unies
/// plafonnent à 0,122 de second nom, le premier cadre mêlé est à 0,151. Trois
/// centièmes séparent les deux, sur trois exemplaires d'un côté. Ce seuil se
/// remesure dès qu'il existe des photos prises dans l'application, viseur à
/// l'écran — c'est écrit dans la fiche, et ce n'est pas une précaution de style.
library;

import '../entities/color_reading.dart';
import 'name_color.dart';

class LectureCadre {
  const LectureCadre._();

  /// Part que le second nom doit atteindre pour qu'on annonce deux couleurs.
  ///
  /// Mesuré : surfaces unies jusqu'à **0,122**, premier cadre réellement mêlé à
  /// **0,151**. Voir le bloc de tête pour ce que cette marge vaut.
  static const double _partSeconde = 0.14;

  /// Nomme la couleur d'un échantillon de pixels.
  ///
  /// Rend exactement ce que `NameColor.of()` rend sur la moyenne tant que le
  /// cadre porte une seule couleur — c'est le cas courant, et il ne devait pas
  /// changer.
  static ColorReading lire(List<(int, int, int)> pixels) {
    if (pixels.isEmpty) return const ColorReading('noir');

    final moyenne = _moyenne(pixels);
    final lectureMoyenne = NameColor.of(moyenne.$1, moyenne.$2, moyenne.$3);

    // Les pixels sont regroupés sur leur nom **à clarté neutralisée**, mais
    // chaque groupe garde ses pixels d'origine : la neutralisation sert à
    // décider s'il y a deux couleurs, jamais à les nommer.
    //
    // Elle détruirait le nom, d'ailleurs, et c'est mesuré : ramené à la clarté
    // moyenne d'un cadre rouge et blanc, le blanc ressort « gris clair ». Le
    // blanc est une clarté — la neutraliser efface ce qui le définit.
    final cible = _clarteMoyenne(pixels);
    final groupes = <String, List<(int, int, int)>>{};
    for (final pixel in pixels) {
      final (r, g, b) = _ramene(pixel.$1, pixel.$2, pixel.$3, cible);
      groupes.putIfAbsent(NameColor.of(r, g, b).label, () => []).add(pixel);
    }

    final classes = groupes.entries.toList()
      ..sort((a, b) => b.value.length.compareTo(a.value.length));
    if (classes.length < 2) return lectureMoyenne;
    if (classes[1].value.length / pixels.length < _partSeconde) {
      return lectureMoyenne;
    }

    // Deux couleurs pour de bon. On annonce **celles qui sont là** — chaque
    // groupe nommé sur ses vrais pixels — et jamais la moyenne : c'est elle qui
    // n'existe nulle part, et la donner même en second reviendrait à la
    // présenter comme une couleur vue.
    final premier = _nomDuGroupe(classes[0].value);
    final second = _nomDuGroupe(classes[1].value);
    if (premier == second) return lectureMoyenne;

    return ColorReading(
      premier,
      alternative: second,
      nuance: 'deux couleurs dans le viseur',
    );
  }

  /// Clarté perçue : l'œil est deux fois plus sensible au vert qu'au rouge, et
  /// six fois plus qu'au bleu. Même pondération que dans `JudgePhoto`, pour que
  /// deux endroits du dépôt ne décrivent pas la lumière autrement.
  static double _clarte(int r, int g, int b) =>
      (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  static double _clarteMoyenne(List<(int, int, int)> pixels) {
    var somme = 0.0;
    for (final (r, g, b) in pixels) {
      somme += _clarte(r, g, b);
    }
    return somme / pixels.length;
  }

  /// Ramène un pixel à la clarté [cible] sans toucher à sa teinte, pour que
  /// l'ombre d'un mur uni ne compte pas comme une seconde couleur.
  ///
  /// Un point presque noir est laissé tel quel : le multiplier amplifierait le
  /// bruit du capteur en une teinte franche qui n'existe pas.
  static (int, int, int) _ramene(int r, int g, int b, double cible) {
    final c = _clarte(r, g, b);
    if (c < 0.02) return (r, g, b);
    final k = cible / c;
    int borne(num v) => v.clamp(0, 255).round();
    return (borne(r * k), borne(g * k), borne(b * k));
  }

  /// Le nom d'un groupe, pris sur ses pixels d'origine.
  static String _nomDuGroupe(List<(int, int, int)> groupe) {
    final m = _moyenne(groupe);
    return NameColor.of(m.$1, m.$2, m.$3).label;
  }

  static (int, int, int) _moyenne(List<(int, int, int)> pixels) {
    var r = 0, v = 0, b = 0;
    for (final p in pixels) {
      r += p.$1;
      v += p.$2;
      b += p.$3;
    }
    final n = pixels.length;
    return ((r / n).round(), (v / n).round(), (b / n).round());
  }
}
