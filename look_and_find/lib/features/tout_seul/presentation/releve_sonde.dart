/// Le relevé : ce que la sonde met dans le presse-papier.
///
/// **Ce fichier est le vrai livrable du lot.** L'écran sert à viser ; ce qui
/// voyage jusqu'à celui qui écrira la table de correspondance, c'est ce texte —
/// collé dans un message, depuis un téléphone, souvent d'une main.
///
/// Trois décisions de forme, chacune pour une raison de lecture à distance :
///
/// 1. **Le point décimal, jamais la virgule.** Le reste du dépôt écrit en
///    français, et c'est la règle ; ici la sortie est une **mesure destinée à
///    être relue et comparée**, éventuellement collée dans un tableur ou
///    reprise par un script. `0.92` se relit partout ; `0,92` devient une
///    colonne de texte au premier collage.
/// 2. **Deux décimales, pas plus.** La confiance d'un modèle n'a pas trois
///    chiffres significatifs, et une colonne alignée se lit d'un coup d'œil.
/// 3. **Un en-tête qui se répète à chaque relevé.** Le propriétaire va viser
///    dix objets à la suite et coller dix blocs : sans une ligne de séparation,
///    on ne sait plus où finit une chaussure et où commence une brosse à dents.
library;

import '../domain/reconnaissance.dart';

/// La première ligne de tout relevé. Elle est cherchée telle quelle par les
/// tests : la changer sans les changer casse la promesse de séparation.
const String enteteReleve = 'Tout seul — relevé de sonde';

/// Le texte à coller, tel qu'il partira dans un message.
String texteDuReleve(List<EtiquetteVue> etiquettes) {
  if (etiquettes.isEmpty) {
    // Une lecture sans rien reconnu **est une mesure**, et probablement la plus
    // instructive : c'est elle qui dira si le moteur reste muet sur un lacet
    // vu de près. Rendre une chaîne vide effacerait le seul cas qu'on ne peut
    // pas deviner.
    return '$enteteReleve (aucune étiquette)';
  }

  final lignes = etiquettes.map(
    (vue) => '${vue.confiance.toStringAsFixed(2)}  ${vue.texte}',
  );
  // L'accord au singulier n'est pas de la coquetterie : ce texte sera relu par
  // quelqu'un, et « 1 étiquettes » dans un relevé fait douter du reste de la
  // mesure. Trouvé en lisant la sortie d'une mutation, pas en relisant le code.
  final mot = etiquettes.length == 1 ? 'étiquette' : 'étiquettes';
  return '$enteteReleve (${etiquettes.length} $mot)\n'
      '${lignes.join('\n')}';
}

/// La confiance telle qu'elle s'affiche à l'écran — en pourcentage, qui se lit
/// plus vite qu'un nombre à virgule quand on tient le téléphone d'une main et
/// l'objet de l'autre.
///
/// L'espace avant le signe est **insécable et écrite en échappement** : brute,
/// elle est invisible dans un diff et quelqu'un la remplace un jour par une
/// espace ordinaire sans le voir (convention du dépôt).
String confianceLisible(double confiance) =>
    '${(confiance * 100).round()}\u00A0%';
