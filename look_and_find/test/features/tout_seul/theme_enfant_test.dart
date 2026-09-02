/// Les contrastes du thème enfant, **recalculés** plutôt que relus.
///
/// **Pourquoi ce test existe.** Les rapports sont écrits en toutes lettres dans
/// `theme_enfant.dart`, et un rapport écrit dans un commentaire vieillit sans
/// prévenir : il suffit d'éclaircir un brun d'un cran pour que le chiffre à
/// côté devienne faux, et personne ne recalcule un commentaire. Ici les valeurs
/// sont dérivées des jetons eux-mêmes, à chaque exécution.
///
/// **Ce qu'il ne prouve pas.** Qu'un écran soit lisible dehors, en plein soleil,
/// à travers un film de protection gras. Le rapport WCAG est un plancher
/// calculé, pas un verdict : il attrape ce qui est mathématiquement illisible,
/// et laisse passer ce qui est seulement fatigant.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/features/tout_seul/presentation/theme_enfant.dart';

/// Le rapport de contraste WCAG entre deux couleurs opaques.
///
/// `computeLuminance` de Flutter est exactement la luminance relative de la
/// norme : la formule n'est donc pas recopiée ici, où elle pourrait diverger.
double rapport(Color a, Color b) {
  final premiere = a.computeLuminance();
  final seconde = b.computeLuminance();
  final haute = premiere > seconde ? premiere : seconde;
  final basse = premiere > seconde ? seconde : premiere;
  return (haute + 0.05) / (basse + 0.05);
}

void main() {
  const cas = <(String, Color, Color, double)>[
    (
      'phrase de l\'étape, 34 pt',
      CouleursEnfant.encre,
      CouleursEnfant.fond,
      7,
    ),
    (
      'nom du geste sur la tuile',
      CouleursEnfant.encre,
      CouleursEnfant.carte,
      7,
    ),
    (
      'sous-titre de la grille',
      CouleursEnfant.encreDouce,
      CouleursEnfant.fond,
      4.5,
    ),
    (
      'libellé du grand bouton',
      CouleursEnfant.encre,
      CouleursEnfant.soleil,
      7,
    ),
    (
      'icônes des boutons ronds',
      CouleursEnfant.encre,
      CouleursEnfant.surfaceDouce,
      7,
    ),
    (
      'contour du bouton et frise remplie',
      CouleursEnfant.braise,
      CouleursEnfant.fond,
      3,
    ),
    (
      'contour d\'une tuile',
      CouleursEnfant.bordure,
      CouleursEnfant.carte,
      3,
    ),
    (
      'frise vide sur le fond',
      CouleursEnfant.bordure,
      CouleursEnfant.fond,
      3,
    ),
    (
      'flèche de retour éteinte',
      CouleursEnfant.eteint,
      CouleursEnfant.surfaceDouce,
      3,
    ),
  ];

  for (final (quoi, devant, derriere, seuil) in cas) {
    test('$quoi tient son contraste', () {
      final mesure = rapport(devant, derriere);
      expect(mesure, greaterThanOrEqualTo(seuil),
          reason: '$quoi : ${mesure.toStringAsFixed(2)}:1, il en faut '
              '$seuil. Une consigne se lit en biais, à bout de bras, dans une '
              'pièce éclairée par une fenêtre.');
    });
  }

  test('les deux rapports écrits dans la documentation sont encore vrais', () {
    // Ces deux-là sont cités dans `theme_enfant.dart` et dans
    // `main_tout_seul.dart`. Un commentaire qui ment sur un chiffre mesuré est
    // pire qu'un commentaire absent : on le recopie ailleurs.
    expect(rapport(CouleursEnfant.encre, CouleursEnfant.fond),
        closeTo(16.18, 0.05));
    expect(rapport(CouleursEnfant.encre, CouleursEnfant.soleil),
        closeTo(7.53, 0.05));
  });

  test('le thème est clair, et le fond n\'est pas le blanc pur', () {
    final theme = ThemeEnfant.clair;

    expect(theme.brightness, Brightness.light,
        reason: 'Un écran sombre se lit « éteint » à cinq ans : c\'est la '
            'raison d\'être de ce thème.');
    expect(theme.scaffoldBackgroundColor, CouleursEnfant.fond);
    expect(theme.scaffoldBackgroundColor.computeLuminance(),
        greaterThan(0.7));
    expect(CouleursEnfant.fond, isNot(const Color(0xFFFFFFFF)),
        reason: 'Le blanc pur brille sous une lampe ; la crème chaude non.');
  });

  test('la cible tactile de l\'enfant dépasse celle de l\'adulte', () {
    // 48 dp est la règle du dépôt, écrite pour le pouce d'un adulte. Le chiffre
    // est repris ici en clair plutôt qu'importé de `AppTheme` : *Tout seul* ne
    // dépend d'aucune ligne du thème marchand, et c'est une propriété qu'on ne
    // veut pas casser pour une constante.
    expect(ThemeEnfant.cible, greaterThan(48));
  });
}
