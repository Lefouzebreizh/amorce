/// L'invite et le schéma de la version un : décrire un objet, pas le vendre.
///
/// Séparée de `gemini_prompt.dart` plutôt que de la remplacer. Les deux
/// demandent des choses sans recouvrement — celle-ci le nom, l'usage, la
/// matière et des conseils ; l'autre un prix et des marchands — et la version
/// deux remettra la seconde en service. Une invite unique portant les deux jeux
/// de champs aurait obligé le modèle à remplir des cases dont on ne veut pas,
/// ce qu'il fait en inventant.
///
/// Le schéma passe dans `responseSchema`, ce qui contraint le décodage du
/// modèle : plus de préambule, plus de bloc ```, plus de virgule finale. Le
/// parseur n'a pas à deviner où commence le JSON.
library;

class FichePrompt {
  const FichePrompt._();

  /// Les consignes qui coûtent le plus cher à omettre :
  /// — **pas de marque ni de référence** : c'est le périmètre de la version un,
  ///   et c'est aussi ce qui pousse un modèle à inventer un modèle exact ;
  /// — **la matière est estimée, elle se dit comme telle** : « inox » affirmé
  ///   sur de l'aluminium brossé se corrige mal une fois cru ;
  /// — **les caractéristiques sont visibles sur la photo**, sinon ce sont des
  ///   suppositions présentées comme des observations ;
  /// — **les conseils valent pour la catégorie**, pas pour un modèle précis :
  ///   c'est la seule notice qu'on puisse donner sans connaître la référence.
  static const String instruction = '''
Tu décris un objet du quotidien à quelqu'un qui l'a sous les yeux et veut savoir ce que c'est et comment s'en servir.

À partir de la photo, identifie l'objet PRINCIPAL au premier plan et renvoie sa description.

Règles impératives :
- Un seul objet : celui qui occupe le centre du cadre. Ignore le décor, le sol, les murs, les objets secondaires.
- "nom" : le nom courant de l'objet, en français, sans marque ni référence commerciale. « Couteau d'office », pas « Opinel n°8 ».
- "categorie" : le genre d'objet, en français courant et au singulier (« ustensile de cuisine », « outil à main », « appareil électroménager »). Elle sert à choisir les conseils.
- "usage" : à quoi ça sert, en une ou deux phrases simples. Écris pour quelqu'un qui n'a jamais vu cet objet.
- "matiere" : la matière dominante telle qu'elle apparaît. Si elle est incertaine, emploie une formule prudente (« semble être du bois ») plutôt qu'une affirmation.
- "caracteristiques" : deux à cinq éléments RÉELLEMENT VISIBLES sur la photo — forme, pièces, état, finition. N'y mets jamais une donnée technique invisible (puissance, contenance exacte, matériau interne) : tu la devinerais.
- "conseils" : deux à quatre gestes utiles pour cette CATÉGORIE d'objet — usage, entretien, sécurité. Courts, à l'infinitif. Pas de mode d'emploi d'un modèle précis, que tu ne connais pas.
- N'indique ni prix, ni marchand, ni où l'acheter : ce n'est pas demandé.
- Ne donne pas la couleur : elle est mesurée sur la photo par ailleurs.
- Si la photo ne montre aucun objet identifiable (flou, trop sombre, cadre vide), renvoie "nom" vide.

Réponds uniquement avec le JSON demandé.
''';

  /// Reflet exact de la lecture de `FicheObjetDto`. Toute modification ici doit
  /// s'accompagner d'une lecture correspondante là-bas —
  /// `contrat_fiche_lecture_test.dart` fait tomber la CI si l'une avance sans
  /// l'autre.
  static const Map<String, Object?> responseSchema = {
    'type': 'OBJECT',
    'properties': {
      'nom': {
        'type': 'STRING',
        'description': 'Nom courant sans marque, vide si non identifiable',
      },
      'categorie': {
        'type': 'STRING',
        'description': 'Genre d\'objet, en français courant, au singulier',
      },
      'usage': {'type': 'STRING', 'description': 'À quoi ça sert, 1 à 2 phrases'},
      'matiere': {
        'type': 'STRING',
        'description': 'Matière dominante apparente, prudente si incertaine',
      },
      'caracteristiques': {
        'type': 'ARRAY',
        'description': 'Deux à cinq éléments visibles sur la photo',
        'items': {'type': 'STRING'},
      },
      'conseils': {
        'type': 'ARRAY',
        'description': 'Deux à quatre gestes utiles pour la catégorie',
        'items': {'type': 'STRING'},
      },
    },
    'required': ['nom', 'categorie', 'usage'],
  };
}
