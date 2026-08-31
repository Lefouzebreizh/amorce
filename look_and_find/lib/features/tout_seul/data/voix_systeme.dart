/// La voix réelle : le moteur de synthèse du téléphone, par `flutter_tts`.
///
/// **Trois réglages, et chacun a une raison qui tient à l'âge de l'auditeur.**
///
/// * **Le français explicitement.** Un moteur laissé sur la langue du système
///   lit « croise » à l'anglaise sur un téléphone configuré en anglais, et
///   l'enfant n'a aucun moyen de comprendre que c'est la machine qui se trompe.
/// * **Un débit ralenti.** Le défaut d'Android vise un adulte qui lit ses
///   notifications. Une consigne gestuelle doit laisser le temps de faire le
///   geste pendant qu'on l'entend.
/// * **Une phrase interrompt la précédente.** Sans quoi appuyer deux fois
///   empile les consignes et l'enfant entend deux étapes en même temps.
///
/// Aucun réseau : la synthèse est une capacité du système d'exploitation. Rien
/// ne sort de l'appareil, ce qui est la promesse de cette application.
library;

import 'package:flutter_tts/flutter_tts.dart';

import '../domain/voix.dart';

class VoixSysteme implements Voix {
  VoixSysteme([FlutterTts? moteur]) : _moteur = moteur ?? FlutterTts();

  final FlutterTts _moteur;

  /// Le français de France. Le moteur retombe seul sur une voix approchante
  /// si celle-ci manque — mieux qu'un échec silencieux.
  static const langue = 'fr-FR';

  /// Entre 0 et 1 chez `flutter_tts`. 0,5 est le défaut ; 0,4 laisse le temps
  /// du geste sans donner l'impression d'un ralenti.
  static const debit = 0.4;

  @override
  Future<void> preparer() async {
    await _moteur.setLanguage(langue);
    await _moteur.setSpeechRate(debit);
    // Attendre la fin d'un énoncé permet à `dire` de rendre la main quand la
    // phrase est finie, et non dès qu'elle est lancée : c'est ce qui autorise
    // un enchaînement d'étapes sans les superposer.
    await _moteur.awaitSpeakCompletion(true);
  }

  @override
  Future<void> dire(String phrase) async {
    await _moteur.stop();
    await _moteur.speak(phrase);
  }

  @override
  Future<void> taire() => _moteur.stop();
}
