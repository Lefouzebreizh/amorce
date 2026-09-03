/// Ce qu'Accord rend d'une photo : un verdict, et ses harmonies s'il y en a.
///
/// Les deux voyagent ensemble parce qu'elles se lisent ensemble — un verdict
/// accepté sans harmonies ne dit rien d'utile, et des harmonies sans verdict
/// n'ont pas de mur auquel se rattacher.
///
/// Le troisième cas n'est **pas** un refus : une photo illisible est une
/// panne, pas un jugement d'Accord. Les confondre afficherait « surface trop
/// sombre » sur un fichier corrompu et enverrait la personne rallumer la
/// lumière. D'où [ResultatAccord.panne], distinct des cinq refus.
library;

import 'harmonie.dart';
import 'photo_verdict.dart';

class ResultatAccord {
  const ResultatAccord.juge(this.verdict, this.harmonies) : illisible = false;

  const ResultatAccord.panne()
      : verdict = const PhotoVerdict.refusee(PhotoRefus.tropSombre),
        harmonies = const [],
        illisible = true;

  final PhotoVerdict verdict;

  /// Les trois harmonies quand la photo est acceptée, vide sinon.
  final List<Harmonie> harmonies;

  /// La photo n'a pas pu être décodée. [verdict] ne veut alors rien dire.
  final bool illisible;
}
