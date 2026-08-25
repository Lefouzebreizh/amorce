/// Thème unique de l'application.
///
/// Le studio est sombre du premier au dernier écran : un fond clair derrière
/// un viseur caméra éblouit en intérieur, et le passage viseur → fiche →
/// réalité augmentée impose une adaptation de l'œil à chaque bascule. Il n'y a
/// donc **pas** de variante claire, et c'est un choix, pas un oubli.
///
/// Le design se fait par surfaces empilées ([AppColors.ink] < `slab` <
/// `raised`), pas par contours : une bordure est réservée à ce qui sépare
/// vraiment, ou à ce qui est sélectionné.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../constants/app_colors.dart';

class AppTheme {
  const AppTheme._();

  /// Cibles tactiles : 48 dp partout. Le déclencheur du viseur et les tuiles
  /// marchand se touchent d'une main, souvent en tenant l'objet de l'autre.
  static const double minTouchTarget = 48;

  static ThemeData get dark {
    const scheme = ColorScheme.dark(
      primary: AppColors.action,
      onPrimary: Colors.white,
      secondary: AppColors.gain,
      onSecondary: AppColors.ink,
      surface: AppColors.slab,
      onSurface: AppColors.text,
      surfaceContainerHighest: AppColors.raised,
      error: AppColors.alert,
      onError: Colors.white,
      outline: AppColors.edge,
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.ink,
      splashFactory: InkSparkle.splashFactory,
    );

    return base.copyWith(
      textTheme: _texts(base.textTheme),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        systemOverlayStyle: SystemUiOverlayStyle.light,
        titleTextStyle: TextStyle(
          color: AppColors.text,
          fontSize: 20,
          fontWeight: FontWeight.w600,
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.slab,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(minTouchTarget),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(minTouchTarget),
          foregroundColor: AppColors.text,
          side: const BorderSide(color: AppColors.edge),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.slab,
        indicatorColor: AppColors.action.withValues(alpha: 0.22),
        surfaceTintColor: Colors.transparent,
        height: 64,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.raised,
        contentTextStyle: const TextStyle(color: AppColors.text),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.slab,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.edge,
        thickness: 1,
        space: 1,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.action,
        linearTrackColor: AppColors.edge,
      ),
    );
  }

  /// Un seul écart d'échelle marqué : le prix. C'est la donnée qu'on cherche
  /// dans la fiche, tout le reste est contexte.
  static TextTheme _texts(TextTheme base) => base.copyWith(
    displaySmall: base.displaySmall?.copyWith(
      color: AppColors.text,
      fontWeight: FontWeight.w700,
      letterSpacing: -1,
    ),
    titleLarge: base.titleLarge?.copyWith(
      color: AppColors.text,
      fontWeight: FontWeight.w600,
    ),
    titleMedium: base.titleMedium?.copyWith(
      color: AppColors.text,
      fontWeight: FontWeight.w600,
    ),
    bodyMedium: base.bodyMedium?.copyWith(color: AppColors.text, height: 1.45),
    bodySmall: base.bodySmall?.copyWith(color: AppColors.muted, height: 1.4),
    labelLarge: base.labelLarge?.copyWith(fontWeight: FontWeight.w600),
  );
}
