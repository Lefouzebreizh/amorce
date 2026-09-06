/// Ce que la photo annonce d'elle-même au service.
///
/// **Le défaut que ces tests ferment.** Quand `package:image` ne sait pas
/// décoder les octets, on envoie l'original — c'est voulu, le service lit plus
/// de formats que nous — mais on l'annonçait `image/jpeg` quoi qu'il arrive. Un
/// cliché HEIF, format courant sur Android, partait donc étiqueté JPEG et la
/// requête entière était refusée en 400, sans que rien ne désigne la photo.
///
/// Le format se lit dans les octets et jamais ailleurs : il n'y a pas de nom de
/// fichier — la photo arrive du déclencheur en mémoire — et une extension ment
/// de toute façon.
library;

import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:look_and_find/core/utils/image_compressor.dart';

Uint8List _octets(List<int> tete, {int longueur = 32}) {
  final donnees = Uint8List(longueur);
  donnees.setRange(0, tete.length, tete);
  return donnees;
}

/// Un conteneur ISO-BMFF : quatre octets de taille, « ftyp », puis la marque.
Uint8List _heif(String marque) => _octets([
  0, 0, 0, 24,
  0x66, 0x74, 0x79, 0x70, // ftyp
  ...marque.codeUnits,
]);

void main() {
  group('typeMimeDe', () {
    test('reconnaît un JPEG', () {
      expect(
        ImageCompressor.typeMimeDe(_octets([0xFF, 0xD8, 0xFF, 0xE0])),
        'image/jpeg',
      );
    });

    test('reconnaît un PNG', () {
      expect(
        ImageCompressor.typeMimeDe(
          _octets([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        ),
        'image/png',
      );
    });

    test('reconnaît un WebP, dont la marque est décalée', () {
      // « RIFF » puis quatre octets de taille avant « WEBP » : un contrôle qui
      // ne regarde que le début rendrait un faux positif sur tout RIFF.
      expect(
        ImageCompressor.typeMimeDe(
          _octets([
            0x52, 0x49, 0x46, 0x46, // RIFF
            0, 0, 0, 0,
            0x57, 0x45, 0x42, 0x50, // WEBP
          ]),
        ),
        'image/webp',
      );
    });

    test('reconnaît les variantes de la famille HEIF', () {
      // C'est le cas qui bloquait : ces octets-là partaient annoncés en JPEG.
      for (final marque in ['heic', 'heix', 'mif1', 'msf1', 'hevc']) {
        expect(
          ImageCompressor.typeMimeDe(_heif(marque)),
          'image/heic',
          reason: 'La marque $marque appartient à la famille HEIF.',
        );
      }
    });

    test('un conteneur ISO-BMFF qui n\'est pas une image reste inconnu', () {
      // « isom » est un MP4 : l'accepter ferait envoyer une vidéo étiquetée
      // photo, et le service la refuserait sans qu'on sache pourquoi.
      expect(ImageCompressor.typeMimeDe(_heif('isom')), isNull);
    });

    test('des octets qui ne sont rien restent inconnus', () {
      expect(ImageCompressor.typeMimeDe(_octets([1, 2, 3, 4])), isNull);
    });

    test('ne lève pas sur un tampon plus court que les motifs', () {
      // La longueur se vérifie avant la lecture : sinon le contrôle destiné à
      // reconnaître une photo tronquée plante dessus.
      for (var n = 0; n < 12; n++) {
        expect(ImageCompressor.typeMimeDe(Uint8List(n)), isNull);
      }
    });
  });

  test('les formats acceptés sont ceux que le service lit', () {
    expect(ImageCompressor.typesAcceptes, {
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    });
  });
}
