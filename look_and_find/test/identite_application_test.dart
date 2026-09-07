/// Le nom sous lequel l'application se présente au système.
///
/// **Pourquoi un test, pour deux chaînes de caractères.** Le nom du gabarit
/// Flutter — celui du dossier, avec ses tirets bas — est resté en place tout le
/// développement sans que rien ne le signale : il ne se voit ni à l'analyse, ni
/// aux tests, ni au lancement depuis l'IDE. Il se découvre sur un vrai
/// téléphone, dans le tiroir d'applications et dans l'avertissement de Play
/// Protect, au moment précis où l'on cherche l'application pour la désinstaller
/// et où on ne la trouve pas.
///
/// Ces tests lisent les fichiers de plateforme depuis le disque plutôt que
/// d'importer une constante : c'est ce que le système lit, et c'est donc la
/// seule chose qui compte.
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  group('le nom affiché', () {
    test('Android ne montre plus le nom du gabarit', () {
      final manifeste = File(
        'android/app/src/main/AndroidManifest.xml',
      ).readAsStringSync();

      expect(
        manifeste,
        contains('android:label="Look &amp; Find"'),
        reason: 'C\'est ce nom que cherche quelqu\'un dans ses applications.',
      );
      expect(
        manifeste,
        isNot(contains('android:label="look_and_find"')),
        reason: 'Le nom du dossier Flutter n\'est pas un nom de produit.',
      );
    });

    test('iOS affiche le même nom qu\'Android', () {
      // Deux noms différents sur deux plateformes, c'est deux produits pour la
      // personne qui a les deux appareils.
      final plist = File('ios/Runner/Info.plist').readAsStringSync();

      expect(plist, contains('<string>Look &amp; Find</string>'));
    });

    test('l\'esperluette est écrite en entité, jamais en caractère brut', () {
      // En caractère brut elle fait échouer la compilation des ressources
      // Android, avec une erreur qui ne la nomme pas — et le fichier reste
      // parfaitement lisible à l'œil.
      for (final chemin in const [
        'android/app/src/main/AndroidManifest.xml',
        'ios/Runner/Info.plist',
      ]) {
        final contenu = File(chemin).readAsStringSync();
        expect(
          contenu,
          isNot(contains('Look & Find')),
          reason: '$chemin doit écrire « &amp; », pas « & ».',
        );
      }
    });
  });

  test('la description annonce la version un, et rien d\'autre', () {
    // Elle promettait encore « le meilleur prix » et « la réalité augmentée »,
    // c'est-à-dire les versions deux et trois. C'est le texte qui accompagne
    // le paquet : promettre ce que l'application ne fait pas est le plus
    // sûr moyen d'être jugé sur ce qu'elle n'a jamais prétendu faire.
    final pubspec = File('pubspec.yaml').readAsStringSync();
    final ligne = pubspec
        .split('\n')
        .firstWhere((l) => l.startsWith('description:'))
        .toLowerCase();

    for (final mot in ['prix', 'marchand', 'réalité augmentée', 'acheter']) {
      expect(
        ligne,
        isNot(contains(mot)),
        reason: '« $mot » n\'est pas dans le périmètre de la version un.',
      );
    }
  });
}
