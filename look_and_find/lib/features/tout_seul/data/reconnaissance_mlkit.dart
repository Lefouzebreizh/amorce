/// La reconnaissance réelle : ML Kit, **entièrement sur l'appareil**.
///
/// ## Ce que ce fichier NE peut pas prouver
///
/// Aucun test de ce dépôt ne peut établir que ML Kit reconnaît quoi que ce
/// soit. Le modèle est natif, il vit dans le paquet Android ou iOS, et il n'y a
/// pas de moteur derrière le canal de plateforme sur une machine de
/// vérification. C'est exactement la situation de `voix_systeme.dart`, et la
/// discipline est la même :
///
/// * **Ce qui se mesure ici** — que le bon canal soit appelé, que le seuil
///   parte comme demandé, que chaque étiquette rendue par la plateforme
///   remonte entière (texte *et* confiance), dans un ordre stable, et que le
///   moteur soit libéré. `reconnaissance_mlkit_test.dart` intercepte le canal
///   et vérifie tout cela.
/// * **Ce qui ne se mesure que sur un téléphone** — qu'une photo de lacets
///   produise « Shoe » plutôt que « Textile », et à quelle confiance. C'est
///   précisément ce que la sonde va relever.
///
/// Une session qui annoncerait « la reconnaissance marche » parce que cette
/// suite est verte se tromperait exactement comme celle qui annonçait une voix
/// off vérifiée sans avoir écouté le fichier.
///
/// ## Le seuil est volontairement bas
///
/// ML Kit filtre par défaut à 0,5. À ce stade on ne cherche pas à décider, on
/// cherche à **voir** : une étiquette juste mais peu sûre — « Shoelace » à 0,34
/// — est exactement le genre d'information qui décidera de la table de
/// correspondance, et un filtre posé maintenant la ferait disparaître avant
/// qu'on ait su qu'elle existait. On resserre plus tard, sur des relevés, pas
/// sur une intuition.
///
/// ## Le piège du champ JSON
///
/// La plateforme rend `text`, et le paquet le range dans `ImageLabel.label`.
/// Les deux noms coexistent donc pour la même donnée. Rien ici ne lit le JSON
/// directement — c'est `ImageLabel.fromJson` qui s'en charge — mais le test
/// fabrique la réponse de la plateforme et doit employer `text` : écrite avec
/// `label`, la fausse réponse rendrait des étiquettes vides, et l'on croirait
/// à un défaut d'adaptateur.
library;

import 'package:google_mlkit_image_labeling/google_mlkit_image_labeling.dart';

import '../domain/reconnaissance.dart';

class ReconnaissanceMlkit implements Reconnaissance {
  ReconnaissanceMlkit({double seuil = seuilDeSonde, ImageLabeler? moteur})
      : _moteur = moteur ??
            ImageLabeler(
              options: ImageLabelerOptions(confidenceThreshold: seuil),
            );

  /// 0,2 — voir le bloc de tête. Le défaut du paquet est 0,5.
  static const double seuilDeSonde = 0.2;

  final ImageLabeler _moteur;

  @override
  Future<List<EtiquetteVue>> observer(String cheminImage) async {
    // `InputImage.fromFilePath` ne lit pas le fichier : elle ne fait que
    // transporter le chemin jusqu'au natif, qui l'ouvrira lui-même. C'est ce
    // qui rend cet adaptateur éprouvable sans image réelle.
    final image = InputImage.fromFilePath(cheminImage);
    final brutes = await _moteur.processImage(image);

    return EtiquetteVue.triees(
      brutes.map((vue) => EtiquetteVue(vue.label, vue.confidence)),
    );
  }

  @override
  Future<void> liberer() => _moteur.close();
}
