/// L'image de chaque geste, pour quelqu'un qui ne sait pas lire.
///
/// **Pourquoi cette table n'est pas dans le corpus.** Le domaine ne connaît ni
/// dessin, ni fichier, ni caractère d'affichage : c'est écrit en tête de
/// `geste.dart` et gardé par `cloison_test.dart`. Un émoji est une décision
/// d'affichage — il changera le jour où de vraies illustrations arriveront,
/// sans qu'une ligne du corpus ne bouge.
///
/// **Pourquoi un émoji plutôt qu'un dessin.** Il est déjà sur l'appareil, il
/// suit le thème du système, il ne pèse rien et il n'y a rien à télécharger.
/// Une application pour enfant qui attend des images est une application qui
/// montre des carrés gris le premier jour.
///
/// ## La règle de choix, et ce qu'elle coûte
///
/// L'émoji retenu est **l'objet que l'enfant tient dans la main**, jamais
/// l'action : personne ne reconnaît « nouer » en image, tout le monde reconnaît
/// une basket. C'est aussi ce qui aligne la vignette sur les étiquettes du
/// corpus, qui sont elles aussi des noms d'objets.
///
/// Deux gestes n'ont pas d'émoji juste, et il faut le dire plutôt que de le
/// laisser découvrir :
///
/// * **La fermeture éclair n'existe pas en émoji.** Le sac à dos a été retenu
///   parce que c'est la fermeture qu'un enfant tire tous les matins, même si
///   les étapes parlent d'un blouson.
/// * **La brosse à cheveux non plus** — 🪮 est trop récent pour les téléphones
///   visés et sortirait en carré vide. 💇 montre des cheveux qu'on arrange,
///   ce qui est le sujet.
///
/// Aucun caractère de cette table n'est postérieur à Unicode 12 (2019) : au
/// delà, le risque n'est pas un émoji laid, c'est un **carré vide** sur le
/// terrain de référence — et un carré vide, pour un enfant qui ne lit pas, est
/// une tuile morte.
library;

abstract final class EmojisGestes {
  /// L'émoji de chaque geste, par identifiant de corpus.
  ///
  /// Un geste sans entrée ici laisserait un trou dans la grille : le test
  /// `emojis_test.dart` compare cette table au corpus dans les deux sens.
  static const Map<String, String> parIdentifiant = {
    'nouer_ses_lacets': '👟',
    'boutonner_son_gilet': '👚',
    'fermer_une_fermeture_eclair': '🎒',
    'se_brosser_les_dents': '🦷',
    'se_laver_les_mains': '🧼',
    'se_moucher': '🤧',
    'mettre_ses_chaussures_au_bon_pied': '🥾',
    'verser_sans_renverser': '🥛',
    'plier_un_tee_shirt': '👕',
    'faire_son_lit': '🛏️',
    'ranger_ses_jouets': '🧸',
    'tenir_sa_fourchette': '🍴',
    'ouvrir_une_brique_de_lait': '🧃',
    'mettre_son_manteau': '🧥',
    'tenir_son_crayon': '✏️',
    'se_coiffer': '💇',
    'nouer_son_echarpe': '🧣',
  };

  /// L'émoji d'un geste. Le repli n'est jamais atteint — le test l'interdit —
  /// mais il vaut mieux qu'une exception : une grille amputée d'une tuile se
  /// répare au prochain déploiement, une application qui refuse de démarrer
  /// laisse l'enfant devant un écran noir.
  static String pour(String identifiant) => parIdentifiant[identifiant] ?? '❓';
}
