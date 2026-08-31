/// Les trois harmonies d'un mur, traduites en objets et en proportions.
///
/// **Trois décisions, et aucune n'est de l'arithmétique de roue chromatique.**
///
/// *La complémentaire ne se pose jamais en grand.* Une couleur opposée occupe
/// dix pour cent ou elle fait vibrer la pièce. C'est pourquoi elle sort ici en
/// coussin et en pot, jamais en tapis — la contrainte est dans le produit, pas
/// dans un conseil qu'on lirait ailleurs.
///
/// *Une harmonie prise telle quelle est invivable.* Le complément exact d'un
/// mur ocre est un bleu saturé de nuancier, qui n'existe dans aucun magasin et
/// que personne ne veut chez soi. Chaque proposition est donc **ramenée dans
/// une plage de saturation et de clarté tenable**, différente selon qu'elle
/// occupe trente ou dix pour cent : ce qui couvre beaucoup se tait, ce qui
/// ponctue peut crier.
///
/// *Les objets ne décorent pas la sortie, ils la rendent utilisable.* « Voici
/// trois couleurs » laisse la personne devant son mur. La quantité désigne
/// l'objet : à trente pour cent des surfaces textiles, à dix pour cent des
/// choses qu'on pose.
///
/// **Et une réponse vraie peut être inutile.** À trente degrés d'un mur vert,
/// l'analogue est encore un vert : « posez un tapis vert sur votre mur vert »
/// ne dit rien, même si l'angle est juste.
///
/// La première parade essayée fut d'écarter la teinte jusqu'à changer de nom.
/// Elle échoue, et pour une raison de fond : la bande du vert fait quatre-vingts
/// degrés, on n'en sort pas sans cesser d'être analogue. **Ce n'est pas le nom
/// qui doit différer, c'est la valeur** — un schéma analogue partage la famille
/// par définition, et ce qui le rend lisible est l'écart de clarté. La grande
/// surface analogue est donc posée franchement plus claire ou plus sombre que
/// le mur : « un tapis vert plus clair » se voit, s'achète, et reste analogue.
library;

import '../entities/harmonie.dart';

class BuildHarmonies {
  const BuildHarmonies._();

  /// Ce qui couvre trente pour cent d'une pièce se regarde longtemps : la
  /// saturation y reste modérée et la clarté proche de celle du mur, faute de
  /// quoi la pièce se coupe en deux.
  static const double _satMax30 = 0.45;
  static const double _satMin30 = 0.15;

  /// Ce qui ponctue peut être franc : c'est même sa raison d'être. Une couleur
  /// d'accent terne ne ponctue rien et passe pour une erreur.
  static const double _satMin10 = 0.45;
  static const double _satMax10 = 0.80;

  static List<Harmonie> pour(int rouge, int vert, int bleu) {
    final (teinte, saturation, luminosite) = _tsl(rouge, vert, bleu);
    return [
      Harmonie(TypeHarmonie.complementaire, [
        _proposition(teinte + 150, saturation, luminosite, 30),
        _proposition(teinte + 180, saturation, luminosite, 10),
      ]),
      Harmonie(TypeHarmonie.analogue, [
        _proposition(teinte + 30, saturation, luminosite, 30,
            ecarterClarte: true),
        _proposition(teinte - 30, saturation, luminosite, 10),
      ]),
      Harmonie(TypeHarmonie.triadique, [
        _proposition(teinte + 120, saturation, luminosite, 30),
        _proposition(teinte + 240, saturation, luminosite, 10),
      ]),
    ];
  }

  static Proposition _proposition(
    double teinte,
    double saturationMur,
    double luminositeMur,
    int part, {
    bool ecarterClarte = false,
  }) {
    final s = part == 30
        ? saturationMur.clamp(_satMin30, _satMax30)
        : saturationMur.clamp(_satMin10, _satMax10);

    // Le trente pour cent reste dans la clarté du mur, à un cheveu près : deux
    // grandes surfaces de clartés opposées coupent la pièce en deux. Le dix
    // pour cent, lui, s'écarte franchement — c'est ce qui le fait voir.
    final l = part == 30
        ? (ecarterClarte
                ? (luminositeMur < 0.5
                    ? luminositeMur + 0.16
                    : luminositeMur - 0.16)
                : luminositeMur)
            .clamp(0.30, 0.72)
        : (luminositeMur < 0.5 ? luminositeMur + 0.22 : luminositeMur - 0.22)
            .clamp(0.25, 0.70);

    final (r, v, b) = _versRvb(teinte % 360, s.toDouble(), l.toDouble());
    return Proposition(
      part: part,
      rouge: r,
      vert: v,
      bleu: b,
      objets: part == 30
          ? const ['tapis', 'rideaux', 'plaid']
          : const ['coussin', 'pot', 'vase'],
    );
  }

  static (double, double, double) _tsl(int r, int g, int b) {
    final rn = r / 255, gn = g / 255, bn = b / 255;
    final max = [rn, gn, bn].reduce((a, x) => a > x ? a : x);
    final min = [rn, gn, bn].reduce((a, x) => a < x ? a : x);
    final delta = max - min;
    final luminosite = (max + min) / 2;
    if (delta == 0) return (0, 0, luminosite);
    double teinte;
    if (max == rn) {
      teinte = ((gn - bn) / delta) % 6;
    } else if (max == gn) {
      teinte = (bn - rn) / delta + 2;
    } else {
      teinte = (rn - gn) / delta + 4;
    }
    teinte *= 60;
    return (teinte < 0 ? teinte + 360 : teinte, delta / max, luminosite);
  }

  /// Retour vers le rouge-vert-bleu. La saturation reçue est celle de TSV
  /// (`delta / max`), comme partout dans Accord et dans `NameColor` : la forme
  /// TSL s'emballe près du blanc et rendrait des pastels pour des couleurs
  /// franches.
  static (int, int, int) _versRvb(double teinte, double satTsv, double lum) {
    // La valeur se déduit exactement : par définition, `lum` vaut la moyenne du
    // plus clair et du plus sombre, soit `v - c / 2`, et `c` vaut `satTsv * v`.
    // D'où `v = lum / (1 - satTsv / 2)`.
    //
    // La version précédente calculait cette valeur comme si `satTsv` était une
    // saturation TSL, et rendait 0,62 là où 0,45 était demandé : un tapis qui
    // crie alors que la borne existait pour l'en empêcher. Mélanger les deux
    // conventions dans un même calcul ne lève aucune erreur, ça décale
    // simplement toutes les couleurs.
    final v = (lum / (1 - satTsv / 2)).clamp(0.0, 1.0);
    final c = satTsv * v;
    final x = c * (1 - ((teinte / 60) % 2 - 1).abs());
    final m = v - c;
    final (r, g, b) = switch (teinte ~/ 60) {
      0 => (c, x, 0.0),
      1 => (x, c, 0.0),
      2 => (0.0, c, x),
      3 => (0.0, x, c),
      4 => (x, 0.0, c),
      _ => (c, 0.0, x),
    };
    return (
      ((r + m) * 255).round().clamp(0, 255),
      ((g + m) * 255).round().clamp(0, 255),
      ((b + m) * 255).round().clamp(0, 255),
    );
  }
}
