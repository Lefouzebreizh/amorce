/// Palette de l'application.
///
/// Deux accents, deux rôles, jamais l'inverse : [action] désigne ce qu'il y a
/// à faire (déclencheur, bouton principal), [gain] désigne uniquement l'argent
/// économisé (meilleur prix, baisse détectée, alternative moins chère). Un
/// accent qui sert à deux choses ne signale plus rien.
///
/// Le fond est très sombre parce que la moitié du parcours est un viseur :
/// une interface claire autour d'un flux caméra fatigue l'œil et fausse la
/// perception des couleurs de l'objet visé.
library;

import 'package:flutter/material.dart';

class AppColors {
  const AppColors._();

  static const Color ink = Color(0xFF0B0D10);
  static const Color slab = Color(0xFF14181D);
  static const Color raised = Color(0xFF1D232B);
  static const Color edge = Color(0xFF2C333D);

  static const Color text = Color(0xFFF2F4F7);
  static const Color muted = Color(0xFF98A2B3);

  static const Color action = Color(0xFF7C5CFF);
  static const Color gain = Color(0xFF2FD177);
  static const Color alert = Color(0xFFFF6B6B);
  static const Color warn = Color(0xFFFFB84D);
}
