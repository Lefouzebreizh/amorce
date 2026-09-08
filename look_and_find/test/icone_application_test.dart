/// L'icône réellement posée dans le paquet.
///
/// **Pourquoi un test sur des pixels.** L'icône du gabarit Flutter est restée en
/// place tout le développement, exactement comme le nom : elle ne se voit ni à
/// l'analyse, ni aux tests, ni au lancement depuis l'IDE. Elle se découvre sur
/// un téléphone, et c'est par elle qu'on identifie une application dans un
/// tiroir — c'est aussi le logo bleu qui s'affichait dans l'avertissement de
/// Play Protect.
///
/// Le test ne juge pas le dessin, ce que seul l'œil peut faire
/// (`python3 tool/icone.py --apercu`). Il vérifie trois choses qu'une
/// régénération ratée ou un retour au gabarit casserait en silence : le fond est
/// celui de l'application, il y a bien un tracé clair dessus, et l'icône
/// adaptative existe avec ses cinq densités.
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;

const _densites = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
const _res = 'android/app/src/main/res';

void main() {
  group('l\'icône Android', () {
    late img.Image icone;

    setUpAll(() {
      final octets = File('$_res/mipmap-mdpi/ic_launcher.png').readAsBytesSync();
      icone = img.decodeImage(octets)!;
    });

    test('a le fond sombre de l\'application, pas celui du gabarit', () {
      // Le gabarit Flutter est clair dans les coins ; `ink` y est presque noir.
      final coin = icone.getPixel(0, 0);
      expect(coin.r, lessThan(40), reason: 'Le coin doit être AppColors.ink.');
      expect(coin.g, lessThan(40));
      expect(coin.b, lessThan(40));
    });

    test('porte un tracé clair, et pas seulement un carré vide', () {
      var clairs = 0;
      for (var y = 0; y < icone.height; y++) {
        for (var x = 0; x < icone.width; x++) {
          if (icone.getPixel(x, y).r > 200) clairs++;
        }
      }
      final total = icone.width * icone.height;
      // Quatre équerres fines : quelques pour cent de la surface. Trop peu
      // voudrait dire un fond nu, beaucoup trop un aplat clair.
      expect(clairs / total, greaterThan(0.02));
      expect(clairs / total, lessThan(0.30));
    });

    test('laisse le centre vide — c\'est ce qui dit « viser »', () {
      final centre = icone.getPixel(icone.width ~/ 2, icone.height ~/ 2);
      expect(
        centre.r,
        lessThan(40),
        reason: 'Un cadre de visée est ouvert au milieu, par définition.',
      );
    });

    test('existe à toutes les densités', () {
      for (final densite in _densites) {
        expect(
          File('$_res/mipmap-$densite/ic_launcher.png').existsSync(),
          isTrue,
          reason: 'mipmap-$densite : une densité manquante fait servir une '
              'image redimensionnée par le système, donc floue.',
        );
      }
    });
  });

  group('l\'icône adaptative', () {
    test('est déclarée et pointe sur ce qui existe', () {
      // Sans elle, Android 8 et suivants posent l'icône héritée dans une
      // pastille blanche : le carré sombre s'y retrouve encadré de blanc et
      // réduit, et le dessin devient illisible.
      final xml = File('$_res/mipmap-anydpi-v26/ic_launcher.xml');
      expect(xml.existsSync(), isTrue);

      final contenu = xml.readAsStringSync();
      expect(contenu, contains('@color/ic_launcher_background'));
      expect(contenu, contains('@mipmap/ic_launcher_foreground'));

      final couleurs = File('$_res/values/ic_launcher_background.xml')
          .readAsStringSync();
      expect(couleurs, contains('ic_launcher_background'));
      expect(
        couleurs.toUpperCase(),
        contains('#0B0D10'),
        reason: 'Le fond de l\'icône est celui de l\'application.',
      );
    });

    test('a son avant-plan à toutes les densités', () {
      for (final densite in _densites) {
        expect(
          File('$_res/mipmap-$densite/ic_launcher_foreground.png').existsSync(),
          isTrue,
          reason: 'mipmap-$densite',
        );
      }
    });

    test('garde son tracé dans la zone que le masque ne rogne pas', () {
      // La toile fait 108 dp, le lanceur n'en montre que 72 et n'en garantit
      // que 66 : un tracé qui déborde se fait couper, et sur certains lanceurs
      // seulement — donc jamais chez celui qui l'a dessiné.
      final octets = File('$_res/mipmap-xxxhdpi/ic_launcher_foreground.png')
          .readAsBytesSync();
      final avant = img.decodeImage(octets)!;
      final marge = (avant.width * (1 - 66 / 108) / 2).floor();

      for (var y = 0; y < avant.height; y++) {
        for (var x = 0; x < avant.width; x++) {
          final dehors = x < marge ||
              y < marge ||
              x >= avant.width - marge ||
              y >= avant.height - marge;
          if (dehors && avant.getPixel(x, y).a > 8) {
            fail('Tracé en ($x, $y), hors de la zone garantie de 66 dp.');
          }
        }
      }
    });
  });
}
