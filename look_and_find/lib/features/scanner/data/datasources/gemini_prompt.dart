/// L'invite et le schéma envoyés au modèle.
///
/// Ils sont isolés du code d'appel parce que c'est **ici** que se règle la
/// qualité de l'identification : un champ ajouté au schéma vaut mieux qu'une
/// phrase de plus dans l'invite, et l'un se relit sans l'autre.
///
/// Le schéma n'est pas décoratif. En le passant dans `responseSchema` avec
/// `responseMimeType: application/json`, le décodage du modèle est contraint :
/// il ne peut plus renvoyer de préambule, de bloc ``` ni de virgule finale, et
/// le parseur n'a plus à deviner où commence le JSON. C'est ce qui remplace
/// une extraction par expression régulière, laquelle finit toujours par se
/// tromper sur un texte qui contient une accolade.
library;

class GeminiPrompt {
  const GeminiPrompt._();

  /// Les consignes qui coûtent le plus cher à omettre :
  /// — « une seule photo, un seul objet » : sinon le modèle décrit la pièce ;
  /// — prix **en euros, marché français** : sans quoi il renvoie des dollars
  ///   et le comparateur devient faux sans prévenir ;
  /// — dimensions du produit réel, pas mesurées sur la photo : un modèle
  ///   estime mal une perspective, mais connaît les cotes d'un objet courant ;
  /// — pas de marchand inventé : une URL fabriquée envoie l'utilisateur sur
  ///   une 404 et détruit la confiance plus sûrement qu'un champ vide.
  static const String instruction = '''
Tu es un expert en identification de produits du quotidien (mobilier, high-tech, électroménager, décoration).

À partir de la photo fournie, identifie l'objet PRINCIPAL au premier plan et renvoie sa fiche produit.

Règles impératives :
- Un seul objet : celui qui occupe le centre du cadre. Ignore le décor, le sol, les murs, les objets secondaires.
- Prix en euros (EUR), marché français, toutes taxes comprises.
- "average_price" est le prix moyen constaté neuf ; s'il est inconnu, estime-le plutôt que de renvoyer 0.
- "dimensions" sont celles du produit réel en centimètres, pas des mesures prises sur la photo.
- "merchants" : uniquement des enseignes réellement susceptibles de vendre ce produit en France, avec une URL de recherche plausible sur leur domaine officiel. N'invente jamais une référence produit exacte que tu ne connais pas ; en cas de doute, pointe la page de recherche du site.
- "alternatives" : deux à quatre modèles équivalents MOINS CHERS que "average_price".
- "model_3d_url" : uniquement une URL .glb ou .usdz publiquement accessible que tu connais réellement. Sinon, laisse ce champ vide.
- Si la photo ne montre aucun objet identifiable (flou, trop sombre, cadre vide), renvoie "title" vide.

Réponds uniquement avec le JSON demandé.
''';

  /// Reflet exact du modèle de données de `ProductDto`. Toute modification ici
  /// doit s'accompagner d'une lecture correspondante là-bas.
  static const Map<String, Object?> responseSchema = {
    'type': 'OBJECT',
    'properties': {
      'title': {
        'type': 'STRING',
        'description': 'Nom précis de l\'objet, vide si non identifiable',
      },
      'brand': {'type': 'STRING', 'description': 'Marque estimée'},
      'category': {
        'type': 'STRING',
        'enum': ['furniture', 'tech', 'appliance', 'decor'],
      },
      'description': {'type': 'STRING'},
      'average_price': {'type': 'NUMBER'},
      'currency': {'type': 'STRING'},
      'dimensions': {
        'type': 'OBJECT',
        'properties': {
          'width': {'type': 'NUMBER'},
          'height': {'type': 'NUMBER'},
          'depth': {'type': 'NUMBER'},
          'unit': {'type': 'STRING'},
        },
      },
      'merchants': {
        'type': 'ARRAY',
        'items': {
          'type': 'OBJECT',
          'properties': {
            'name': {'type': 'STRING'},
            'price': {'type': 'NUMBER'},
            'url': {'type': 'STRING'},
            'in_stock': {'type': 'BOOLEAN'},
            'discount': {'type': 'STRING'},
          },
          'required': ['name', 'price', 'url'],
        },
      },
      'alternatives': {
        'type': 'ARRAY',
        'items': {
          'type': 'OBJECT',
          'properties': {
            'title': {'type': 'STRING'},
            'price': {'type': 'NUMBER'},
            'brand': {'type': 'STRING'},
          },
          'required': ['title', 'price'],
        },
      },
      'model_3d_url': {'type': 'STRING'},
    },
    'required': ['title', 'category', 'average_price', 'currency'],
  };
}
