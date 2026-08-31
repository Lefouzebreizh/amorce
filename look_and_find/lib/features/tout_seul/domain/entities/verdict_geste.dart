/// Ce que « Tout seul » répond quand on lui montre un objet.
///
/// **Refuser fait partie du produit**, exactement comme à la porte d'Accord —
/// et ici la raison est plus dure encore. Accord refuse une photo pour ne pas
/// vendre un coussin de la mauvaise couleur ; ici, la personne en face est un
/// enfant qui **ne sait pas lire**, donc qui n'ira rien recouper ailleurs. Un
/// geste physique approchant — le tuto des lacets servi pour une ceinture — est
/// reçu comme vrai, et exécuté.
///
/// D'où la règle qui commande tout le module : **quand l'objet n'est pas au
/// corpus, on le dit.** Jamais le geste le plus proche, jamais une réponse
/// partielle. Le corpus est écrit à l'avance et relu ; ce qui n'y est pas
/// n'existe pas.
///
/// Comme à la porte d'Accord, un refus porte toujours deux choses : **ce qui ne
/// va pas** et **le geste à poser derrière**. Un refus sans issue fait remontrer
/// le même objet et rend le même refus ; à cet âge-là, ça s'appelle abandonner.
library;

import 'geste.dart';

/// Pourquoi le corpus n'a rien à répondre.
enum RaisonInconnue {
  /// L'objet a bien été nommé, mais aucun geste du corpus ne le revendique.
  horsCorpus('Je ne connais pas encore ce geste.'),

  /// Rien d'exploitable n'est remonté de l'appareil photo : cadre vide,
  /// étiquette illisible. Ce n'est pas le même problème et ce n'est pas le
  /// même geste à poser — remontrer l'objet, plutôt qu'en montrer un autre.
  rienDeReconnu('Je n\'ai pas bien vu ce que tu me montres.');

  const RaisonInconnue(this.texte);

  /// La phrase dite à voix haute, sans jargon et sans reproche.
  final String texte;
}

/// La réponse du corpus : soit un geste, soit un refus qui dit quoi faire.
///
/// Type scellé : ajouter un troisième cas — « geste trouvé mais incertain »,
/// la tentation permanente — casse toutes les analyses de cas d'un coup, à la
/// compilation, plutôt qu'en silence sur l'appareil d'un enfant.
sealed class VerdictGeste {
  const VerdictGeste();

  /// Vrai quand un geste du corpus a été trouvé.
  bool get estTrouve => this is GesteTrouve;
}

/// Un geste du corpus correspond à l'objet montré.
final class GesteTrouve extends VerdictGeste {
  const GesteTrouve(this.geste, this.etiquetteReconnue);

  /// Le geste, avec ses étapes prêtes à être dites.
  final Geste geste;

  /// L'étiquette normalisée qui a ouvert la porte. Elle sert au journal : quand
  /// un parent dit « il a eu le mauvais tuto », c'est le seul élément qui dit
  /// par quel mot le corpus a été atteint.
  final String etiquetteReconnue;

  @override
  String toString() => '${geste.identifiant} ← $etiquetteReconnue';
}

/// Aucun geste du corpus ne correspond, et on le dit.
final class GesteInconnu extends VerdictGeste {
  const GesteInconnu(this.raison, this.conseil);

  final RaisonInconnue raison;

  /// Le geste à poser derrière, avec de **vrais objets du corpus** nommés
  /// dedans. Un conseil qui citerait un objet inconnu du corpus enverrait
  /// l'enfant droit vers un second refus ; les tests interdisent ce cas.
  final String conseil;

  /// Ce qui ne va pas, dit sans jargon.
  String get texte => raison.texte;

  @override
  String toString() => '${raison.texte} $conseil';
}
