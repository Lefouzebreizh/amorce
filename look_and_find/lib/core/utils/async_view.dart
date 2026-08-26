/// Afficher un [AsyncValue] sans laisser une erreur passer pour un chargement.
///
/// **Le piège que ceci corrige.** En Riverpod 3, un état peut être « en
/// chargement » **et** porter une erreur en même temps : après l'échec d'un
/// `build`, `isLoading` et `hasError` sont vrais tous les deux. `AsyncValue.when`
/// teste le chargement en premier — il affiche donc l'indicateur de progression,
/// et l'erreur n'apparaît jamais.
///
/// Concrètement, avant cette correction : un accès caméra refusé faisait tourner
/// un indicateur indéfiniment sous les yeux de l'utilisateur, au lieu d'afficher
/// le message qui explique quoi faire et le bouton qui débloque.
///
/// L'ordre ici est donc **l'erreur d'abord**, et il n'est pas négociable.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

extension AsyncViewX<T> on AsyncValue<T> {
  /// Comme `when`, mais l'erreur l'emporte sur le chargement.
  ///
  /// Une donnée déjà chargée l'emporte à son tour sur un rechargement en cours :
  /// remplacer un écran rempli par un indicateur à chaque rafraîchissement fait
  /// clignoter l'interface pour rien.
  R render<R>({
    required R Function(Object error, StackTrace? stack) error,
    required R Function() loading,
    required R Function(T value) data,
  }) {
    if (hasError) return error(this.error!, stackTrace);
    if (hasValue) return data(value as T);
    return loading();
  }
}

/// Indicateur de chargement centré, celui de tous les écrans.
class ChargementCentre extends StatelessWidget {
  const ChargementCentre({super.key});

  @override
  Widget build(BuildContext context) =>
      const Center(child: CircularProgressIndicator());
}
