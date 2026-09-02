/// Le thème de *Tout seul* : clair, chaud, et **à lui seul**.
///
/// **Pourquoi il ne réutilise pas `AppTheme`.** Le thème du dépôt est sombre du
/// premier au dernier écran, et c'est un choix justifié — la moitié du parcours
/// de Look & Find est un viseur caméra, qu'un fond clair éblouirait. Ce
/// raisonnement ne s'applique pas ici : *Tout seul* n'ouvre aucune caméra, et
/// l'écran noir a un coût que l'adulte ne voit pas. **Un enfant de cinq ans lit
/// un écran sombre comme un écran éteint.** Il attend, il tapote, il repose le
/// téléphone. Aucune application d'apprentissage pour cet âge n'est sombre, et
/// ce n'est pas une mode.
///
/// `AppTheme` appartient à Look & Find et d'autres écrans le consomment : il
/// n'est ni modifié, ni importé ici. C'est aussi ce qui achève la cloison —
/// l'application enfant ne dépend plus d'une seule ligne du thème marchand.
///
/// ## Les contrastes, calculés et non estimés
///
/// Chaque couple porte son rapport WCAG, mesuré sur les valeurs ci-dessous. La
/// consigne était 7:1 sur le texte des étapes ; il est à **16,18:1**, parce
/// qu'une consigne se lit en biais, à bout de bras, souvent dans une pièce
/// éclairée par une fenêtre. Un rapport calculé une fois vaut mieux qu'un
/// rapport estimé à l'œil sur un écran calibré.
///
/// | ce qui se lit | rapport | seuil visé |
/// | --- | --- | --- |
/// | phrase de l'étape, 34 pt | 16,18:1 | 7 |
/// | nom du geste sur la tuile | 17,73:1 | 7 |
/// | sous-titre de la grille | 7,59:1 | 4,5 |
/// | libellé du grand bouton | 7,53:1 | 7 |
/// | icônes des boutons ronds | 14,26:1 | 7 |
/// | contour du bouton, frise remplie | 6,79:1 | 3 |
/// | contour d'une tuile | 3,41:1 | 3 |
/// | frise vide sur le fond | 3,11:1 | 3 |
/// | flèche de retour éteinte | 3,41:1 | 3 |
///
/// **Le piège du clair sur clair, et sa parade.** Deux surfaces claires ne se
/// distinguent jamais par leur teinte : une tuile blanche sur un fond crème
/// donne 1,10:1, autant dire rien. Ce n'est pas un défaut de palette, c'est une
/// impossibilité arithmétique — sur fond sombre, l'empilement de surfaces du
/// dépôt marche parce qu'il reste de la place vers le noir. Ici la limite du
/// blanc est atteinte tout de suite. **Ce qui sépare deux surfaces claires est
/// donc un trait**, jamais une nuance : contour de tuile, contour de bouton.
library;

import 'package:flutter/material.dart';

/// Les jetons de couleur de l'application enfant.
///
/// Aucun n'est repris de `AppColors`, qui est la palette sombre de Look & Find.
/// Les rôles sont volontairement les mêmes qu'ailleurs dans le dépôt — un
/// accent désigne ce qu'il y a à faire, et rien d'autre — mais les valeurs sont
/// chaudes plutôt que neutres : le gris institutionnel dit « formulaire », et
/// c'est exactement ce qu'on ne veut pas mettre dans les mains d'un enfant.
abstract final class CouleursEnfant {
  /// Le fond de l'application : une crème chaude, jamais le blanc pur, qui
  /// brille sous une lampe et fatigue plus vite qu'on ne le croit.
  static const Color fond = Color(0xFFFFF3E2);

  /// La surface d'une tuile, posée sur le fond et cernée d'un trait.
  static const Color carte = Color(0xFFFFFFFF);

  /// L'encre : un brun très sombre plutôt qu'un noir pur, qui vibre sur une
  /// surface chaude. 16,18:1 sur le fond, 17,73:1 sur une tuile.
  static const Color encre = Color(0xFF241505);

  /// Le texte secondaire — celui qui s'adresse à l'adulte. 7,59:1 sur le fond,
  /// bien au-delà des 4,5 exigés : il reste lisible, il n'est pas décoratif.
  static const Color encreDouce = Color(0xFF63492F);

  /// Le remplissage du grand bouton, et lui seul. Un orange franc, portant un
  /// libellé à l'encre : 7,53:1.
  static const Color soleil = Color(0xFFFF8A2B);

  /// Le trait qui cerne l'action : contour du grand bouton, segments franchis
  /// de la frise. 6,79:1 sur le fond — c'est ce qui rend le bouton identifiable
  /// comme bouton, et pas seulement lisible.
  static const Color braise = Color(0xFF9C2F08);

  /// Le trait neutre : contour d'une tuile, segments restant à faire.
  /// 3,41:1 sur une tuile blanche, 3,11:1 sur le fond.
  static const Color bordure = Color(0xFFA08768);

  /// La surface des boutons ronds — retour, sortie. 14,26:1 avec l'encre.
  static const Color surfaceDouce = Color(0xFFFFE2C0);

  /// Une commande éteinte : le retour, sur la première étape. 3,41:1 sur sa
  /// surface — visible, donc, et pas effacée : un bouton disparu se cherche,
  /// un bouton pâle se comprend.
  static const Color eteint = Color(0xFF8F775B);
}

abstract final class ThemeEnfant {
  /// La cible tactile de *Tout seul* : **72 dp**, là où le dépôt exige 48.
  ///
  /// Les 48 dp de `AppTheme.minTouchTarget` visent le pouce d'un adulte qui
  /// tient un objet de l'autre main. Ici la main qui vise a cinq ans : elle
  /// arrive de biais, corrige mal, et touche souvent à côté de ce qu'elle
  /// regarde. Le grand bouton d'avancement va bien au-delà (96 dp de haut) ;
  /// 72 est le plancher de tout le reste.
  static const double cible = 72;

  static ThemeData get clair {
    const nuancier = ColorScheme.light(
      primary: CouleursEnfant.soleil,
      onPrimary: CouleursEnfant.encre,
      secondary: CouleursEnfant.braise,
      onSecondary: Colors.white,
      surface: CouleursEnfant.carte,
      onSurface: CouleursEnfant.encre,
      outline: CouleursEnfant.bordure,
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: nuancier,
      scaffoldBackgroundColor: CouleursEnfant.fond,
    );

    return base.copyWith(
      textTheme: base.textTheme.apply(
        bodyColor: CouleursEnfant.encre,
        displayColor: CouleursEnfant.encre,
      ),
      // L'infobulle sert les lecteurs d'écran et les tests : elle n'est jamais
      // vue par l'enfant, qui ne maintient pas son doigt sur un bouton.
      tooltipTheme: const TooltipThemeData(
        textStyle: TextStyle(color: Colors.white, fontSize: 16),
      ),
    );
  }
}
