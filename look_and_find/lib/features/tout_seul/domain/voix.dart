/// Ce que *Tout seul* attend d'une voix, et rien de plus.
///
/// **Pourquoi une interface plutôt qu'un appel direct à `flutter_tts`.**
/// L'utilisateur ne sait pas lire : la voix n'est pas un confort, c'est le seul
/// canal de sortie. Elle traverse donc toute la présentation, et un appel direct
/// au greffon rendrait chaque écran intestable — la synthèse passe par le moteur
/// du système, absent de tout banc de test.
///
/// Avec ce port, la présentation se vérifie contre une fausse voix qui note ce
/// qu'on lui a demandé de dire, et l'adaptateur réel reste une lame mince, seule
/// pièce qui exige un vrai téléphone.
///
/// **La frontière du vérifiable est ici, et il faut la dire :** que la voix
/// prononce réellement une phrase ne se mesure que sur un appareil. Ce qui se
/// mesure ici, c'est que le bon texte part, dans le bon ordre, avec les bons
/// réglages.
library;

abstract interface class Voix {
  /// Prépare le moteur. À appeler une fois, avant le premier [dire].
  Future<void> preparer();

  /// Dit [phrase]. Interrompt ce qui était en cours : un enfant qui appuie sur
  /// « suivant » attend la nouvelle étape, pas la fin de l'ancienne.
  Future<void> dire(String phrase);

  /// Coupe la parole en cours. Appelé quand on quitte un geste.
  Future<void> taire();
}
