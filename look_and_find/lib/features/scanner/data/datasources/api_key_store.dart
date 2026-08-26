/// La clé Gemini rangée sur l'appareil.
///
/// **Pourquoi permettre de la saisir plutôt que de la compiler.** Une clé
/// passée en `--dart-define` est une chaîne en clair dans le binaire : qui
/// obtient l'APK obtient la clé, et la changer impose de tout reconstruire.
/// Saisie dans l'application, elle se remplace en dix secondes le jour où elle
/// fuite, et l'APK distribué n'en porte aucune.
///
/// **Ce que ce rangement protège, et ce qu'il ne protège pas.** La boîte Hive
/// vit dans le dossier privé de l'application : les autres applications d'un
/// téléphone non débridé n'y accèdent pas. En revanche, un appareil débridé ou
/// une sauvegarde du système la lisent — d'où `android:allowBackup="false"`
/// dans le manifeste, qui empêche au moins la remontée automatique vers le
/// nuage. Pour un secret de plus grande valeur, il faudrait le trousseau du
/// système (`flutter_secure_storage`) ; pour une clé d'inférence personnelle
/// que l'on révoque d'un clic, ce niveau-ci est le bon compromis.
library;

import 'package:hive_flutter/hive_flutter.dart';

class ApiKeyStore {
  const ApiKeyStore(this._box);

  final Box<String> _box;

  static const String _cle = 'cle_gemini';

  /// `null` quand rien n'a été saisi — distinct d'une chaîne vide, qui serait
  /// une saisie effacée et vaut le même traitement.
  String? read() {
    final valeur = _box.get(_cle)?.trim();
    return valeur == null || valeur.isEmpty ? null : valeur;
  }

  Future<void> write(String valeur) => _box.put(_cle, valeur.trim());

  Future<void> clear() => _box.delete(_cle);
}
